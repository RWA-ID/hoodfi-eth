// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {HoodfiPartnerRouter} from "src/hoodfi/HoodfiPartnerRouter.sol";

/// @notice Robinhood Chain deploy. Env: PRIVATE_KEY, optional OWNER, PLATFORM_TREASURY,
///         PLATFORM_FEE_BPS.
/// Run: forge script scripts/hoodfi/DeployPartnerRouter.s.sol --rpc-url robinhood --broadcast
///
/// @dev The router needs NO permission from anything already deployed. It is an ordinary
///      caller of the registrar's public `registerWithUsdc`, so there is no `addRegistrar`
///      step here and there must never be one: `L2Registry.onlyOwnerOrRegistrar` is binary,
///      and an approved registrar bypasses the blocklist, the tier prices and `shortsOpen`
///      entirely. That also means this deploy cannot disturb anything live — no existing
///      contract is touched, and `creditsSpent` is untouched because the registrar itself
///      is not being swapped.
///
///      PLATFORM_FEE_BPS defaults to 0: a partner keeps the entire margin above our base
///      fee, which is the arrangement that was actually agreed. It is settable later, and
///      capped at 3000 in the contract.
contract DeployPartnerRouter is Script {
    address constant REGISTRAR = 0x56be5565acc823f4195c2cf3b9046C083633209a;
    /// @dev Cross-checked below against the registrar rather than trusted from here — a
    ///      constant that mirrors live state is exactly the kind that rots silently.
    address constant EXPECTED_REGISTRY = 0xf2bABA012244bdD7445129597350054E1B3aEe5C;
    address constant EXPECTED_USDC = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));
        // Where our share of partner margin would land if PLATFORM_FEE_BPS is ever raised.
        // Defaults to the registrar's own treasury so the two never drift apart silently.
        address platformTreasury = vm.envOr("PLATFORM_TREASURY", _registrarTreasury());
        uint256 feeBps = vm.envOr("PLATFORM_FEE_BPS", uint256(0));

        vm.startBroadcast(pk);
        HoodfiPartnerRouter router =
            new HoodfiPartnerRouter(REGISTRAR, platformTreasury, feeBps, owner);
        vm.stopBroadcast();

        console.log("HoodfiPartnerRouter:", address(router));
        console.log("owner:              ", router.owner());
        console.log("platformTreasury:   ", router.platformTreasury());
        console.log("platformFeeBps:     ", router.platformFeeBps());
        console.log("registry:           ", address(router.registry()));
        console.log("usdc:               ", address(router.usdc()));
        console.log("coinType:           ", router.coinType());

        // The router reads registry/usdc/coinType off the registrar in its constructor, so a
        // mismatch here means REGISTRAR points somewhere unexpected — fail the run rather
        // than print a contract nobody should use.
        require(address(router.registry()) == EXPECTED_REGISTRY, "registry mismatch");
        require(address(router.usdc()) == EXPECTED_USDC, "usdc mismatch");
        require(router.platformFeeBps() <= router.MAX_PLATFORM_FEE_BPS(), "fee over cap");
    }

    function _registrarTreasury() internal view returns (address) {
        (bool ok, bytes memory data) =
            REGISTRAR.staticcall(abi.encodeWithSignature("treasury()"));
        require(ok && data.length == 32, "could not read registrar treasury");
        return abi.decode(data, (address));
    }
}
