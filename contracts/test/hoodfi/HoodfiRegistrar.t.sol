// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {L2Registry} from "src/L2Registry.sol";
import {L2RegistryFactory} from "src/L2RegistryFactory.sol";
import {HoodfiRegistrar} from "src/hoodfi/HoodfiRegistrar.sol";
import {MockUsdc} from "./mocks/MockUsdc.sol";

contract HoodfiRegistrarTest is Test {
    L2Registry public registry;
    HoodfiRegistrar public registrar;
    MockUsdc public usdc;

    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 internal signerKey = 0xA11CE515;
    address internal signer;

    // Launch prices: $15 / $10 / $5 / $3 at a placeholder ETH rate
    uint256[4] internal PRICES_WEI =
        [uint256(0.0082 ether), 0.0055 ether, 0.0027 ether, 0.0016 ether];

    function setUp() public {
        signer = vm.addr(signerKey);

        vm.startPrank(admin);
        L2RegistryFactory factory = new L2RegistryFactory(address(new L2Registry()));
        registry = L2Registry(factory.deployRegistry("hoodfi.eth"));
        registrar = new HoodfiRegistrar(address(registry), treasury, signer, PRICES_WEI, admin);
        registry.addRegistrar(address(registrar));
        usdc = new MockUsdc();
        registrar.setUsdc(address(usdc));
        vm.stopPrank();

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        usdc.mint(alice, 1000e6);
    }

    function _node(string memory label) internal view returns (bytes32) {
        return registry.makeNode(registry.baseNode(), label);
    }

    function _voucher(address donor, uint256 total, uint256 expiry)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = registrar.voucherDigest(donor, total, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _openShorts() internal {
        vm.prank(admin);
        registrar.openShorts();
    }

    function _blocklist(string memory label) internal {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(bytes(label));
        vm.prank(admin);
        registrar.setBlocklist(hashes, true);
    }

    /*//////////////////////////////////////////////////////////////
                          PUBLIC MINT (4+ CHARS)
    //////////////////////////////////////////////////////////////*/

    function test_PublicMintIsLiveImmediately() public {
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
        assertEq(registry.ownerOf(uint256(_node("satoshi"))), alice);
    }

    function test_PublicMintRefundsExcess() public {
        uint256 before = alice.balance;
        vm.prank(alice);
        registrar.register{value: 1 ether}("satoshi");
        assertEq(alice.balance, before - PRICES_WEI[3]);
    }

    function test_PublicMintRevertsOnUnderpayment() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                HoodfiRegistrar.InsufficientPayment.selector, PRICES_WEI[3], PRICES_WEI[3] - 1
            )
        );
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3] - 1}("satoshi");
    }

    function test_PublicMintWithUsdc() public {
        vm.startPrank(alice);
        usdc.approve(address(registrar), 3e6);
        registrar.registerWithUsdc("satoshi");
        vm.stopPrank();
        assertEq(registry.ownerOf(uint256(_node("satoshi"))), alice);
        assertEq(usdc.balanceOf(treasury), 3e6);
    }

    function test_DuplicateMintReverts() public {
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
        vm.expectRevert();
        vm.prank(bob);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
    }

    function test_InvalidLabelReverts() public {
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.InvalidLabel.selector, "Satoshi"));
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("Satoshi");
    }

    function test_PausedBlocksPublicMint() public {
        vm.prank(admin);
        registrar.setPaused(true);
        vm.expectRevert(HoodfiRegistrar.MintingPaused.selector);
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
    }

    function test_BlocklistedLabelReverts() public {
        _blocklist("wwww");
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.LabelBlocked.selector, "wwww"));
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("wwww");
    }

    /*//////////////////////////////////////////////////////////////
                        SHORT NAMES ARE LOCKED
    //////////////////////////////////////////////////////////////*/

    function test_ShortNamesLockedBeforeGoal() public {
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.ShortNameLocked.selector, "gm"));
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[1]}("gm");
    }

    function test_ShortNamesLockedForUsdcToo() public {
        vm.startPrank(alice);
        usdc.approve(address(registrar), 100e6);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.ShortNameLocked.selector, "gm"));
        registrar.registerWithUsdc("gm");
        vm.stopPrank();
    }

    function test_ShortNamesOpenAfterGoal() public {
        _openShorts();
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[1]}("gm");
        assertEq(registry.ownerOf(uint256(_node("gm"))), alice);
    }

    function test_ShortTierPricingApplies() public {
        _openShorts();
        vm.startPrank(alice);
        registrar.register{value: PRICES_WEI[0]}("x");
        registrar.register{value: PRICES_WEI[1]}("gm");
        registrar.register{value: PRICES_WEI[2]}("eth");
        vm.stopPrank();
        assertEq(registry.ownerOf(uint256(_node("x"))), alice);
        assertEq(registry.ownerOf(uint256(_node("eth"))), alice);
    }

    /*//////////////////////////////////////////////////////////////
                            VOUCHER MINTING
    //////////////////////////////////////////////////////////////*/

    function test_DonorMintsShortWithVoucher() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
        assertEq(registry.ownerOf(uint256(_node("gm"))), alice);
        assertEq(registrar.creditsSpent(alice), 1);
    }

    function test_VoucherMintIsFree() public {
        uint256 before = alice.balance;
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
        assertEq(alice.balance, before);
    }

    function test_CreditsExhaustAfterSpending() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 2, expiry);

        vm.startPrank(alice);
        registrar.mintShortWithVoucher("gm", 2, expiry, sig);
        registrar.mintShortWithVoucher("wa", 2, expiry, sig);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.NoCreditsLeft.selector, 2, 2));
        registrar.mintShortWithVoucher("ok", 2, expiry, sig);
        vm.stopPrank();
    }

    /// @dev The whole point of attesting a cumulative total: replaying an old voucher
    ///      cannot mint beyond the total it attested.
    function test_ReplayingStaleVoucherCannotOverMint() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory oldSig = _voucher(alice, 1, expiry);
        bytes memory newSig = _voucher(alice, 3, expiry);

        vm.startPrank(alice);
        registrar.mintShortWithVoucher("gm", 3, expiry, newSig);
        registrar.mintShortWithVoucher("wa", 3, expiry, newSig);
        // Two spent; the stale voucher attesting only 1 is now useless.
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.NoCreditsLeft.selector, 1, 2));
        registrar.mintShortWithVoucher("ok", 1, expiry, oldSig);
        vm.stopPrank();
    }

    function test_VoucherIsBoundToDonor() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.expectRevert(HoodfiRegistrar.BadVoucher.selector);
        vm.prank(bob);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
    }

    function test_VoucherFromWrongSignerReverts() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes32 digest = registrar.voucherDigest(alice, 1, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, digest);
        vm.expectRevert(HoodfiRegistrar.BadVoucher.selector);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, abi.encodePacked(r, s, v));
    }

    function test_ExpiredVoucherReverts() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.warp(expiry + 1);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.VoucherExpired.selector, expiry));
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
    }

    function test_TamperedCreditAmountReverts() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.expectRevert(HoodfiRegistrar.BadVoucher.selector);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 99, expiry, sig);
    }

    function test_VoucherCannotMintLongName() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.NotAShortName.selector, "satoshi"));
        vm.prank(alice);
        registrar.mintShortWithVoucher("satoshi", 1, expiry, sig);
    }

    function test_VoucherRespectsBlocklist() public {
        _blocklist("www");
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.LabelBlocked.selector, "www"));
        vm.prank(alice);
        registrar.mintShortWithVoucher("www", 1, expiry, sig);
    }

    function test_CreditsStillWorkAfterShortsOpen() public {
        _openShorts();
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        uint256 before = alice.balance;
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
        assertEq(alice.balance, before, "credit mint stays free post-goal");
    }

    function test_PausedBlocksVoucherMint() public {
        vm.prank(admin);
        registrar.setPaused(true);
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.expectRevert(HoodfiRegistrar.MintingPaused.selector);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_StatusReflectsLockAndAvailability() public {
        assertEq(registrar.status("satoshi"), 0, "4+ available");
        assertEq(registrar.status("gm"), 2, "short locked pre-goal");
        assertEq(registrar.status("Satoshi"), 3, "invalid");

        _blocklist("wwww");
        assertEq(registrar.status("wwww"), 4, "blocked");

        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
        assertEq(registrar.status("satoshi"), 1, "taken");

        _openShorts();
        assertEq(registrar.status("gm"), 0, "short available post-goal");
    }

    function test_PriceOfByTier() public view {
        (uint256 w1,) = registrar.priceOf("x");
        (uint256 w2,) = registrar.priceOf("gm");
        (uint256 w3,) = registrar.priceOf("eth");
        (uint256 w4, uint256 u4) = registrar.priceOf("satoshi");
        assertEq(w1, PRICES_WEI[0]);
        assertEq(w2, PRICES_WEI[1]);
        assertEq(w3, PRICES_WEI[2]);
        assertEq(w4, PRICES_WEI[3]);
        assertEq(u4, 3e6);
    }

    function test_CreditsAvailableView() public {
        assertEq(registrar.creditsAvailable(alice, 3), 3);
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 3, expiry);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 3, expiry, sig);
        assertEq(registrar.creditsAvailable(alice, 3), 2);
        assertEq(registrar.creditsAvailable(alice, 0), 0, "no underflow");
    }

    /*//////////////////////////////////////////////////////////////
                            RECORDS & ADMIN
    //////////////////////////////////////////////////////////////*/

    /// @dev The manage page depends on this: the name owner, not just a registrar,
    ///      must be able to write their own records.
    function test_NameOwnerCanSetOwnRecords() public {
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");

        bytes32 node = _node("satoshi");
        vm.startPrank(alice);
        registry.setText(node, "avatar", "ipfs://abc");
        registry.setText(node, "com.twitter", "hoodfieth");
        vm.stopPrank();

        assertEq(registry.text(node, "avatar"), "ipfs://abc");
        assertEq(registry.text(node, "com.twitter"), "hoodfieth");
    }

    function test_NonOwnerCannotSetRecords() public {
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
        bytes32 node = _node("satoshi");
        vm.expectRevert();
        vm.prank(bob);
        registry.setText(node, "avatar", "ipfs://evil");
    }

    function test_MintSetsForwardAddrs() public {
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
        bytes32 node = _node("satoshi");
        assertEq(registry.addr(node, 60), abi.encodePacked(alice));
        assertEq(registry.addr(node, registrar.coinType()), abi.encodePacked(alice));
    }

    function test_WithdrawSweepsToTreasury() public {
        vm.prank(alice);
        registrar.register{value: PRICES_WEI[3]}("satoshi");
        uint256 before = treasury.balance;
        registrar.withdraw();
        assertEq(treasury.balance, before + PRICES_WEI[3]);
        assertEq(address(registrar).balance, 0);
    }

    function test_OnlyOwnerAdmin() public {
        vm.startPrank(alice);
        vm.expectRevert();
        registrar.openShorts();
        vm.expectRevert();
        registrar.setPaused(true);
        vm.expectRevert();
        registrar.setCreditSigner(alice);
        vm.stopPrank();
    }

    /// @dev Cross-language pin. The gateway builds this preimage in TypeScript; if the
    ///      field order, widths or encoding ever drift apart, donors get an opaque
    ///      BadVoucher() revert instead of their name. Vector generated with viem and
    ///      independently confirmed with `cast abi-encode | cast keccak`.
    function test_VoucherDigestPreimageMatchesGateway() public pure {
        bytes32 expected = 0xe97b2af95eb3630b2f984db5df82bc9a4ceb0a79fcce5e2c18fc711a5eb3637d;
        bytes32 actual = keccak256(
            abi.encode(
                address(0x75d61F7d87C5A0F4a52Fe526642c80d0Ef994f51),
                uint256(4663),
                address(0x5f11a48230f7CdaB91A2361576239091E4b1165b),
                uint256(3),
                uint256(1_800_000_000)
            )
        );
        assertEq(actual, expected, "voucher preimage drifted from the gateway");
    }

    function test_SetCreditSignerRotatesAttestation() public {
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _voucher(alice, 1, expiry);
        vm.prank(admin);
        registrar.setCreditSigner(makeAddr("newSigner"));
        vm.expectRevert(HoodfiRegistrar.BadVoucher.selector);
        vm.prank(alice);
        registrar.mintShortWithVoucher("gm", 1, expiry, sig);
    }
}
