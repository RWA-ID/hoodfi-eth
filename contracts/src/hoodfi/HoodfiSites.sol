// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IL2Registry} from "../interfaces/IL2Registry.sol";

/// @title HoodfiSites
/// @notice The paywall behind build.hoodfi.name.
///
///         A HoodFi name owner pays once to publish a website on that name, and less to
///         republish it later. What a payment buys is one specific site — the CID is part
///         of the transaction — so there is no credit to meter, nothing to decrement, and
///         nobody who has to hold a key to mark a payment used. "Has this been paid for"
///         is a pure read, answerable by anyone.
///
///         The alternative was a credit counter spent by a trusted recorder, which would
///         have meant giving the gateway a funded hot key purely to write down something
///         the payer could just as well have said themselves.
///
///         This contract never touches the name itself. It sells the right to have a
///         site pinned and takes no authority over the contenthash record — the owner
///         writes that themselves, from their own wallet, on the registry. All this
///         answers is "has publishing been paid for on this node", which the gateway
///         reads before it pins anything.
///
///         Templates can be supplied by NFT projects rather than by us. A template may
///         name a collection, in which case only holders of it may publish with that
///         template, and a payee, who earns a share of every publish that uses it.
///         Because the collections live on this same chain, holdership is checked here
///         directly — there is no attestation to sign, expire or forge.
contract HoodfiSites is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    IL2Registry public immutable registry;

    /// @notice Longest CID we will store. Comfortably past a CIDv1 base32 (59 chars) and
    ///         an IPNS base36 key, and short enough that nobody can bloat storage with a
    ///         megabyte of calldata dressed as an address.
    uint256 public constant MAX_CID_LENGTH = 128;

    /// @notice Ceiling on a partner's cut. Not a business rule so much as a guard: an
    ///         input of 100000 where 10000 was meant would otherwise pay out ten times
    ///         the price and leave the treasury owed a negative number.
    uint16 public constant MAX_SHARE_BPS = 5000;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Template {
        /// @notice Who earns from this template. Zero for a house template.
        address payee;
        /// @notice Collection whose holders may use it. Zero means anyone may.
        address collection;
        /// @notice Payee's cut in basis points. 3000 = 30%.
        uint16 shareBps;
        /// @notice Off switch. A template can be withdrawn without a redeploy, which is
        ///         the whole reason partner-supplied designs are safe to accept at all.
        bool active;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Emergency stop for all publishing.
    bool public paused;

    /// @notice Sites paid for, by name and by content hash of the CID.
    ///
    ///         Single-use falls out of the shape: a given CID on a given name is paid for
    ///         exactly once, and the second attempt is refused rather than charged. The
    ///         gateway pins when this reads true, which needs no cooperation from us.
    mapping(bytes32 node => mapping(bytes32 cidHash => bool)) public paidFor;

    /// @notice How many sites have been published on a name. Zero means the next one is
    ///         the first, which is what separates the two prices.
    mapping(bytes32 node => uint256) public publishes;

    mapping(bytes32 templateId => Template) public templates;

    /// @notice Withdrawable balances. Partners and the treasury are both payees here —
    ///         there is no separate sweep path, so no way for the two to disagree about
    ///         who owns the contract's balance.
    mapping(address payee => uint256) public owedEth;
    mapping(address payee => uint256) public owedUsdg;

    /// @notice Price of the first publish on a name, and of every one after.
    ///         Both launch at zero: the paid path runs from day one with nothing to pay,
    ///         so what ships on launch day is the path that has already been exercised
    ///         rather than a branch that was skipped during testing.
    uint256 public firstPriceWei;
    uint256 public republishPriceWei;
    /// @dev USDG has 6 decimals.
    uint256 public firstPriceUsdg;
    uint256 public republishPriceUsdg;

    IERC20 public usdg;
    address public treasury;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PausedSet(bool paused);
    event TreasuryUpdated(address treasury);
    event UsdgUpdated(address usdg);
    event TemplateUpdated(
        bytes32 indexed templateId, address payee, address collection, uint16 shareBps, bool active
    );
    event PricesUpdated(
        uint256 firstWei, uint256 republishWei, uint256 firstUsdg, uint256 republishUsdg
    );
    event Published(
        bytes32 indexed node,
        bytes32 indexed templateId,
        address indexed payer,
        string cid,
        uint256 price,
        bool paidInUsdg,
        uint256 partnerShare
    );
    event Withdrawn(address indexed payee, uint256 eth, uint256 usdg);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error PublishingPaused();
    error NotNameOwner(bytes32 node);
    error UnknownTemplate(bytes32 templateId);
    error TemplateInactive(bytes32 templateId);
    error CollectionRequired(bytes32 templateId, address collection);
    error InsufficientPayment(uint256 required, uint256 provided);
    error UsdgNotConfigured();
    error ShareTooHigh(uint16 shareBps, uint16 max);
    error PayeeRequired();
    error EmptyCid();
    error CidTooLong(uint256 length, uint256 max);
    error AlreadyPaid(bytes32 node, string cid);
    error NothingOwed();
    error RefundFailed();
    error WithdrawFailed();

    constructor(address _registry, address _treasury, address _owner) Ownable(_owner) {
        registry = IL2Registry(_registry);
        treasury = _treasury;
        // Every price starts at zero. See the note on the price fields.
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Buy a publish on `node` using `templateId`, paying in ETH.
    /// @dev Excess is refunded, which matters most when the price is zero: a wallet that
    ///      guesses at value should not silently donate it.
    function publish(bytes32 node, bytes32 templateId, string calldata cid)
        external
        payable
        nonReentrant
    {
        (uint256 price, Template memory t) = _check(node, templateId, cid, false);
        if (msg.value < price) revert InsufficientPayment(price, msg.value);

        uint256 partnerShare = _record(node, t, cid, price, false);

        if (msg.value > price) {
            (bool ok,) = msg.sender.call{value: msg.value - price}("");
            if (!ok) revert RefundFailed();
        }

        emit Published(node, templateId, msg.sender, cid, price, false, partnerShare);
    }

    /// @notice Buy a publish on `node` using `templateId`, paying in USDG.
    function publishWithUsdg(bytes32 node, bytes32 templateId, string calldata cid)
        external
        nonReentrant
    {
        if (address(usdg) == address(0)) revert UsdgNotConfigured();
        (uint256 price, Template memory t) = _check(node, templateId, cid, true);

        // Pulled into the contract rather than split at the door, so both currencies
        // settle through the same withdraw path.
        if (price > 0) usdg.safeTransferFrom(msg.sender, address(this), price);

        uint256 partnerShare = _record(node, t, cid, price, true);
        emit Published(node, templateId, msg.sender, cid, price, true, partnerShare);
    }

    /// @notice Withdraw everything owed to the caller, in both currencies.
    /// @dev Pull, not push. A payee that reverts on receive — a Safe with a strict
    ///      fallback, a contract that got upgraded badly — would otherwise brick
    ///      publishing for that partner's entire community, and it would present as
    ///      "the builder is down" rather than as one bad address.
    function withdraw() external nonReentrant {
        uint256 eth = owedEth[msg.sender];
        uint256 usd = owedUsdg[msg.sender];
        if (eth == 0 && usd == 0) revert NothingOwed();

        owedEth[msg.sender] = 0;
        owedUsdg[msg.sender] = 0;

        if (usd > 0) usdg.safeTransfer(msg.sender, usd);
        if (eth > 0) {
            (bool ok,) = msg.sender.call{value: eth}("");
            if (!ok) revert WithdrawFailed();
        }
        emit Withdrawn(msg.sender, eth, usd);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice What `node` would pay next, in both currencies, and whether it may.
    /// @dev One call for the whole UI state. A frontend that assembled this from four
    ///      reads could show a price from one block and an eligibility from another.
    function quote(bytes32 node, bytes32 templateId, address buyer)
        external
        view
        returns (uint256 weiPrice, uint256 usdgPrice, bool eligible, uint256 publishCount)
    {
        Template memory t = templates[templateId];
        bool first = publishes[node] == 0;
        weiPrice = first ? firstPriceWei : republishPriceWei;
        usdgPrice = first ? firstPriceUsdg : republishPriceUsdg;
        eligible = t.active && (t.collection == address(0) || _holds(t.collection, buyer));
        publishCount = publishes[node];
    }

    /// @notice Whether this exact site has been paid for on this name.
    ///
    ///         The gateway's whole authorisation check, and a plain read — no signature,
    ///         no shared secret, no cooperation from us. Anyone can verify that a pinned
    ///         site was paid for, which is a property the credit-counter design did not
    ///         have.
    function isPaid(bytes32 node, string calldata cid) external view returns (bool) {
        return paidFor[node][keccak256(bytes(cid))];
    }

    /// @notice Whether `buyer` may use `templateId`. Drives the auto-detect on connect,
    ///         batched across every registered template through Multicall3.
    function canUseTemplate(bytes32 templateId, address buyer) external view returns (bool) {
        Template memory t = templates[templateId];
        if (!t.active) return false;
        return t.collection == address(0) || _holds(t.collection, buyer);
    }

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add, edit or retire a template.
    /// @dev Curated by hand on purpose. `collection` is called during publish, so an
    ///      arbitrary address here is an arbitrary external call in a payment path —
    ///      which is exactly why partner collections are added one at a time by the
    ///      owner rather than registered permissionlessly.
    function setTemplate(
        bytes32 templateId,
        address payee,
        address collection,
        uint16 shareBps,
        bool active
    ) external onlyOwner {
        if (shareBps > MAX_SHARE_BPS) revert ShareTooHigh(shareBps, MAX_SHARE_BPS);
        if (shareBps > 0 && payee == address(0)) revert PayeeRequired();

        templates[templateId] =
            Template({payee: payee, collection: collection, shareBps: shareBps, active: active});
        emit TemplateUpdated(templateId, payee, collection, shareBps, active);
    }

    function setPrices(
        uint256 _firstWei,
        uint256 _republishWei,
        uint256 _firstUsdg,
        uint256 _republishUsdg
    ) external onlyOwner {
        firstPriceWei = _firstWei;
        republishPriceWei = _republishWei;
        firstPriceUsdg = _firstUsdg;
        republishPriceUsdg = _republishUsdg;
        emit PricesUpdated(_firstWei, _republishWei, _firstUsdg, _republishUsdg);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setUsdg(address _usdg) external onlyOwner {
        usdg = IERC20(_usdg);
        emit UsdgUpdated(_usdg);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Every condition that must hold before money moves, in one place so the ETH
    ///      and USDG paths cannot drift apart.
    function _check(bytes32 node, bytes32 templateId, string calldata cid, bool usdgPath)
        internal
        view
        returns (uint256 price, Template memory t)
    {
        if (paused) revert PublishingPaused();

        uint256 cidLength = bytes(cid).length;
        if (cidLength == 0) revert EmptyCid();
        if (cidLength > MAX_CID_LENGTH) revert CidTooLong(cidLength, MAX_CID_LENGTH);
        // Paying twice for the same site is always a mistake — a double-submit, or a
        // retry of a transaction that already landed. Refusing costs the sender gas;
        // accepting costs them the price of a publish they already own.
        if (paidFor[node][keccak256(bytes(cid))]) revert AlreadyPaid(node, cid);

        // Owning the name is the whole basis of the purchase. Without this, anyone could
        // buy credits against someone else's name — harmless in itself, but it would let
        // a stranger flip `published` and put that name onto the republish price forever.
        if (registry.owner(node) != msg.sender) revert NotNameOwner(node);

        t = templates[templateId];
        // An unset template reads as all-zero, which is inactive — so an unknown id and
        // a retired one are separated here for the sake of the error message.
        if (t.payee == address(0) && t.collection == address(0) && t.shareBps == 0 && !t.active) {
            revert UnknownTemplate(templateId);
        }
        if (!t.active) revert TemplateInactive(templateId);
        if (t.collection != address(0) && !_holds(t.collection, msg.sender)) {
            revert CollectionRequired(templateId, t.collection);
        }

        bool first = publishes[node] == 0;
        price = usdgPath
            ? (first ? firstPriceUsdg : republishPriceUsdg)
            : (first ? firstPriceWei : republishPriceWei);
    }

    /// @dev Records the paid site and splits the proceeds. Effects only — no transfers
    ///      out, so the caller can finish its checks-effects-interactions ordering.
    function _record(
        bytes32 node,
        Template memory t,
        string calldata cid,
        uint256 price,
        bool usdgPath
    ) internal returns (uint256 partnerShare) {
        paidFor[node][keccak256(bytes(cid))] = true;
        publishes[node] += 1;

        if (price == 0) return 0;

        partnerShare = t.payee == address(0) ? 0 : (price * t.shareBps) / 10_000;
        uint256 houseShare = price - partnerShare;

        if (usdgPath) {
            if (partnerShare > 0) owedUsdg[t.payee] += partnerShare;
            owedUsdg[treasury] += houseShare;
        } else {
            if (partnerShare > 0) owedEth[t.payee] += partnerShare;
            owedEth[treasury] += houseShare;
        }
    }

    /// @dev Holdership, tolerantly. A collection that reverts, returns nothing, or has no
    ///      code at all reads as "not a holder" rather than reverting the publish — one
    ///      broken partner contract must not take the paid path down with it.
    ///
    ///      Deliberately a low-level staticcall rather than `try IERC721(...).balanceOf`.
    ///      try/catch only catches a revert; it does NOT catch a failure to decode the
    ///      return data, so a contract answering with empty data blows straight through
    ///      the catch and reverts the publish. A plain address with no code is the same
    ///      hazard wearing different clothes: a call to it *succeeds* and returns
    ///      nothing, which is what a mistyped collection address looks like on-chain.
    function _holds(address collection, address account) internal view returns (bool) {
        if (account == address(0) || collection.code.length == 0) return false;

        (bool ok, bytes memory data) =
            collection.staticcall(abi.encodeWithSelector(IERC721.balanceOf.selector, account));
        if (!ok || data.length < 32) return false;

        return abi.decode(data, (uint256)) > 0;
    }
}
