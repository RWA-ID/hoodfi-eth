// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {IL2Registry} from "../interfaces/IL2Registry.sol";
import {LabelUtils} from "./LabelUtils.sol";

/// @title HoodfiRegistrar
/// @notice Registrar for *.hoodfi.eth on Robinhood Chain.
///
///         Names 4 characters and up mint publicly at tier prices, in ETH or USDG.
///
///         Names of 1-3 characters are premium inventory. Until the 100-year donation
///         goal is reached on L1 they can only be minted by donors spending short-name
///         credits (1 credit per year donated), proven by a signed voucher. Once the
///         goal is reached the owner flips `shortsOpen` and anyone may mint them at the
///         tier price; credits still mint free, so they never lose their value.
///
///         Names are lifetime ERC-721s — no expiry, no renewals.
contract HoodfiRegistrar is Ownable, ReentrancyGuard {
    using LabelUtils for string;
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    IL2Registry public immutable registry;
    /// @notice ENSIP-11 coinType for this chain (0x80000000 | 4663 on Robinhood Chain).
    uint256 public immutable coinType;
    /// @notice Shortest label anyone can mint without a credit, before the goal.
    uint256 public constant PUBLIC_MIN_LENGTH = 4;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Emergency stop for all minting.
    bool public paused;

    /// @notice Flipped by the owner once HoodfiDonations hits its 100-year goal.
    ///         Opens 1-3 character names to public minting at tier prices.
    bool public shortsOpen;

    /// @notice Address whose signature attests L1 short-name credit balances.
    address public creditSigner;

    /// @notice Short-name credits already spent, per donor. Compared against the
    ///         cumulative total attested by the voucher, which only ever grows —
    ///         so a stale voucher can never mint more than its attested total.
    mapping(address donor => uint256) public creditsSpent;

    /// @notice Infra labels that can never be minted (www, api, admin, ...).
    mapping(bytes32 labelhash => bool) public blocklisted;

    /// @notice Prices by tier: [0] 1 char, [1] 2 chars, [2] 3 chars, [3] 4+ chars.
    uint256[4] public priceWei;
    /// @dev USDG has 6 decimals; launch defaults 15/10/5/3 dollars.
    uint256[4] public priceUsdc;

    IERC20 public usdc;
    address public treasury;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PausedSet(bool paused);
    event ShortsOpened();
    event CreditSignerUpdated(address signer);
    event BlocklistUpdated(bytes32 indexed labelhash, bool blocked);
    event Registered(
        address indexed owner, bytes32 indexed labelhash, string label, uint256 price, bool paidInUsdc
    );
    event ShortClaimed(
        address indexed owner, bytes32 indexed labelhash, string label, uint256 creditsSpent
    );
    event PricesUpdated(uint256[4] priceWei, uint256[4] priceUsdc);
    event UsdcUpdated(address usdc);
    event TreasuryUpdated(address treasury);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error MintingPaused();
    error InvalidLabel(string label);
    error LabelBlocked(string label);
    error ShortNameLocked(string label);
    error NotAShortName(string label);
    error InsufficientPayment(uint256 required, uint256 provided);
    error UsdcNotConfigured();
    error NoCreditsLeft(uint256 attested, uint256 spent);
    error VoucherExpired(uint256 expiry);
    error BadVoucher();
    error SignerNotConfigured();
    error RefundFailed();

    constructor(
        address _registry,
        address _treasury,
        address _creditSigner,
        uint256[4] memory _priceWei,
        address _owner
    ) Ownable(_owner) {
        registry = IL2Registry(_registry);
        coinType = 0x80000000 | block.chainid;
        treasury = _treasury;
        creditSigner = _creditSigner;
        priceWei = _priceWei;
        priceUsdc = [uint256(15e6), 10e6, 5e6, 3e6];
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Public mint paying in ETH at the tier price. Excess is refunded.
    function register(string calldata label) external payable nonReentrant {
        bytes32 hash = _checkRegistrable(label);
        uint256 price = priceWei[label.tierOf()];
        if (msg.value < price) revert InsufficientPayment(price, msg.value);
        _register(label, msg.sender);
        emit Registered(msg.sender, hash, label, price, false);
        if (msg.value > price) {
            (bool ok,) = msg.sender.call{value: msg.value - price}("");
            if (!ok) revert RefundFailed();
        }
    }

    /// @notice Public mint paying in USDG at the tier price (requires prior approve).
    function registerWithUsdc(string calldata label) external nonReentrant {
        if (address(usdc) == address(0)) revert UsdcNotConfigured();
        bytes32 hash = _checkRegistrable(label);
        uint256 price = priceUsdc[label.tierOf()];
        usdc.safeTransferFrom(msg.sender, treasury, price);
        _register(label, msg.sender);
        emit Registered(msg.sender, hash, label, price, true);
    }

    /// @notice Mint a 1-3 character name for free by spending a short-name credit earned
    ///         by donating years to hoodfi.eth on mainnet.
    /// @param label          The short name to mint.
    /// @param totalCredits   Cumulative credits earned on L1, as attested by the signer.
    /// @param expiry         Unix timestamp after which the voucher is no longer accepted.
    /// @param signature      `creditSigner`'s EIP-191 signature over the voucher digest.
    function mintShortWithVoucher(
        string calldata label,
        uint256 totalCredits,
        uint256 expiry,
        bytes calldata signature
    ) external nonReentrant {
        if (paused) revert MintingPaused();
        if (!label.isValidLabel()) revert InvalidLabel(label);
        if (label.tierOf() == 3) revert NotAShortName(label);

        bytes32 hash = label.labelhash();
        if (blocklisted[hash]) revert LabelBlocked(label);

        _verifyVoucher(msg.sender, totalCredits, expiry, signature);

        uint256 spent = creditsSpent[msg.sender];
        if (spent >= totalCredits) revert NoCreditsLeft(totalCredits, spent);
        unchecked {
            creditsSpent[msg.sender] = spent + 1;
        }

        _register(label, msg.sender);
        emit ShortClaimed(msg.sender, hash, label, spent + 1);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice 0 = available, 1 = taken, 2 = locked (short, pre-goal), 3 = invalid label,
    ///         4 = blocked.
    function status(string calldata label) external view returns (uint8) {
        if (!label.isValidLabel()) return 3;
        bytes32 node = registry.makeNode(registry.baseNode(), label);
        try registry.ownerOf(uint256(node)) returns (address) {
            return 1;
        } catch {}
        if (blocklisted[label.labelhash()]) return 4;
        if (label.tierOf() != 3 && !shortsOpen) return 2;
        return 0;
    }

    /// @notice ETH and USDG price for a label (0s if invalid).
    function priceOf(string calldata label) external view returns (uint256 weiPrice, uint256 usdcPrice) {
        if (!label.isValidLabel()) return (0, 0);
        uint256 tier = label.tierOf();
        return (priceWei[tier], priceUsdc[tier]);
    }

    /// @notice Credits still spendable, given a cumulative total attested off-chain.
    function creditsAvailable(address donor, uint256 totalCredits) external view returns (uint256) {
        uint256 spent = creditsSpent[donor];
        return totalCredits > spent ? totalCredits - spent : 0;
    }

    /// @notice Digest a voucher must be signed over. Exposed so the gateway and any
    ///         auditor can reproduce it exactly.
    function voucherDigest(address donor, uint256 totalCredits, uint256 expiry)
        public
        view
        returns (bytes32)
    {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(address(this), block.chainid, donor, totalCredits, expiry))
        );
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Open 1-3 character names to public minting. One-way — call once the
    ///         L1 donation drive reaches its 100-year goal.
    function openShorts() external onlyOwner {
        shortsOpen = true;
        emit ShortsOpened();
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setCreditSigner(address _signer) external onlyOwner {
        creditSigner = _signer;
        emit CreditSignerUpdated(_signer);
    }

    function setBlocklist(bytes32[] calldata labelhashes, bool blocked) external onlyOwner {
        for (uint256 i = 0; i < labelhashes.length; i++) {
            blocklisted[labelhashes[i]] = blocked;
            emit BlocklistUpdated(labelhashes[i], blocked);
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

    function _verifyVoucher(
        address donor,
        uint256 totalCredits,
        uint256 expiry,
        bytes calldata signature
    ) internal view {
        address signer = creditSigner;
        if (signer == address(0)) revert SignerNotConfigured();
        if (block.timestamp > expiry) revert VoucherExpired(expiry);
        (address recovered, ECDSA.RecoverError err,) =
            ECDSA.tryRecover(voucherDigest(donor, totalCredits, expiry), signature);
        if (err != ECDSA.RecoverError.NoError || recovered != signer) revert BadVoucher();
    }

    /// @dev Shared gate for the two paid public mint paths.
    function _checkRegistrable(string calldata label) internal view returns (bytes32 hash) {
        if (paused) revert MintingPaused();
        if (!label.isValidLabel()) revert InvalidLabel(label);
        hash = label.labelhash();
        if (blocklisted[hash]) revert LabelBlocked(label);
        // Short names stay locked to credit holders until the goal is reached.
        if (label.tierOf() != 3 && !shortsOpen) revert ShortNameLocked(label);
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
