// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {L2Registry} from "src/L2Registry.sol";
import {L2RegistryFactory} from "src/L2RegistryFactory.sol";
import {HoodfiRegistrar} from "src/hoodfi/HoodfiRegistrar.sol";
import {HoodfiSites} from "src/hoodfi/HoodfiSites.sol";
import {MockUsdc} from "./mocks/MockUsdc.sol";
import {MockCollection, RevertingCollection, SilentCollection} from "./mocks/MockCollection.sol";

contract HoodfiSitesTest is Test {
    L2Registry public registry;
    HoodfiRegistrar public registrar;
    HoodfiSites public sites;
    MockUsdc public usdg;
    MockCollection public hoodies;

    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public recorder = makeAddr("recorder");
    address public partner = makeAddr("partner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256[4] internal pricesWei =
        [uint256(0.0082 ether), 0.0055 ether, 0.0027 ether, 0.0016 ether];

    bytes32 internal constant HOUSE = keccak256("terminal");
    bytes32 internal constant PARTNER_TPL = keccak256("hoodies");
    bytes32 internal constant CODELESS_TPL = keccak256("codeless");

    // $19.99 / $9.99 at a placeholder ETH rate, and in USDG's 6 decimals.
    uint256 internal constant FIRST_WEI = 0.0055 ether;
    uint256 internal constant REPUB_WEI = 0.0027 ether;
    uint256 internal constant FIRST_USDG = 19_990_000;
    uint256 internal constant REPUB_USDG = 9_990_000;

    function setUp() public {
        vm.startPrank(admin);
        L2RegistryFactory factory = new L2RegistryFactory(address(new L2Registry()));
        registry = L2Registry(factory.deployRegistry("hoodfi.eth"));
        registrar = new HoodfiRegistrar(address(registry), treasury, admin, pricesWei, admin);
        registry.addRegistrar(address(registrar));

        usdg = new MockUsdc();
        sites = new HoodfiSites(address(registry), treasury, recorder, admin);
        sites.setUsdg(address(usdg));

        hoodies = new MockCollection();

        // A house template earns nobody anything and is open to all.
        sites.setTemplate(HOUSE, address(0), address(0), 0, true);
        // A partner template: holders only, 30% of every publish to the partner.
        sites.setTemplate(PARTNER_TPL, partner, address(hoodies), 3000, true);
        vm.stopPrank();

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        usdg.mint(alice, 1000e6);

        _mintName("alice", alice);
        _mintName("bobby", bob);
    }

    function _mintName(string memory label, address to) internal {
        vm.prank(to);
        registrar.register{value: pricesWei[3]}(label);
    }

    function _node(string memory label) internal view returns (bytes32) {
        return registry.makeNode(registry.baseNode(), label);
    }

    function _priced() internal {
        vm.prank(admin);
        sites.setPrices(FIRST_WEI, REPUB_WEI, FIRST_USDG, REPUB_USDG);
    }

    /*//////////////////////////////////////////////////////////////
                          THE LAUNCH STATE: FREE
    //////////////////////////////////////////////////////////////*/

    /// The whole point of launching at zero is that the paid path still runs. A publish
    /// that costs nothing must still take the transaction, credit the node and flip it
    /// onto the republish price — otherwise what ships is an untested branch.
    function test_publishIsFreeAtLaunchButStillRuns() public {
        bytes32 node = _node("alice");

        vm.prank(alice);
        sites.publish{value: 0}(node, HOUSE);

        assertEq(sites.credits(node), 1, "credit not granted");
        assertTrue(sites.published(node), "not marked published");
        assertEq(sites.owedEth(treasury), 0, "treasury owed something at price zero");
    }

    function test_freePublishStillMovesToRepublishPrice() public {
        bytes32 node = _node("alice");
        vm.prank(alice);
        sites.publish(node, HOUSE);

        _priced();
        (uint256 weiPrice,,,) = sites.quote(node, HOUSE, alice);
        assertEq(weiPrice, REPUB_WEI, "second publish should be at the republish price");
    }

    /*//////////////////////////////////////////////////////////////
                                PRICING
    //////////////////////////////////////////////////////////////*/

    function test_firstPublishThenRepublishPricing() public {
        _priced();
        bytes32 node = _node("alice");

        (uint256 first,,,) = sites.quote(node, HOUSE, alice);
        assertEq(first, FIRST_WEI);

        vm.prank(alice);
        sites.publish{value: FIRST_WEI}(node, HOUSE);

        (uint256 second,,,) = sites.quote(node, HOUSE, alice);
        assertEq(second, REPUB_WEI);

        vm.prank(alice);
        sites.publish{value: REPUB_WEI}(node, HOUSE);
        assertEq(sites.credits(node), 2);
    }

    function test_underpaymentReverts() public {
        _priced();
        bytes32 node = _node("alice");
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                HoodfiSites.InsufficientPayment.selector, FIRST_WEI, FIRST_WEI - 1
            )
        );
        sites.publish{value: FIRST_WEI - 1}(node, HOUSE);
    }

    function test_excessIsRefunded() public {
        _priced();
        bytes32 node = _node("alice");
        uint256 before = alice.balance;

        vm.prank(alice);
        sites.publish{value: 1 ether}(node, HOUSE);

        assertEq(before - alice.balance, FIRST_WEI, "overpayment was not refunded");
    }

    /*//////////////////////////////////////////////////////////////
                               OWNERSHIP
    //////////////////////////////////////////////////////////////*/

    /// Buying against someone else's name is refused. Not because the payment would hurt
    /// them, but because it would flip `published` and move their name onto the
    /// republish price permanently.
    function test_onlyNameOwnerMayPublish() public {
        bytes32 node = _node("alice");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(HoodfiSites.NotNameOwner.selector, node));
        sites.publish(node, HOUSE);
    }

    /// An unlock belongs to the name, so it survives a sale — the new holder inherits
    /// both the credit and the republish price.
    function test_creditSurvivesTransfer() public {
        _priced();
        bytes32 node = _node("alice");

        vm.prank(alice);
        sites.publish{value: FIRST_WEI}(node, HOUSE);

        vm.prank(alice);
        registry.transferFrom(alice, bob, uint256(node));

        assertEq(sites.credits(node), 1, "credit did not survive the transfer");
        (uint256 price,,,) = sites.quote(node, HOUSE, bob);
        assertEq(price, REPUB_WEI, "new owner should be on the republish price");

        vm.prank(bob);
        sites.publish{value: REPUB_WEI}(node, HOUSE);
        assertEq(sites.credits(node), 2);
    }

    /*//////////////////////////////////////////////////////////////
                            PARTNER TEMPLATES
    //////////////////////////////////////////////////////////////*/

    function test_partnerTemplateRequiresHoldingTheNft() public {
        bytes32 node = _node("alice");
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                HoodfiSites.CollectionRequired.selector, PARTNER_TPL, address(hoodies)
            )
        );
        sites.publish(node, PARTNER_TPL);
    }

    function test_holderMayUsePartnerTemplate() public {
        hoodies.mint(alice);
        bytes32 node = _node("alice");

        vm.prank(alice);
        sites.publish(node, PARTNER_TPL);
        assertEq(sites.credits(node), 1);
    }

    function test_partnerEarnsThirtyPercentInEth() public {
        _priced();
        hoodies.mint(alice);
        bytes32 node = _node("alice");

        vm.prank(alice);
        sites.publish{value: FIRST_WEI}(node, PARTNER_TPL);

        uint256 expected = (FIRST_WEI * 3000) / 10_000;
        assertEq(sites.owedEth(partner), expected, "partner share wrong");
        assertEq(sites.owedEth(treasury), FIRST_WEI - expected, "house share wrong");
        assertEq(
            sites.owedEth(partner) + sites.owedEth(treasury), FIRST_WEI, "split loses money"
        );
    }

    function test_partnerEarnsOnRepublishToo() public {
        _priced();
        hoodies.mint(alice);
        bytes32 node = _node("alice");

        vm.startPrank(alice);
        sites.publish{value: FIRST_WEI}(node, PARTNER_TPL);
        sites.publish{value: REPUB_WEI}(node, PARTNER_TPL);
        vm.stopPrank();

        uint256 expected = ((FIRST_WEI + REPUB_WEI) * 3000) / 10_000;
        assertEq(sites.owedEth(partner), expected);
    }

    function test_houseTemplatePaysTreasuryOnly() public {
        _priced();
        bytes32 node = _node("alice");
        vm.prank(alice);
        sites.publish{value: FIRST_WEI}(node, HOUSE);

        assertEq(sites.owedEth(treasury), FIRST_WEI);
        assertEq(sites.owedEth(partner), 0);
    }

    function test_retiredTemplateCannotBeUsed() public {
        hoodies.mint(alice);
        vm.prank(admin);
        sites.setTemplate(PARTNER_TPL, partner, address(hoodies), 3000, false);

        bytes32 node = _node("alice");
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(HoodfiSites.TemplateInactive.selector, PARTNER_TPL)
        );
        sites.publish(node, PARTNER_TPL);
    }

    function test_unknownTemplateReverts() public {
        bytes32 node = _node("alice");
        bytes32 ghost = keccak256("never-registered");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HoodfiSites.UnknownTemplate.selector, ghost));
        sites.publish(node, ghost);
    }

    function test_shareIsCapped() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(HoodfiSites.ShareTooHigh.selector, 6000, 5000));
        sites.setTemplate(keccak256("greedy"), partner, address(0), 6000, true);
    }

    function test_shareWithoutPayeeReverts() public {
        vm.prank(admin);
        vm.expectRevert(HoodfiSites.PayeeRequired.selector);
        sites.setTemplate(keccak256("orphan"), address(0), address(0), 3000, true);
    }

    /// A partner contract that reverts must read as "not a holder", never take the
    /// payment path down with it.
    function test_brokenCollectionDoesNotBrickPublishing() public {
        vm.startPrank(admin);
        sites.setTemplate(keccak256("broken"), partner, address(new RevertingCollection()), 3000, true);
        sites.setTemplate(keccak256("silent"), partner, address(new SilentCollection()), 3000, true);
        vm.stopPrank();

        // And an address with no code at all — a mistyped collection.
        vm.prank(admin);
        sites.setTemplate(CODELESS_TPL, partner, makeAddr("not-a-contract"), 3000, true);

        assertFalse(sites.canUseTemplate(keccak256("broken"), alice));
        assertFalse(sites.canUseTemplate(keccak256("silent"), alice));
        assertFalse(sites.canUseTemplate(CODELESS_TPL, alice));

        // Each must also refuse a publish cleanly rather than revert with EvmError.
        bytes32 aliceNode = _node("alice");
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                HoodfiSites.CollectionRequired.selector, CODELESS_TPL, makeAddr("not-a-contract")
            )
        );
        sites.publish(aliceNode, CODELESS_TPL);

        // And the house template still works while those are registered.
        bytes32 node = _node("alice");
        vm.prank(alice);
        sites.publish(node, HOUSE);
        assertEq(sites.credits(node), 1);
    }

    /*//////////////////////////////////////////////////////////////
                             AUTO-DETECT VIEW
    //////////////////////////////////////////////////////////////*/

    function test_canUseTemplateDrivesAutodetect() public {
        assertTrue(sites.canUseTemplate(HOUSE, alice), "house template is open to all");
        assertFalse(sites.canUseTemplate(PARTNER_TPL, alice), "alice holds no hoodie yet");

        hoodies.mint(alice);
        assertTrue(sites.canUseTemplate(PARTNER_TPL, alice), "holder should qualify");
        assertFalse(sites.canUseTemplate(PARTNER_TPL, bob), "bob still holds none");
    }

    /*//////////////////////////////////////////////////////////////
                                  USDG
    //////////////////////////////////////////////////////////////*/

    function test_usdgPublishSplits() public {
        _priced();
        hoodies.mint(alice);
        bytes32 node = _node("alice");

        vm.startPrank(alice);
        usdg.approve(address(sites), FIRST_USDG);
        sites.publishWithUsdg(node, PARTNER_TPL);
        vm.stopPrank();

        uint256 expected = (FIRST_USDG * 3000) / 10_000;
        assertEq(sites.owedUsdg(partner), expected);
        assertEq(sites.owedUsdg(treasury), FIRST_USDG - expected);
        assertEq(usdg.balanceOf(address(sites)), FIRST_USDG, "contract should hold the payment");
    }

    /*//////////////////////////////////////////////////////////////
                             SPENDING CREDITS
    //////////////////////////////////////////////////////////////*/

    /// Only the gateway may consume a credit. If the owner could, anyone willing to
    /// spend gas could burn a publish somebody paid for.
    function test_onlyRecorderMaySpendACredit() public {
        bytes32 node = _node("alice");
        vm.prank(alice);
        sites.publish(node, HOUSE);

        vm.prank(alice);
        vm.expectRevert(HoodfiSites.NotRecorder.selector);
        sites.recordPublish(node);

        vm.prank(recorder);
        sites.recordPublish(node);
        assertEq(sites.spent(node), 1);
    }

    function test_creditIsSingleUse() public {
        bytes32 node = _node("alice");
        vm.prank(alice);
        sites.publish(node, HOUSE);

        vm.startPrank(recorder);
        sites.recordPublish(node);
        vm.expectRevert(abi.encodeWithSelector(HoodfiSites.NoCreditToSpend.selector, node));
        sites.recordPublish(node);
        vm.stopPrank();
    }

    function test_quoteReportsCreditsLeft() public {
        bytes32 node = _node("alice");
        vm.prank(alice);
        sites.publish(node, HOUSE);
        (,,, uint256 left) = sites.quote(node, HOUSE, alice);
        assertEq(left, 1);

        vm.prank(recorder);
        sites.recordPublish(node);
        (,,, uint256 after_) = sites.quote(node, HOUSE, alice);
        assertEq(after_, 0);
    }

    /*//////////////////////////////////////////////////////////////
                               WITHDRAWAL
    //////////////////////////////////////////////////////////////*/

    function test_partnerAndTreasuryBothWithdraw() public {
        _priced();
        hoodies.mint(alice);
        bytes32 node = _node("alice");

        vm.prank(alice);
        sites.publish{value: FIRST_WEI}(node, PARTNER_TPL);

        uint256 share = (FIRST_WEI * 3000) / 10_000;

        vm.prank(partner);
        sites.withdraw();
        assertEq(partner.balance, share);
        assertEq(sites.owedEth(partner), 0);

        vm.prank(treasury);
        sites.withdraw();
        assertEq(treasury.balance, FIRST_WEI - share);
        assertEq(address(sites).balance, 0, "contract should be empty afterwards");
    }

    function test_withdrawWithNothingOwedReverts() public {
        vm.prank(bob);
        vm.expectRevert(HoodfiSites.NothingOwed.selector);
        sites.withdraw();
    }

    /*//////////////////////////////////////////////////////////////
                                 PAUSING
    //////////////////////////////////////////////////////////////*/

    function test_pauseStopsPublishing() public {
        vm.prank(admin);
        sites.setPaused(true);

        bytes32 node = _node("alice");
        vm.prank(alice);
        vm.expectRevert(HoodfiSites.PublishingPaused.selector);
        sites.publish(node, HOUSE);
    }

    function test_onlyOwnerMayConfigure() public {
        vm.prank(bob);
        vm.expectRevert();
        sites.setPrices(1, 1, 1, 1);

        vm.prank(bob);
        vm.expectRevert();
        sites.setTemplate(keccak256("x"), bob, address(0), 1000, true);
    }
}
