// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IL2Registry} from "../interfaces/IL2Registry.sol";
import {LabelUtils} from "./LabelUtils.sol";

/// @title HoodfiRegistrar
/// @notice Phase-aware registrar for *.hoodfi.eth on Robinhood Chain.
///         Claim phase: donors from the L1 snapshot mint their reserved names free.
///         Public phase: anyone mints at length-tiered prices, in ETH or USDC.
///         Names are lifetime ERC-721s — no expiry, no renewals.
contract HoodfiRegistrar is Ownable, ReentrancyGuard {
    using LabelUtils for string;
    using SafeERC20 for IERC20;

    enum Phase {
        Paused,
        Claim,
        Public
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    IL2Registry public immutable registry;
    /// @notice ENSIP-11 coinType for this chain (0x80000000 | 4663 on Robinhood Chain).
    uint256 public immutable coinType;
    /// @notice Reserved-but-unclaimed names stay blocked this long after claims open.
    uint256 public constant RELEASE_DELAY = 30 days;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    Phase public phase;
    uint256 public claimOpenedAt;

    /// @notice labelhash => donor, copied from the L1 HoodfiDonations snapshot.
    ///         Cleared on claim or release.
    mapping(bytes32 labelhash => address donor) public reservations;

    /// @notice Prices by tier: [0] 1 char, [1] 2 chars, [2] 3 chars, [3] 4+ chars.
    uint256[4] public priceWei;
    /// @dev USDC has 6 decimals; launch defaults 15/10/5/3 dollars.
    uint256[4] public priceUsdc;

    IERC20 public usdc;
    address public treasury;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PhaseChanged(Phase phase);
    event ReservationsLoaded(uint256 count);
    event ReservationReleased(bytes32 indexed labelhash);
    event Claimed(address indexed owner, bytes32 indexed labelhash, string label);
    event Registered(
        address indexed owner, bytes32 indexed labelhash, string label, uint256 price, bool paidInUsdc
    );
    event PricesUpdated(uint256[4] priceWei, uint256[4] priceUsdc);
    event UsdcUpdated(address usdc);
    event TreasuryUpdated(address treasury);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error WrongPhase();
    error InvalidLabel(string label);
    error NotReservedForYou(string label);
    error LabelReserved(string label);
    error InsufficientPayment(uint256 required, uint256 provided);
    error UsdcNotConfigured();
    error ReleaseTooEarly();
    error LengthMismatch();
    error RefundFailed();

    constructor(address _registry, address _treasury, uint256[4] memory _priceWei, address _owner)
        Ownable(_owner)
    {
        registry = IL2Registry(_registry);
        coinType = 0x80000000 | block.chainid;
        treasury = _treasury;
        priceWei = _priceWei;
        priceUsdc = [uint256(15e6), 10e6, 5e6, 3e6];
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Free claim of a name reserved via L1 donation. Only L2 gas.
    ///         Open during both Claim and Public phases.
    function claim(string calldata label) external {
        if (phase == Phase.Paused) revert WrongPhase();
        bytes32 hash = label.labelhash();
        if (reservations[hash] != msg.sender) revert NotReservedForYou(label);
        delete reservations[hash];
        _register(label, msg.sender);
        emit Claimed(msg.sender, hash, label);
    }

    /// @notice Public mint paying in ETH at the tier price. Excess is refunded.
    function register(string calldata label) external payable nonReentrant {
        bytes32 hash = _checkPublicRegistrable(label);
        uint256 price = priceWei[label.tierOf()];
        if (msg.value < price) revert InsufficientPayment(price, msg.value);
        _register(label, msg.sender);
        emit Registered(msg.sender, hash, label, price, false);
        if (msg.value > price) {
            (bool ok,) = msg.sender.call{value: msg.value - price}("");
            if (!ok) revert RefundFailed();
        }
    }

    /// @notice Public mint paying in USDC at the tier price (requires prior approve).
    function registerWithUsdc(string calldata label) external nonReentrant {
        if (address(usdc) == address(0)) revert UsdcNotConfigured();
        bytes32 hash = _checkPublicRegistrable(label);
        uint256 price = priceUsdc[label.tierOf()];
        usdc.safeTransferFrom(msg.sender, treasury, price);
        _register(label, msg.sender);
        emit Registered(msg.sender, hash, label, price, true);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice 0 = available, 1 = taken, 2 = reserved for a donor, 3 = invalid label.
    function status(string calldata label) external view returns (uint8) {
        if (!label.isValidLabel()) return 3;
        bytes32 node = registry.makeNode(registry.baseNode(), label);
        try registry.ownerOf(uint256(node)) returns (address) {
            return 1;
        } catch {}
        if (reservations[label.labelhash()] != address(0)) return 2;
        return 0;
    }

    /// @notice ETH and USDC price for a label (0s if invalid).
    function priceOf(string calldata label) external view returns (uint256 weiPrice, uint256 usdcPrice) {
        if (!label.isValidLabel()) return (0, 0);
        uint256 tier = label.tierOf();
        return (priceWei[tier], priceUsdc[tier]);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Load the L1 reservation snapshot. Only while Paused, before claims open.
    ///         Anyone can verify the loaded set against L1 NameReserved events.
    function loadReservations(bytes32[] calldata labelhashes, address[] calldata owners)
        external
        onlyOwner
    {
        if (phase != Phase.Paused) revert WrongPhase();
        if (labelhashes.length != owners.length) revert LengthMismatch();
        for (uint256 i = 0; i < labelhashes.length; i++) {
            reservations[labelhashes[i]] = owners[i];
        }
        emit ReservationsLoaded(labelhashes.length);
    }

    function setPhase(Phase _phase) external onlyOwner {
        phase = _phase;
        if (_phase == Phase.Claim && claimOpenedAt == 0) {
            claimOpenedAt = block.timestamp;
        }
        emit PhaseChanged(_phase);
    }

    /// @notice Release reserved-but-unclaimed names to the public pool, 30+ days after
    ///         claims opened.
    function releaseUnclaimed(bytes32[] calldata labelhashes) external onlyOwner {
        if (claimOpenedAt == 0 || block.timestamp < claimOpenedAt + RELEASE_DELAY) {
            revert ReleaseTooEarly();
        }
        for (uint256 i = 0; i < labelhashes.length; i++) {
            if (reservations[labelhashes[i]] != address(0)) {
                delete reservations[labelhashes[i]];
                emit ReservationReleased(labelhashes[i]);
            }
        }
    }

    function setPrices(uint256[4] calldata _priceWei, uint256[4] calldata _priceUsdc)
        external
        onlyOwner
    {
        priceWei = _priceWei;
        priceUsdc = _priceUsdc;
        emit PricesUpdated(_priceWei, _priceUsdc);
    }

    function setUsdc(address _usdc) external onlyOwner {
        usdc = IERC20(_usdc);
        emit UsdcUpdated(_usdc);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @notice Sweep ETH mint proceeds to the treasury. Callable by anyone.
    function withdraw() external {
        (bool ok,) = treasury.call{value: address(this).balance}("");
        if (!ok) revert RefundFailed();
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _checkPublicRegistrable(string calldata label) internal view returns (bytes32 hash) {
        if (phase != Phase.Public) revert WrongPhase();
        if (!label.isValidLabel()) revert InvalidLabel(label);
        hash = label.labelhash();
        if (reservations[hash] != address(0)) revert LabelReserved(label);
    }

    /// @dev Mirrors Durin's example registrar: set forward addrs for this chain's
    ///      coinType (needed for L2 reverse resolution later) and mainnet ETH, then mint.
    ///      The registry reverts on duplicate mints, so no availability pre-check needed.
    function _register(string calldata label, address owner) internal {
        bytes32 node = registry.makeNode(registry.baseNode(), label);
        bytes memory addr = abi.encodePacked(owner);
        registry.setAddr(node, coinType, addr);
        registry.setAddr(node, 60, addr);
        registry.createSubnode(registry.baseNode(), label, owner, new bytes[](0));
    }
}
