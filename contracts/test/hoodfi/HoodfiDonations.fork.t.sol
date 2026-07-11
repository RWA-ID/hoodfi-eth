// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {HoodfiDonations} from "src/hoodfi/HoodfiDonations.sol";

/// @notice Mainnet fork tests against the LIVE ETHRegistrarController. Skipped cleanly
///         when MAINNET_RPC_URL is unset (robot-id pattern).
contract HoodfiDonationsForkTest is Test {
    address constant CONTROLLER = 0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547;
    address constant BASE_REGISTRAR = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;
    uint256 constant YEAR = 365 days;

    HoodfiDonations public donations;
    // NOT makeAddr("alice"): that key is publicly known (keccak("alice")) and the real
    // mainnet address carries an EIP-7702 delegation installed by sweeper bots, which
    // breaks value transfers on a fork. A salted label derives a clean address.
    address public alice = makeAddr("hoodfi.fork.donor.2026");
    bool internal forkEnabled;
    /// @dev The deterministic deploy address can hold real mainnet dust on a fork;
    ///      _refundBalance sweeps it to the first donor, so spend math must subtract it.
    uint256 internal preExistingDust;

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        forkEnabled = true;
        vm.createSelectFork(rpc);
        donations = new HoodfiDonations(CONTROLLER, BASE_REGISTRAR, address(this));
        preExistingDust = address(donations).balance;
        vm.deal(alice, 10 ether);
    }

    function test_Fork_DonateRenewsLiveName() public {
        if (!forkEnabled) return;
        uint256 expiryBefore = donations.nameExpires();
        assertGt(expiryBefore, block.timestamp, "hoodfi.eth should be registered");

        uint256 cost = donations.quote(3);
        assertGt(cost, 0);

        uint256 balBefore = alice.balance;
        string[] memory labels = new string[](1);
        labels[0] = "blake";

        // 5% buffer like the frontend sends; contract must refund the excess
        vm.prank(alice);
        donations.donate{value: (cost * 105) / 100}(3, labels);

        assertEq(donations.nameExpires(), expiryBefore + 3 * YEAR, "expiry moved by 3y");
        assertEq(balBefore - alice.balance, cost - preExistingDust, "only the oracle price kept");
        assertEq(address(donations).balance, 0, "zero-balance invariant");
        assertEq(donations.reservedBy(keccak256("blake")), alice);
    }

    function test_Fork_QuoteIsPlausible() public view {
        if (!forkEnabled) return;
        // hoodfi is 6 chars -> $5/yr tier. Sanity range: $2-$20 worth of ETH at any
        // plausible ETH price ($500-$20k).
        uint256 oneYear = donations.quote(1);
        assertGt(oneYear, 0.0001 ether);
        assertLt(oneYear, 0.04 ether);
    }
}
