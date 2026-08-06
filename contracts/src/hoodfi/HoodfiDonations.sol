// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
/// @notice Trustless donation tracker for hoodfi.eth. Every donation atomically renews
///         hoodfi.eth on the official ENS controller inside the donor's own transaction;
///         this contract never holds funds.
///
///         1 year donated = 1 short-name credit, spendable on any 1-, 2- or 3-character
///         *.hoodfi.eth name. Credits are the *only* way to mint a short name until the
///         100-year goal is reached, after which short names open to everyone.
///
/// @dev Credits are spent on Robinhood Chain, not here. This contract is the source of
///      truth for how many credits an address has *earned*; HoodfiRegistrar tracks how
///      many it has *spent*. The gateway signs a voucher attesting `shortCredits(addr)`
///      and the registrar mints while spent < attested. Because the attested figure is
///      cumulative and monotonically increasing, vouchers are inherently replay-safe.
contract HoodfiDonations is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    string public constant PARENT_LABEL = "hoodfi";
    /// @notice Years of expiry that must be donated before short names open to the public.
    uint256 public constant GOAL_YEARS = 100;
    uint256 public constant YEAR = 365 days;
    /// @dev Upper bound per tx keeps duration math far from overflow and quotes sane.
    uint256 public constant MAX_YEARS_PER_DONATION = 100;

    IETHRegistrarController public immutable controller;
    IBaseRegistrar public immutable baseRegistrar;
    /// @dev uint256(keccak256("hoodfi")) — token id on the .eth base registrar.
    uint256 public immutable parentTokenId;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 public totalYearsDonated;
    uint256 public totalDonations;
    bool public finalized;
    uint256 public snapshotBlock;

    /// @notice Short-name credits earned, cumulative and never decreasing.
    ///         Spending happens on L2; this figure is what the voucher attests.
    mapping(address donor => uint256) public shortCredits;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Donated(
        address indexed donor,
        uint256 numYears,
        uint256 ethPaid,
        uint256 newExpiry,
        uint256 creditsTotal,
        uint256 totalYears
    );
    event GoalReached(uint256 totalYears, uint256 finalExpiry, uint256 snapshotBlock);
    event Extended(address indexed supporter, uint256 numYears, uint256 ethPaid, uint256 newExpiry);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error AlreadyFinalized();
    error GoalNotReached();
    error InvalidYears();
    error InsufficientPayment(uint256 required, uint256 provided);
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
    ///         controller in this same transaction and credits 1 short-name credit per year.
    /// @param numYears Whole years to add to hoodfi.eth's expiry.
    function donate(uint256 numYears) external payable nonReentrant {
        uint256 paid = _renew(numYears);

        totalYearsDonated += numYears;
        totalDonations += 1;
        uint256 credits = shortCredits[msg.sender] + numYears;
        shortCredits[msg.sender] = credits;

        emit Donated(msg.sender, numYears, paid, nameExpires(), credits, totalYearsDonated);

        _refundBalance();
    }

    /// @notice Freeze the drive once the 100-year goal is reached. Callable by anyone.
    ///         Purely a public marker — donations and credits keep working either way.
    function finalize() external {
        if (finalized) revert AlreadyFinalized();
        if (totalYearsDonated < GOAL_YEARS) revert GoalNotReached();
        finalized = true;
        snapshotBlock = block.number;
        emit GoalReached(totalYearsDonated, nameExpires(), block.number);
    }

    /// @notice Extend hoodfi.eth without earning credits. Open forever, including post-goal.
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

    /// @notice True once enough years are donated, whether or not `finalize()` was called.
    function goalReached() public view returns (bool) {
        return totalYearsDonated >= GOAL_YEARS;
    }

    /// @notice Years still needed to hit the goal (0 once reached).
    function yearsRemaining() external view returns (uint256) {
        uint256 total = totalYearsDonated;
        return total >= GOAL_YEARS ? 0 : GOAL_YEARS - total;
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
