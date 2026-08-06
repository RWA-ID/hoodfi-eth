// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {L2Registry} from "src/L2Registry.sol";
import {HoodfiRegistrar} from "src/hoodfi/HoodfiRegistrar.sol";

/// @notice Forks LIVE Robinhood Chain and rehearses the registrar swap: deploy v2 against
///         the existing registry, authorize it, retire the old one. Proves the upgrade
///         preserves already-minted names and that minting works on the other side.
///         Skipped cleanly when ROBINHOOD_RPC_URL is unset.
contract HoodfiRegistrarForkTest is Test {
    address constant REGISTRY = 0xf2bABA012244bdD7445129597350054E1B3aEe5C;
    address constant OLD_REGISTRAR = 0x75d61F7d87C5A0F4a52Fe526642c80d0Ef994f51;
    address constant OWNER = 0x5f11a48230f7CdaB91A2361576239091E4b1165b;
    address constant TREASURY = 0x2D037f66b9e0EDE90c2080558a7d3FF7BE36E9A1;

    uint256[4] internal PRICES_WEI =
        [uint256(0.0082 ether), 0.0055 ether, 0.0027 ether, 0.0016 ether];

    L2Registry internal registry;
    HoodfiRegistrar internal registrar;
    bool internal forkEnabled;

    uint256 internal signerKey = 0x5160E12;
    address internal signer;
    address internal donor = makeAddr("hoodfi.fork.minter.2026");

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        forkEnabled = true;
        vm.createSelectFork(rpc);

        signer = vm.addr(signerKey);
        registry = L2Registry(REGISTRY);

        // Rehearse UpgradeRegistrar.s.sol as the real owner.
        vm.startPrank(OWNER);
        registrar = new HoodfiRegistrar(REGISTRY, TREASURY, signer, PRICES_WEI, OWNER);
        registry.addRegistrar(address(registrar));
        registry.removeRegistrar(OLD_REGISTRAR);
        vm.stopPrank();

        vm.deal(donor, 1 ether);
    }

    function _node(string memory label) internal view returns (bytes32) {
        return registry.makeNode(registry.baseNode(), label);
    }

    /// @dev The whole reason for not redeploying the registry.
    function test_Fork_ExistingNameSurvivesUpgrade() public view {
        if (!forkEnabled) return;
        address ownerOfTest = registry.ownerOf(uint256(_node("test1000")));
        assertEq(ownerOfTest, OWNER, "test1000.hoodfi.eth still owned after the swap");
    }

    function test_Fork_BaseUriStillSet() public view {
        if (!forkEnabled) return;
        string memory uri = registry.tokenURI(uint256(_node("test1000")));
        assertGt(bytes(uri).length, 0, "NFT metadata wiring intact");
    }

    function test_Fork_NewRegistrarMintsPublicName() public {
        if (!forkEnabled) return;
        vm.prank(donor);
        registrar.register{value: PRICES_WEI[3]}("forkmint");
        assertEq(registry.ownerOf(uint256(_node("forkmint"))), donor);
    }

    function test_Fork_ShortNamesLockedUntilGoal() public {
        if (!forkEnabled) return;
        vm.expectRevert(abi.encodeWithSelector(HoodfiRegistrar.ShortNameLocked.selector, "gm"));
        vm.prank(donor);
        registrar.register{value: PRICES_WEI[1]}("gm");
    }

    function test_Fork_DonorMintsShortWithVoucher() public {
        if (!forkEnabled) return;
        uint256 expiry = block.timestamp + 1 hours;
        bytes32 digest = registrar.voucherDigest(donor, 1, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);

        vm.prank(donor);
        registrar.mintShortWithVoucher("gm", 1, expiry, abi.encodePacked(r, s, v));
        assertEq(registry.ownerOf(uint256(_node("gm"))), donor);
    }

    /// @dev Retiring the old registrar must actually revoke its minting power.
    function test_Fork_OldRegistrarCanNoLongerMint() public view {
        if (!forkEnabled) return;
        assertFalse(registry.registrars(OLD_REGISTRAR), "old registrar deauthorized");
        assertTrue(registry.registrars(address(registrar)), "new registrar authorized");
    }

    function test_Fork_OwnerCanManageOwnRecords() public {
        if (!forkEnabled) return;
        vm.prank(donor);
        registrar.register{value: PRICES_WEI[3]}("forkmint");

        bytes32 node = _node("forkmint");
        vm.startPrank(donor);
        registry.setText(node, "avatar", "ipfs://QmTest");
        registry.setText(node, "com.twitter", "hoodfieth");
        vm.stopPrank();

        assertEq(registry.text(node, "avatar"), "ipfs://QmTest");
        assertEq(registry.text(node, "com.twitter"), "hoodfieth");
    }
}
