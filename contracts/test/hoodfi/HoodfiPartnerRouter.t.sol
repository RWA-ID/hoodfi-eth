// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {L2Registry} from "src/L2Registry.sol";
import {L2RegistryFactory} from "src/L2RegistryFactory.sol";
import {HoodfiPartnerRouter} from "src/hoodfi/HoodfiPartnerRouter.sol";
import {HoodfiRegistrar} from "src/hoodfi/HoodfiRegistrar.sol";
import {MockUsdc} from "./mocks/MockUsdc.sol";

contract HoodfiPartnerRouterTest is Test {
    L2Registry public registry;
    HoodfiRegistrar public registrar;
    HoodfiPartnerRouter public router;
    MockUsdc public usdc;

    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public platformTreasury = makeAddr("platformTreasury");
    address public partner = makeAddr("partner");
    address public partnerPayout = makeAddr("partnerPayout");
    address public buyer = makeAddr("buyer");

    uint256[4] internal PRICES_WEI =
        [uint256(0.0082 ether), 0.0055 ether, 0.0027 ether, 0.0016 ether];

    uint256 internal constant BASE_FEE = 3e6; // $3 USDG, the 4+ char tier
    uint256 internal constant PARTNER_PRICE = 10e6; // $10, the StonkBrokers number

    function setUp() public {
        vm.startPrank(admin);
        L2RegistryFactory factory = new L2RegistryFactory(address(new L2Registry()));
        registry = L2Registry(factory.deployRegistry("hoodfi.eth"));
        registrar = new HoodfiRegistrar(address(registry), treasury, makeAddr("signer"), PRICES_WEI, admin);
        registry.addRegistrar(address(registrar));
        usdc = new MockUsdc();
        registrar.setUsdc(address(usdc));
        router = new HoodfiPartnerRouter(address(registrar), platformTreasury, 0, admin);
        vm.stopPrank();

        vm.prank(partner);
        router.setPartner(PARTNER_PRICE, "StonkBrokers", partnerPayout);

        usdc.mint(buyer, 1000e6);
        vm.prank(buyer);
        usdc.approve(address(router), type(uint256).max);
    }

    function _node(string memory label) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(registry.baseNode(), keccak256(bytes(label))));
    }

    /// The router is never a registrar. If it ever becomes one it bypasses the blocklist,
    /// the tier prices and shortsOpen, so assert the negative.
    function test_RouterIsNotARegistrar() public view {
        assertFalse(registry.registrars(address(router)));
    }

    function test_HappyPath_BuyerOwnsTheName() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        assertEq(registry.ownerOf(uint256(_node("stonks"))), buyer);
    }

    /// The bug this router exists to avoid. HoodfiRegistrar._register points addr records at
    /// whoever it mints to — the router — and there is no transfer hook to fix it afterwards.
    /// If this ever regresses, every partner-sold name resolves to the router forever.
    function test_AddrRecordsPointAtBuyerNotRouter() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        bytes32 node = _node("stonks");
        assertEq(registry.addr(node), buyer, "mainnet coinType 60 record");
        assertEq(
            keccak256(registry.addr(node, registrar.coinType())),
            keccak256(abi.encodePacked(buyer)),
            "chain coinType record"
        );
        assertTrue(registry.addr(node) != address(router), "must never be the router");
    }

    function test_MoneySplit_BaseFeeToTreasuryMarginToPartner() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        assertEq(usdc.balanceOf(treasury), BASE_FEE, "our base fee");
        assertEq(router.earnings(partnerPayout), PARTNER_PRICE - BASE_FEE, "partner margin");
        assertEq(router.totalOwed(), PARTNER_PRICE - BASE_FEE);
        assertEq(usdc.balanceOf(buyer), 1000e6 - PARTNER_PRICE, "buyer paid exactly once");
    }

    function test_MarginAccruesToPayoutNotPartnerKey() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        assertEq(router.earnings(partner), 0, "the managing key is not the treasury");
        assertEq(router.earnings(partnerPayout), PARTNER_PRICE - BASE_FEE);
    }

    function test_Withdraw() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        vm.prank(partnerPayout);
        router.withdraw();

        assertEq(usdc.balanceOf(partnerPayout), PARTNER_PRICE - BASE_FEE);
        assertEq(router.earnings(partnerPayout), 0);
        assertEq(router.totalOwed(), 0);
    }

    function test_PlatformFeeSplitsTheMargin() public {
        vm.prank(admin);
        router.setPlatformFee(1000); // 10%

        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        uint256 margin = PARTNER_PRICE - BASE_FEE;
        assertEq(router.earnings(platformTreasury), margin / 10);
        assertEq(router.earnings(partnerPayout), margin - margin / 10);
    }

    /*//////////////////////////////////////////////////////////////
                    SHORT NAMES ARE NOT FOR SALE
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_ThreeCharName() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.NotAPublicName.selector, "abc"));
        router.registerViaPartner("abc", partner);
    }

    function test_RevertWhen_OneCharName() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.NotAPublicName.selector, "a"));
        router.registerViaPartner("a", partner);
    }

    /// Even once the 100-year goal opens short names to the public, a partner must not be
    /// able to reach that inventory — the router's own tier check is independent of shortsOpen.
    function test_RevertWhen_ShortNameEvenAfterShortsOpen() public {
        vm.prank(admin);
        registrar.openShorts();

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.NotAPublicName.selector, "abc"));
        router.registerViaPartner("abc", partner);
    }

    function test_FourCharNameIsTheFloor() public {
        vm.prank(buyer);
        router.registerViaPartner("abcd", partner);
        assertEq(registry.ownerOf(uint256(_node("abcd"))), buyer);
    }

    /*//////////////////////////////////////////////////////////////
                              GUARDS
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_UnknownPartner() public {
        address stranger = makeAddr("stranger");
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.UnknownPartner.selector, stranger));
        router.registerViaPartner("stonks", stranger);
    }

    function test_RevertWhen_NameTaken() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.NameNotAvailable.selector, "stonks", 1));
        router.registerViaPartner("stonks", partner);
    }

    function test_RevertWhen_NameBlocklisted() public {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(bytes("admin"));
        vm.prank(admin);
        registrar.setBlocklist(hashes, true);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.NameNotAvailable.selector, "admin", 4));
        router.registerViaPartner("admin", partner);
    }

    function test_RevertWhen_PartnerPriceBelowBaseFee() public {
        vm.prank(partner);
        vm.expectRevert(
            abi.encodeWithSelector(HoodfiPartnerRouter.PriceBelowBaseFee.selector, 1e6, BASE_FEE)
        );
        router.setPartner(1e6, "TooCheap", partnerPayout);
    }

    function test_RevertWhen_PayoutIsZero() public {
        vm.prank(partner);
        vm.expectRevert(HoodfiPartnerRouter.PayoutIsZero.selector);
        router.setPartner(PARTNER_PRICE, "NoPayout", address(0));
    }

    function test_RevertWhen_PlatformFeeAboveCap() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.FeeTooHigh.selector, 3001));
        router.setPlatformFee(3001);
    }

    function test_PriceZeroDeactivatesButKeepsEarnings() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        vm.prank(partner);
        router.setPartner(0, "StonkBrokers", partnerPayout);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HoodfiPartnerRouter.UnknownPartner.selector, partner));
        router.registerViaPartner("other", partner);

        // The margin already earned is still withdrawable.
        vm.prank(partnerPayout);
        router.withdraw();
        assertEq(usdc.balanceOf(partnerPayout), PARTNER_PRICE - BASE_FEE);
    }

    /// Sweep must never be able to reach money owed to a partner.
    function test_SweepCannotTouchEarnings() public {
        vm.prank(buyer);
        router.registerViaPartner("stonks", partner);

        vm.prank(admin);
        vm.expectRevert(HoodfiPartnerRouter.NothingToSweep.selector);
        router.sweep(admin);

        usdc.mint(address(router), 5e6); // a stray transfer
        vm.prank(admin);
        router.sweep(admin);

        assertEq(usdc.balanceOf(admin), 5e6, "only the surplus");
        assertEq(router.totalOwed(), PARTNER_PRICE - BASE_FEE, "earnings untouched");
        vm.prank(partnerPayout);
        router.withdraw();
        assertEq(usdc.balanceOf(partnerPayout), PARTNER_PRICE - BASE_FEE);
    }

    /*//////////////////////////////////////////////////////////////
                               VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_Quote() public view {
        (uint256 price, uint256 baseFee, bool sellable, uint8 nameStatus) =
            router.quote("stonks", partner);
        assertEq(price, PARTNER_PRICE);
        assertEq(baseFee, BASE_FEE);
        assertTrue(sellable);
        assertEq(nameStatus, 0);
    }

    function test_Quote_ShortNameNotSellable() public view {
        (,, bool sellable,) = router.quote("abc", partner);
        assertFalse(sellable, "a partner can never sell a short name");
    }

    function test_PartnerInfo() public view {
        (uint256 price, string memory name, address payout, uint256 baseFee, uint256 accrued) =
            router.partnerInfo(partner);
        assertEq(price, PARTNER_PRICE);
        assertEq(name, "StonkBrokers");
        assertEq(payout, partnerPayout);
        assertEq(baseFee, BASE_FEE);
        assertEq(accrued, 0);
    }
}
