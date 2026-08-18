// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {HoodfiSites} from "src/hoodfi/HoodfiSites.sol";

/// @notice Robinhood Chain: the publish paywall behind build.hoodfi.name, plus the four
///         house templates registered so the flow is usable the moment it lands.
///
///         Deploys with EVERY PRICE AT ZERO. That is the launch state, not an oversight:
///         the paid path runs from the first publish with nothing to pay, so what ships
///         on the day prices go live is a path that has already been exercised rather
///         than a branch nobody took. Turning it on is one setPrices call, no redeploy.
///
///         The L2Registry is NOT redeployed. It holds every existing name.
///
/// Env: PRIVATE_KEY, optional REGISTRY / TREASURY / RECORDER / USDG.
/// Run: forge script scripts/hoodfi/DeploySites.s.sol --rpc-url robinhood --broadcast
contract DeploySites is Script {
    /// The live hoodfi.eth registry on Robinhood Chain. Never redeployed.
    address constant REGISTRY = 0xf2bABA012244bdD7445129597350054E1B3aEe5C;
    /// Robinhood Chain's stablecoin is USDG (Paxos, 6 decimals), not USDC.
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    /// ensgiant — the same treasury the registrar pays into.
    address constant TREASURY = 0x2D037f66b9e0EDE90c2080558a7d3FF7BE36E9A1;

    /// The four house templates. Ids are keccak of the slug, so the frontend can derive
    /// them without a lookup table that could drift from what is on-chain.
    function _houseTemplates() internal pure returns (bytes32[4] memory ids) {
        ids[0] = keccak256("terminal");
        ids[1] = keccak256("editorial");
        ids[2] = keccak256("manifesto");
        ids[3] = keccak256("product");
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address registry = vm.envOr("REGISTRY", REGISTRY);
        address treasury = vm.envOr("TREASURY", TREASURY);
        address usdg = vm.envOr("USDG", USDG);
        // Whoever may mark a credit spent. The gateway will take this over once it does
        // the pinning; until then it is the deployer, and it is owner-settable.
        address recorder = vm.envOr("RECORDER", deployer);

        vm.startBroadcast(pk);
        HoodfiSites sites = new HoodfiSites(registry, treasury, recorder, deployer);
        sites.setUsdg(usdg);

        // payee 0, collection 0, share 0: open to everyone, earning nobody a cut.
        // Partner templates are added one at a time, by hand, after review.
        bytes32[4] memory ids = _houseTemplates();
        for (uint256 i = 0; i < ids.length; i++) {
            sites.setTemplate(ids[i], address(0), address(0), 0, true);
        }
        vm.stopBroadcast();

        console.log("HoodfiSites:", address(sites));
        console.log("registry:   ", registry);
        console.log("treasury:   ", treasury);
        console.log("recorder:   ", recorder);
        console.log("usdg:       ", usdg);
        console.log("owner:      ", deployer);
        console.log("prices:      all zero (setPrices to go live)");
    }
}
