// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {HoodfiDonations} from "src/hoodfi/HoodfiDonations.sol";

/// @notice Mainnet deploy. Env: PRIVATE_KEY, optional OWNER (defaults to deployer).
/// Run: forge script scripts/hoodfi/DeployDonations.s.sol --rpc-url mainnet --broadcast --verify
contract DeployDonations is Script {
    address constant CONTROLLER = 0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547;
    address constant BASE_REGISTRAR = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));

        vm.startBroadcast(pk);
        HoodfiDonations donations = new HoodfiDonations(CONTROLLER, BASE_REGISTRAR, owner);

        // Infra blocklist: never reservable via donations.
        bytes32[] memory blocked = new bytes32[](10);
        string[10] memory labels =
            ["www", "reserve", "admin", "wallet", "help", "support", "official", "hoodfi", "mail", "gateway"];
        for (uint256 i = 0; i < labels.length; i++) {
            blocked[i] = keccak256(bytes(labels[i]));
        }
        donations.setBlocklist(blocked, true);
        vm.stopBroadcast();

        console.log("HoodfiDonations:", address(donations));
        console.log("owner:", owner);
    }
}
