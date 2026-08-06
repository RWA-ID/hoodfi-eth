// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {L2Registry} from "src/L2Registry.sol";
import {HoodfiRegistrar} from "src/hoodfi/HoodfiRegistrar.sol";

/// @notice Deploys HoodfiRegistrar v2 against the EXISTING live L2Registry and swaps it in.
///
///         Deliberately does NOT redeploy the registry: keeping
///         0xf2bABA012244bdD7445129597350054E1B3aEe5C preserves every already-minted name
///         (test1000.hoodfi.eth), the baseURI/NFT metadata wiring, the CCIP gateway config
///         and mainnet resolution. Only the minting logic is replaced.
///
/// Env: PRIVATE_KEY (must own the registry), CREDIT_SIGNER, optional REGISTRY, TREASURY,
///      USDC, OLD_REGISTRAR, PRICE_WEI_1..4.
/// Run: forge script scripts/hoodfi/UpgradeRegistrar.s.sol --rpc-url robinhood --broadcast
contract UpgradeRegistrar is Script {
    address constant REGISTRY = 0xf2bABA012244bdD7445129597350054E1B3aEe5C;
    address constant OLD_REGISTRAR = 0x75d61F7d87C5A0F4a52Fe526642c80d0Ef994f51;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TREASURY = 0x2D037f66b9e0EDE90c2080558a7d3FF7BE36E9A1;

    /// @dev Infra + brand labels that must never be mintable. Short entries matter most:
    ///      "www" and "api" are 3 chars, so without this they would be sellable premium
    ///      inventory the moment shorts open.
    function _blocklistLabels() internal pure returns (string[24] memory) {
        return [
            "www",
            "api",
            "app",
            "cdn",
            "dev",
            "mx",
            "ns",
            "mail",
            "admin",
            "root",
            "help",
            "docs",
            "blog",
            "shop",
            "pay",
            "wallet",
            "support",
            "official",
            "reserve",
            "gateway",
            "status",
            "hoodfi",
            "robinhood",
            "hood"
        ];
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address registryAddr = vm.envOr("REGISTRY", REGISTRY);
        address oldRegistrar = vm.envOr("OLD_REGISTRAR", OLD_REGISTRAR);
        address treasury = vm.envOr("TREASURY", TREASURY);
        address usdc = vm.envOr("USDC", USDG);
        // The gateway's signer. Vouchers it signs are what unlock short-name mints.
        address creditSigner = vm.envAddress("CREDIT_SIGNER");

        // Launch defaults: $15 / $10 / $5 / $3. Owner-settable via setPrices as ETH drifts.
        uint256[4] memory priceWei = [
            vm.envOr("PRICE_WEI_1", uint256(0.0082 ether)),
            vm.envOr("PRICE_WEI_2", uint256(0.0055 ether)),
            vm.envOr("PRICE_WEI_3", uint256(0.0027 ether)),
            vm.envOr("PRICE_WEI_4", uint256(0.0016 ether))
        ];

        L2Registry registry = L2Registry(registryAddr);
        require(registry.owner() == deployer, "deployer must own the registry");

        vm.startBroadcast(pk);
        HoodfiRegistrar registrar =
            new HoodfiRegistrar(registryAddr, treasury, creditSigner, priceWei, deployer);

        string[24] memory labels = _blocklistLabels();
        bytes32[] memory blocked = new bytes32[](labels.length);
        for (uint256 i = 0; i < labels.length; i++) {
            blocked[i] = keccak256(bytes(labels[i]));
        }
        registrar.setBlocklist(blocked, true);

        if (usdc != address(0)) {
            registrar.setUsdc(usdc);
        }

        // Authorize the new registrar, then retire the old one so only one contract
        // can mint. Order matters: add before remove, so there is no window with none.
        registry.addRegistrar(address(registrar));
        if (oldRegistrar != address(0)) {
            registry.removeRegistrar(oldRegistrar);
        }
        vm.stopBroadcast();

        console.log("HoodfiRegistrar v2:", address(registrar));
        console.log("registry (unchanged):", registryAddr);
        console.log("old registrar retired:", oldRegistrar);
        console.log("credit signer:", creditSigner);
        console.log("treasury:", treasury);
        console.log("usdg:", usdc);
        console.log("shorts open:", registrar.shortsOpen());
        console.log("paused:", registrar.paused());
    }
}
