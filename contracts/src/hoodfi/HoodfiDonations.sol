// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {LabelUtils} from "./LabelUtils.sol";

/// @dev Subset of the live ETHRegistrarController (0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547).
///      rentPrice returns IPriceOracle.Price{base,premium}; a two-uint256 tuple decodes identically.
interface IETHRegistrarController {
    function rentPrice(string memory name, uint256 duration)
        external
        view
        returns (uint256 base, uint256 premium);
    function renew(string calldata name, uint256 duration, bytes32 referrer) external payable;
}

interface IBaseRegistrar {
    function nameExpires(uint256 id) external view returns (uint256);
}

/// @title HoodfiDonations
/// @notice Trustless pre-launch donation + name reservation tracker for hoodfi.eth.
///         Every donation atomically renews hoodfi.eth on the official ENS controller
///         inside the donor's own transaction; this contract never holds funds.
///         1 year donated = 1 reserved subname slot, until the 1000-year goal is hit.
contract HoodfiDonations is Ownable, ReentrancyGuard {
    using LabelUtils for string;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    string public constant PARENT_LABEL = "hoodfi";
    uint256 public constant GOAL_YEARS = 1000;
    uint256 public constant YEAR = 365 days;
    /// @dev Upper bound per tx keeps duration math far from overflow and quotes sane.
    uint256 public constant MAX_YEARS_PER_DONATION = 1000;

    IETHRegistrarController public immutable controller;
    IBaseRegistrar public immutable baseRegistrar;
    /// @dev uint256(keccak256("hoodfi")) — token id on the .eth base registrar.
    uint256 public immutable parentTokenId;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 public totalYearsDonated;
    bool public finalized;
    uint256 public snapshotBlock;

    /// @notice Reservation slots earned (1 per year donated) and spent, per donor.
    mapping(address donor => uint256) public slots;
    mapping(address donor => uint256) public usedSlots;

    /// @notice labelhash => donor who reserved it. Source of truth copied to L2 at snapshot.
    mapping(bytes32 labelhash => address donor) public reservedBy;

    /// @notice Infra labels that can never be reserved (www, api, admin, ...).
    mapping(bytes32 labelhash => bool) public blocklisted;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Donated(address indexed donor, uint256 numYears, uint256 ethPaid, uint256 newExpiry);
    /// @dev `label` preimage is only in the event — the snapshot export script reads
    ///      these logs to build the L2 loadReservations calldata.
    event NameReserved(address indexed donor, bytes32 indexed labelhash, string label);
    event GoalReached(uint256 totalYears, uint256 finalExpiry, uint256 snapshotBlock);
    event Extended(address indexed supporter, uint256 numYears, uint256 ethPaid, uint256 newExpiry);
    event BlocklistUpdated(bytes32 indexed labelhash, bool blocked);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error AlreadyFinalized();
    error GoalNotReached();
    error InvalidYears();
    error InsufficientPayment(uint256 required, uint256 provided);
    error LabelNotReservable(string label);
    error LabelAlreadyReserved(string label);
    error LabelBlocked(string label);
    error NotEnoughSlots();
    error RefundFailed();

    constructor(address _controller, address _baseRegistrar, address _owner) Ownable(_owner) {
        controller = IETHRegistrarController(_controller);
        baseRegistrar = IBaseRegistrar(_baseRegistrar);
        parentTokenId = uint256(keccak256(bytes(PARENT_LABEL)));
    }

    /// @dev Accepts refunds from the ETH registrar controller (it refunds overpayment
    ///      to msg.sender, which is this contract during renew).
    receive() external payable {}

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Donate years to hoodfi.eth's expiry. Renews the name on the official ENS
    ///         controller in this same transaction and credits 1 reservation slot per year.
    /// @param numYears Whole years to add to hoodfi.eth's expiry.
    /// @param labels Optional labels to reserve immediately (must be 4+ chars, normalized).
    ///               May be fewer than the slots earned; reserve the rest later.
    function donate(uint256 numYears, string[] calldata labels) external payable nonReentrant {
        if (finalized) revert AlreadyFinalized();

        uint256 paid = _renew(numYears);

        totalYearsDonated += numYears;
        slots[msg.sender] += numYears;
        _reserve(labels);

        emit Donated(msg.sender, numYears, paid, nameExpires());

        _refundBalance();
    }

    /// @notice Reserve names with previously earned, unspent slots.
    function reserve(string[] calldata labels) external {
        if (finalized) revert AlreadyFinalized();
        _reserve(labels);
    }

    /// @notice Freeze reservations once the 1000-year goal is reached. Callable by anyone.
    function finalize() external {
        if (finalized) revert AlreadyFinalized();
        if (totalYearsDonated < GOAL_YEARS) revert GoalNotReached();
        finalized = true;
        snapshotBlock = block.number;
        emit GoalReached(totalYearsDonated, nameExpires(), block.number);
    }

    /// @notice Extend hoodfi.eth without earning slots. Open forever, including post-goal.
    function extend(uint256 numYears) external payable nonReentrant {
        uint256 paid = _renew(numYears);
        emit Extended(msg.sender, numYears, paid, nameExpires());
        _refundBalance();
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Live ETH cost to donate `numYears` (ENS oracle base + premium).
    function quote(uint256 numYears) public view returns (uint256) {
        (uint256 base, uint256 premium) = controller.rentPrice(PARENT_LABEL, numYears * YEAR);
        return base + premium;
    }

    /// @notice Current hoodfi.eth expiry straight from the official .eth registrar.
    function nameExpires() public view returns (uint256) {
        return baseRegistrar.nameExpires(parentTokenId);
    }

    function unusedSlots(address donor) external view returns (uint256) {
        return slots[donor] - usedSlots[donor];
    }

    /// @notice 0 = available, 1 = reserved, 2 = blocked, 3 = invalid/too short to reserve.
    function reservationStatus(string calldata label) external view returns (uint8) {
        if (!label.isReservableLabel()) return 3;
        bytes32 hash = label.labelhash();
        if (blocklisted[hash]) return 2;
        if (reservedBy[hash] != address(0)) return 1;
        return 0;
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setBlocklist(bytes32[] calldata labelhashes, bool blocked) external onlyOwner {
        for (uint256 i = 0; i < labelhashes.length; i++) {
            blocklisted[labelhashes[i]] = blocked;
            emit BlocklistUpdated(labelhashes[i], blocked);
        }
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _renew(uint256 numYears) internal returns (uint256 paid) {
        if (numYears == 0 || numYears > MAX_YEARS_PER_DONATION) revert InvalidYears();
        uint256 duration = numYears * YEAR;
        (uint256 base, uint256 premium) = controller.rentPrice(PARENT_LABEL, duration);
        paid = base + premium;
        if (msg.value < paid) revert InsufficientPayment(paid, msg.value);
        controller.renew{value: paid}(PARENT_LABEL, duration, bytes32(0));
    }

    function _reserve(string[] calldata labels) internal {
        if (labels.length == 0) return;
        if (usedSlots[msg.sender] + labels.length > slots[msg.sender]) revert NotEnoughSlots();
        usedSlots[msg.sender] += labels.length;

        for (uint256 i = 0; i < labels.length; i++) {
            string calldata label = labels[i];
            if (!label.isReservableLabel()) revert LabelNotReservable(label);
            bytes32 hash = label.labelhash();
            if (blocklisted[hash]) revert LabelBlocked(label);
            if (reservedBy[hash] != address(0)) revert LabelAlreadyReserved(label);
            reservedBy[hash] = msg.sender;
            emit NameReserved(msg.sender, hash, label);
        }
    }

    /// @dev Returns the full remaining balance (donor overpayment buffer + any controller
    ///      refund) to the caller, keeping this contract's balance at zero after every tx.
    function _refundBalance() internal {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok,) = msg.sender.call{value: bal}("");
            if (!ok) revert RefundFailed();
        }
    }
}
