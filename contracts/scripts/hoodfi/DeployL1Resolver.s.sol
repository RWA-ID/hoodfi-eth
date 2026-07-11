// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {HoodfiL1Resolver} from "src/hoodfi/HoodfiL1Resolver.sol";

/// @notice Mainnet deploy of the ENSIP-10 wildcard resolver for hoodfi.eth.
/// Env: PRIVATE_KEY, GATEWAY_URL (templated: .../v1/{sender}/{data}.json),
///      GATEWAY_SIGNER, L2_REGISTRY, optional OWNER.
/// Run: forge script scripts/hoodfi/DeployL1Resolver.s.sol --rpc-url mainnet --broadcast --verify
/// AFTER deploy (separate owner txs, in this order to avoid downtime):
///   1. resolver.setContenthash(namehash("hoodfi.eth"), <current site contenthash>)
///   2. resolver.setAddr(namehash("hoodfi.eth"), <current apex addr>)
///   3. ENS registry setResolver(namehash("hoodfi.eth"), resolver)
contract DeployL1Resolver is Script {
    uint64 constant ROBINHOOD_CHAIN_ID = 4663;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));
        string memory url = vm.envString("GATEWAY_URL");
        address signer = vm.envAddress("GATEWAY_SIGNER");
        address l2Registry = vm.envAddress("L2_REGISTRY");

        vm.startBroadcast(pk);
        HoodfiL1Resolver resolver = new HoodfiL1Resolver(
            "hoodfi.eth", url, signer, ROBINHOOD_CHAIN_ID, l2Registry, owner
        );
        vm.stopBroadcast();

        console.log("HoodfiL1Resolver:", address(resolver));
        console.log("gateway url:", url);
        console.log("signer:", signer);
    }
}
