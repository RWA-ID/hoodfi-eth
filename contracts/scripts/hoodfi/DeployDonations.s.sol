// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {HoodfiDonations} from "src/hoodfi/HoodfiDonations.sol";

/// @notice Mainnet deploy. Env: PRIVATE_KEY, optional OWNER (defaults to deployer).
/// Run: forge script scripts/hoodfi/DeployDonations.s.sol --rpc-url mainnet --broadcast --verify
///
/// @dev v2 has no blocklist — it no longer tracks label reservations at all. Labels are
///      chosen at mint time on Robinhood Chain, so the infra blocklist lives on
///      HoodfiRegistrar (see UpgradeRegistrar.s.sol).
contract DeployDonations is Script {
    address constant CONTROLLER = 0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547;
    address constant BASE_REGISTRAR = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));

        vm.startBroadcast(pk);
        HoodfiDonations donations = new HoodfiDonations(CONTROLLER, BASE_REGISTRAR, owner);
        vm.stopBroadcast();

        console.log("HoodfiDonations:", address(donations));
        console.log("owner:", owner);
        console.log("goal years:", donations.GOAL_YEARS());
        console.log("current expiry:", donations.nameExpires());
    }
}
