// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {L2Registry} from "src/L2Registry.sol";
import {L2RegistryFactory} from "src/L2RegistryFactory.sol";
import {HoodfiRegistrar} from "src/hoodfi/HoodfiRegistrar.sol";

/// @notice Robinhood Chain deploy: registry implementation + factory + hoodfi.eth
///         registry + phase-aware registrar (starts Paused).
/// Env: PRIVATE_KEY, TREASURY, optional USDC (settable later), optional prices.
/// Run: forge script scripts/hoodfi/DeployL2.s.sol --rpc-url robinhood --broadcast
contract DeployL2 is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("TREASURY", deployer);
        address usdc = vm.envOr("USDC", address(0));

        // Launch defaults: $15 / $10 / $5 / $3 at the ETH rate set here.
        // Owner-settable later via setPrices as ETH/USD drifts.
        uint256[4] memory priceWei = [
            vm.envOr("PRICE_WEI_1", uint256(0.0082 ether)),
            vm.envOr("PRICE_WEI_2", uint256(0.0055 ether)),
            vm.envOr("PRICE_WEI_3", uint256(0.0027 ether)),
            vm.envOr("PRICE_WEI_4", uint256(0.0016 ether))
        ];

        vm.startBroadcast(pk);
        L2RegistryFactory factory = new L2RegistryFactory(address(new L2Registry()));
        L2Registry registry =
            L2Registry(factory.deployRegistry("hoodfi.eth", "HOODFI", "", deployer));
        HoodfiRegistrar registrar =
            new HoodfiRegistrar(address(registry), treasury, priceWei, deployer);
        registry.addRegistrar(address(registrar));
        if (usdc != address(0)) {
            registrar.setUsdc(usdc);
        }
        vm.stopBroadcast();

        console.log("L2RegistryFactory:", address(factory));
        console.log("L2Registry (hoodfi.eth):", address(registry));
        console.log("HoodfiRegistrar:", address(registrar));
        console.log("treasury:", treasury);
    }
}
