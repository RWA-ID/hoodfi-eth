// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IL2Registry} from "../interfaces/IL2Registry.sol";
import {LabelUtils} from "./LabelUtils.sol";

interface IHoodfiRegistrar {
    function registerWithUsdc(string calldata label) external;
    function priceUsdc(uint256 tier) external view returns (uint256);
    function status(string calldata label) external view returns (uint8);
    function coinType() external view returns (uint256);
    function registry() external view returns (address);
    function usdc() external view returns (address);
}

/// @title HoodfiPartnerRouter
/// @notice Lets a platform resell *.hoodfi.eth names at its own price and keep the margin.
///
///         A partner self-registers a price and a payout address, embeds the widget, and
///         earns the difference between that price and our base fee on every sale. Buyers
///         pay once, in USDG, and receive the name directly.
///
///         The router is an ordinary caller of the registrar's public `registerWithUsdc`.
///         It is deliberately NOT a registrar: `L2Registry.onlyOwnerOrRegistrar` is binary,
///         and an approved registrar bypasses the blocklist, the tier prices and
///         `shortsOpen` entirely — it could mint `www` or drain the 1-3 character inventory
///         promised to donors. Nothing here needs that power, so nothing here asks for it.
///
///         4+ character names only. Short names stay with the donors who funded the parent
///         name until the 100-year goal opens them, and `tierOf(label) == 3` is enforced
///         here as well as in the registrar so a partner can never reach that inventory.
contract HoodfiPartnerRouter is Ownable, ReentrancyGuard, IERC721Receiver {
    using LabelUtils for string;
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    IHoodfiRegistrar public immutable registrar;
    IL2Registry public immutable registry;
    IERC20 public immutable usdc;
    /// @notice ENSIP-11 coinType, read from the registrar so the two can never disagree.
    uint256 public immutable coinType;
    /// @dev Only 4+ character names are sellable through a partner.
    uint256 private constant PUBLIC_TIER = 3;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The partner's asking price in USDG (6dp). Zero means inactive.
    mapping(address partner => uint256) public partnerPrice;
    /// @notice Display name, shown by the widget.
    mapping(address partner => string) public partnerName;
    /// @notice Where a partner's margin accrues. Set separately from the managing key so a
    ///         platform can configure from a hot wallet and be paid into a cold one.
    mapping(address partner => address) public partnerPayout;

    /// @notice Withdrawable balance, by payout address. Pull-payment: a partner whose payout
    ///         address reverts on receipt can never block a sale for everyone else.
    mapping(address payee => uint256) public earnings;
    /// @notice Sum of `earnings`. Anything above it is margin-free surplus the owner may sweep.
    uint256 public totalOwed;

    uint256 public platformFeeBps;
    uint256 public constant MAX_PLATFORM_FEE_BPS = 3000;
    address public platformTreasury;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PartnerUpdated(address indexed partner, uint256 price, string name, address payout);
    event PartnerRegistration(
        address indexed partner,
        address indexed buyer,
        bytes32 indexed node,
        string label,
        uint256 pricePaid,
        uint256 baseFee,
        uint256 partnerShare,
        uint256 platformCut
    );
    event Withdrawn(address indexed payee, uint256 amount);
    event PlatformFeeUpdated(uint256 bps);
    event PlatformTreasuryUpdated(address treasury);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error PriceBelowBaseFee(uint256 price, uint256 baseFee);
    error PayoutIsZero();
    error UnknownPartner(address partner);
    error NotAPublicName(string label);
    error NameNotAvailable(string label, uint8 status);
    error NothingToWithdraw();
    error FeeTooHigh(uint256 bps);
    error NothingToSweep();

    constructor(address _registrar, address _platformTreasury, uint256 _platformFeeBps, address _owner)
        Ownable(_owner)
    {
        if (_platformFeeBps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh(_platformFeeBps);
        registrar = IHoodfiRegistrar(_registrar);
        registry = IL2Registry(IHoodfiRegistrar(_registrar).registry());
        usdc = IERC20(IHoodfiRegistrar(_registrar).usdc());
        coinType = IHoodfiRegistrar(_registrar).coinType();
        platformTreasury = _platformTreasury;
        platformFeeBps = _platformFeeBps;
    }

    /*//////////////////////////////////////////////////////////////
                            PARTNER SETUP
    //////////////////////////////////////////////////////////////*/

    /// @notice Register or update your resale price, display name and payout address.
    /// @dev Permissionless by design — a platform onboards itself, no approval from us.
    ///      Setting `price` to 0 deactivates the partner without touching the payout
    ///      address, so accrued earnings stay withdrawable.
    function setPartner(uint256 price, string calldata name, address payout) external {
        uint256 baseFee = registrar.priceUsdc(PUBLIC_TIER);
        if (price != 0 && price < baseFee) revert PriceBelowBaseFee(price, baseFee);
        if (payout == address(0)) revert PayoutIsZero();
        partnerPrice[msg.sender] = price;
        partnerName[msg.sender] = name;
        partnerPayout[msg.sender] = payout;
        emit PartnerUpdated(msg.sender, price, name, payout);
    }

    /*//////////////////////////////////////////////////////////////
                             REGISTRATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Buy a name at `partner`'s price. Requires a prior USDG approval for that price.
    /// @param label   The name to register, 4+ characters.
    /// @param partner The platform whose price applies and whose margin this credits.
    function registerViaPartner(string calldata label, address partner) external nonReentrant {
        uint256 price = partnerPrice[partner];
        if (price == 0) revert UnknownPartner(partner);

        // 4+ characters only, checked here as well as in the registrar. `tierOf` returns 3
        // for every label of length >= 4, and length-1 below that.
        if (label.tierOf() != PUBLIC_TIER) revert NotAPublicName(label);

        // Fail early with a useful reason rather than deep inside the registrar. Status 0 is
        // available; 1 taken, 2 locked, 3 invalid, 4 blocked.
        uint8 nameStatus = registrar.status(label);
        if (nameStatus != 0) revert NameNotAvailable(label, nameStatus);

        uint256 baseFee = registrar.priceUsdc(PUBLIC_TIER);
        if (price < baseFee) revert PriceBelowBaseFee(price, baseFee);

        // Take the buyer's money, then let the registrar pull its fee straight back out of
        // this contract. `forceApprove` because the allowance is expected to be zero here and
        // a non-standard token could revert on a plain re-approve.
        usdc.safeTransferFrom(msg.sender, address(this), price);
        usdc.forceApprove(address(registrar), baseFee);

        // Mints to this router — `registerWithUsdc` always mints to its caller — and points
        // the name's addr records at this router as a side effect.
        registrar.registerWithUsdc(label);

        bytes32 node = registry.makeNode(registry.baseNode(), label);

        // THE STEP THAT CANNOT BE SKIPPED. `HoodfiRegistrar._register` sets addr records to
        // whoever it minted to, which is this router. Transfer the NFT without this and the
        // buyer owns a name that resolves to the router's address forever — and once the NFT
        // is gone the router is no longer authorised and can never fix it. There is no
        // transfer hook in L2Registry, so nothing repairs this after the fact.
        bytes memory buyerAddr = abi.encodePacked(msg.sender);
        registry.setAddr(node, coinType, buyerAddr);
        registry.setAddr(node, 60, buyerAddr);

        // Effects before the final external call.
        uint256 margin = price - baseFee;
        uint256 platformCut = (margin * platformFeeBps) / 10_000;
        uint256 partnerShare = margin - platformCut;
        if (partnerShare > 0) {
            earnings[partnerPayout[partner]] += partnerShare;
        }
        if (platformCut > 0) {
            earnings[platformTreasury] += platformCut;
        }
        totalOwed += margin;

        registry.safeTransferFrom(address(this), msg.sender, uint256(node));

        emit PartnerRegistration(
            partner, msg.sender, node, label, price, baseFee, partnerShare, platformCut
        );
    }

    /// @dev The registrar's `_safeMint` lands here, inside its own `nonReentrant` register
    ///      call. Return the selector and do nothing else — any call back into the registrar
    ///      from here would revert the whole registration.
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /*//////////////////////////////////////////////////////////////
                             WITHDRAWALS
    //////////////////////////////////////////////////////////////*/

    /// @notice Withdraw everything credited to the caller.
    function withdraw() external nonReentrant {
        uint256 amount = earnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        earnings[msg.sender] = 0;
        totalOwed -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                               VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Everything the widget needs about a partner, in one call.
    function partnerInfo(address partner)
        external
        view
        returns (uint256 price, string memory name, address payout, uint256 baseFee, uint256 accrued)
    {
        payout = partnerPayout[partner];
        return (
            partnerPrice[partner],
            partnerName[partner],
            payout,
            registrar.priceUsdc(PUBLIC_TIER),
            earnings[payout]
        );
    }

    /// @notice What a specific name would cost through a partner, and whether it can be sold.
    /// @return price     Total USDG the buyer approves and pays.
    /// @return baseFee   Our share of it.
    /// @return sellable  True only if the partner is active, the name is 4+ chars and free.
    /// @return nameStatus Registrar status code, for a precise message in the widget.
    function quote(string calldata label, address partner)
        external
        view
        returns (uint256 price, uint256 baseFee, bool sellable, uint8 nameStatus)
    {
        price = partnerPrice[partner];
        baseFee = registrar.priceUsdc(PUBLIC_TIER);
        nameStatus = registrar.status(label);
        sellable = price >= baseFee && price != 0 && label.tierOf() == PUBLIC_TIER && nameStatus == 0;
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/

    function setPlatformFee(uint256 bps) external onlyOwner {
        if (bps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh(bps);
        platformFeeBps = bps;
        emit PlatformFeeUpdated(bps);
    }

    function setPlatformTreasury(address treasury) external onlyOwner {
        if (treasury == address(0)) revert PayoutIsZero();
        platformTreasury = treasury;
        emit PlatformTreasuryUpdated(treasury);
    }

    /// @notice Recover USDG that is not owed to anyone — a stray transfer, or dust from a
    ///         rounding split. Can never touch partner earnings.
    function sweep(address to) external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 owed = totalOwed;
        if (balance <= owed) revert NothingToSweep();
        usdc.safeTransfer(to, balance - owed);
    }
}
