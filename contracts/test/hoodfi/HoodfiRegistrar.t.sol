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

    // Launch prices: $15 / $10 / $5 / $3 at a placeholder ETH rate
    uint256[4] internal PRICES_WEI =
        [uint256(0.0082 ether), 0.0055 ether, 0.0027 ether, 0.0016 ether];

    function setUp() public {
        vm.startPrank(admin);
        L2RegistryFactory factory = new L2RegistryFactory(address(new L2Registry()));
        registry = L2Registry(factory.deployRegistry("hoodfi.eth"));
        registrar = new HoodfiRegistrar(address(registry), treasury, PRICES_WEI, admin);
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

    function _load(string memory label, address owner_) internal {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(bytes(label));
        address[] memory owners = new address[](1);
        owners[0] = owner_;
        vm.prank(admin);
        registrar.loadReservations(hashes, owners);
    }

    function _setPhase(HoodfiRegistrar.Phase p) internal {
        vm.prank(admin);
        registrar.setPhase(p);
    }

    /*//////////////////////////////////////////////////////////////
                                 CLAIMS
    //////////////////////////////////////////////////////////////*/

    function test_ClaimReservedName() public {
        _load("blake", alice);
        _setPhase(HoodfiRegistrar.Phase.Claim);

        vm.prank(alice);
        registrar.claim("blake");

        bytes32 node = _node("blake");
        assertEq(registry.ownerOf(uint256(node)), alice);
        // Default forward records set for ETH + this chain's ENSIP-11 coinType
        assertEq(registry.addr(node, 60), abi.encodePacked(alice));
        assertEq(registry.addr(node, registrar.coinType()), abi.encodePacked(alice));
        // Reservation consumed
        assertEq(registrar.reservations(keccak256("blake")), address(0));
    }

    function test_ClaimNotYoursReverts() public {
        _load("blake", alice);
        _setPhase(HoodfiRegistrar.Phase.Claim);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(HoodfiRegistrar.NotReservedForYou.selector, "blake")
        );
        registrar.claim("blake");
    }

    function test_ClaimWhilePausedReverts() public {
        _load("blake", alice);
        vm.prank(alice);
        vm.expectRevert(HoodfiRegistrar.WrongPhase.selector);
        registrar.claim("blake");
    }

    function test_ClaimStillWorksDuringPublicPhase() public {
        _load("blake", alice);
        _setPhase(HoodfiRegistrar.Phase.Claim);
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.prank(alice);
        registrar.claim("blake");
        assertEq(registry.ownerOf(uint256(_node("blake"))), alice);
    }

    function test_LoadReservationsOnlyWhilePaused() public {
        _setPhase(HoodfiRegistrar.Phase.Claim);
        bytes32[] memory hashes = new bytes32[](1);
        address[] memory owners = new address[](1);
        vm.prank(admin);
        vm.expectRevert(HoodfiRegistrar.WrongPhase.selector);
        registrar.loadReservations(hashes, owners);
    }

    /*//////////////////////////////////////////////////////////////
                              PUBLIC MINT
    //////////////////////////////////////////////////////////////*/

    function test_RegisterTieredEthPricing() public {
        _setPhase(HoodfiRegistrar.Phase.Public);

        string[4] memory names = ["x", "xy", "xyz", "wxyz"];
        for (uint256 i = 0; i < 4; i++) {
            uint256 balBefore = alice.balance;
            vm.prank(alice);
            registrar.register{value: PRICES_WEI[i] + 0.01 ether}(names[i]);
            assertEq(balBefore - alice.balance, PRICES_WEI[i], "tier price kept, excess refunded");
            assertEq(registry.ownerOf(uint256(_node(names[i]))), alice);
        }
        registrar.withdraw();
        assertEq(
            treasury.balance,
            PRICES_WEI[0] + PRICES_WEI[1] + PRICES_WEI[2] + PRICES_WEI[3]
        );
    }

    function test_RegisterUnderpaymentReverts() public {
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                HoodfiRegistrar.InsufficientPayment.selector, PRICES_WEI[3], PRICES_WEI[3] - 1
            )
        );
        registrar.register{value: PRICES_WEI[3] - 1}("wxyz");
    }

    function test_RegisterDuringClaimPhaseReverts() public {
        _setPhase(HoodfiRegistrar.Phase.Claim);
        vm.prank(alice);
        vm.expectRevert(HoodfiRegistrar.WrongPhase.selector);
        registrar.register{value: 1 ether}("wxyz");
    }

    function test_RegisterReservedNameReverts() public {
        _load("blake", bob);
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.LabelReserved.selector, "blake"));
        registrar.register{value: 1 ether}("blake");
    }

    function test_RegisterInvalidLabelReverts() public {
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.InvalidLabel.selector, "Blake!"));
        registrar.register{value: 1 ether}("Blake!");
    }

    function test_RegisterDuplicateReverts() public {
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.prank(alice);
        registrar.register{value: 1 ether}("wxyz");
        vm.prank(bob);
        vm.expectRevert(); // registry rejects duplicate mint
        registrar.register{value: 1 ether}("wxyz");
    }

    function test_RegisterWithUsdc() public {
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.startPrank(alice);
        usdc.approve(address(registrar), type(uint256).max);
        registrar.registerWithUsdc("x"); // $15 tier
        registrar.registerWithUsdc("wxyz"); // $3 tier
        vm.stopPrank();
        assertEq(usdc.balanceOf(treasury), 18e6, "USDC goes straight to treasury");
        assertEq(registry.ownerOf(uint256(_node("x"))), alice);
    }

    function test_RegisterWithUsdcUnconfiguredReverts() public {
        vm.prank(admin);
        registrar.setUsdc(address(0));
        _setPhase(HoodfiRegistrar.Phase.Public);
        vm.prank(alice);
        vm.expectRevert(HoodfiRegistrar.UsdcNotConfigured.selector);
        registrar.registerWithUsdc("wxyz");
    }

    /*//////////////////////////////////////////////////////////////
                          RELEASE + VIEWS + ADMIN
    //////////////////////////////////////////////////////////////*/

    function test_ReleaseUnclaimedAfterWindow() public {
        _load("blake", bob);
        _setPhase(HoodfiRegistrar.Phase.Claim);
        _setPhase(HoodfiRegistrar.Phase.Public);

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256("blake");

        vm.prank(admin);
        vm.expectRevert(HoodfiRegistrar.ReleaseTooEarly.selector);
        registrar.releaseUnclaimed(hashes);

        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(admin);
        registrar.releaseUnclaimed(hashes);

        vm.prank(alice);
        registrar.register{value: 1 ether}("blake");
        assertEq(registry.ownerOf(uint256(_node("blake"))), alice);
    }

    function test_Status() public {
        _load("blake", bob);
        _setPhase(HoodfiRegistrar.Phase.Public);
        assertEq(registrar.status("wxyz"), 0); // available
        assertEq(registrar.status("blake"), 2); // reserved
        assertEq(registrar.status("UPPER"), 3); // invalid
        vm.prank(alice);
        registrar.register{value: 1 ether}("wxyz");
        assertEq(registrar.status("wxyz"), 1); // taken
    }

    function test_PriceOf() public view {
        (uint256 w1, uint256 u1) = registrar.priceOf("x");
        assertEq(w1, PRICES_WEI[0]);
        assertEq(u1, 15e6);
        (uint256 w4, uint256 u4) = registrar.priceOf("wxyz");
        assertEq(w4, PRICES_WEI[3]);
        assertEq(u4, 3e6);
    }

    function test_SetPricesOnlyOwner() public {
        uint256[4] memory p = [uint256(1), 2, 3, 4];
        vm.prank(alice);
        vm.expectRevert();
        registrar.setPrices(p, p);

        vm.prank(admin);
        registrar.setPrices(p, p);
        assertEq(registrar.priceWei(0), 1);
        assertEq(registrar.priceUsdc(3), 4);
    }

    function test_CoinTypeIsEnsip11() public view {
        assertEq(registrar.coinType(), 0x80000000 | block.chainid);
    }
}
