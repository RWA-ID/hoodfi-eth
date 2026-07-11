// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {HoodfiDonations} from "src/hoodfi/HoodfiDonations.sol";
import {MockEthRegistrarController} from "./mocks/MockEthRegistrarController.sol";

contract ReentrantDonor {
    HoodfiDonations public donations;

    constructor(HoodfiDonations _donations) {
        donations = _donations;
    }

    function attack(uint256 numYears) external payable {
        donations.donate{value: msg.value}(numYears, new string[](0));
    }

    receive() external payable {
        // Try to reenter donate() during the refund
        donations.donate{value: msg.value}(1, new string[](0));
    }
}

contract HoodfiDonationsTest is Test {
    MockEthRegistrarController public controller;
    HoodfiDonations public donations;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant PRICE = 0.0027 ether;
    uint256 constant YEAR = 365 days;

    event Donated(address indexed donor, uint256 numYears, uint256 ethPaid, uint256 newExpiry);
    event NameReserved(address indexed donor, bytes32 indexed labelhash, string label);
    event GoalReached(uint256 totalYears, uint256 finalExpiry, uint256 snapshotBlock);

    function setUp() public {
        controller = new MockEthRegistrarController();
        donations = new HoodfiDonations(address(controller), address(controller), owner);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _labels(string memory a) internal pure returns (string[] memory l) {
        l = new string[](1);
        l[0] = a;
    }

    function test_QuoteMatchesOracle() public view {
        assertEq(donations.quote(1), PRICE);
        assertEq(donations.quote(10), PRICE * 10);
    }

    function test_DonateExtendsExpiryAtomically() public {
        uint256 expiryBefore = donations.nameExpires();
        vm.prank(alice);
        donations.donate{value: PRICE * 3}(3, new string[](0));
        assertEq(donations.nameExpires(), expiryBefore + 3 * YEAR);
        assertEq(donations.totalYearsDonated(), 3);
        assertEq(donations.slots(alice), 3);
        assertEq(address(donations).balance, 0, "contract must never hold funds");
    }

    function test_DonateRefundsExcess() public {
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        donations.donate{value: PRICE * 2 + 1 ether}(2, new string[](0));
        assertEq(balBefore - alice.balance, PRICE * 2, "only the renewal cost is kept");
        assertEq(address(donations).balance, 0);
    }

    function test_DonateInsufficientReverts() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                HoodfiDonations.InsufficientPayment.selector, PRICE * 2, PRICE
            )
        );
        donations.donate{value: PRICE}(2, new string[](0));
    }

    function test_DonateZeroYearsReverts() public {
        vm.prank(alice);
        vm.expectRevert(HoodfiDonations.InvalidYears.selector);
        donations.donate(0, new string[](0));
    }

    function test_DonateWithReservation() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit NameReserved(alice, keccak256("blake"), "blake");
        donations.donate{value: PRICE}(1, _labels("blake"));
        assertEq(donations.reservedBy(keccak256("blake")), alice);
        assertEq(donations.usedSlots(alice), 1);
        assertEq(donations.unusedSlots(alice), 0);
    }

    function test_ReserveLaterWithEarnedSlots() public {
        vm.startPrank(alice);
        donations.donate{value: PRICE * 2}(2, new string[](0));
        donations.reserve(_labels("blake"));
        donations.reserve(_labels("jamal"));
        vm.stopPrank();
        assertEq(donations.usedSlots(alice), 2);
    }

    function test_ReserveWithoutSlotsReverts() public {
        vm.prank(alice);
        vm.expectRevert(HoodfiDonations.NotEnoughSlots.selector);
        donations.reserve(_labels("blake"));
    }

    function test_DuplicateReservationReverts() public {
        vm.prank(alice);
        donations.donate{value: PRICE}(1, _labels("blake"));
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(HoodfiDonations.LabelAlreadyReserved.selector, "blake")
        );
        donations.donate{value: PRICE}(1, _labels("blake"));
    }

    function test_ShortAndInvalidLabelsNotReservable() public {
        vm.startPrank(alice);
        donations.donate{value: PRICE * 10}(10, new string[](0));

        string[3] memory bad = ["abc", "Blake", "-abcd"];
        for (uint256 i = 0; i < bad.length; i++) {
            string[] memory l = _labels(bad[i]);
            vm.expectRevert(
                abi.encodeWithSelector(HoodfiDonations.LabelNotReservable.selector, bad[i])
            );
            donations.reserve(l);
        }
        vm.stopPrank();
    }

    function test_BlocklistedLabelReverts() public {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256("admin");
        vm.prank(owner);
        donations.setBlocklist(hashes, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(HoodfiDonations.LabelBlocked.selector, "admin"));
        donations.donate{value: PRICE}(1, _labels("admin"));
        assertEq(donations.reservationStatus("admin"), 2);
    }

    function test_ReservationStatus() public {
        assertEq(donations.reservationStatus("blake"), 0);
        assertEq(donations.reservationStatus("abc"), 3);
        assertEq(donations.reservationStatus("UPPER"), 3);
        vm.prank(alice);
        donations.donate{value: PRICE}(1, _labels("blake"));
        assertEq(donations.reservationStatus("blake"), 1);
    }

    function test_FinalizeBeforeGoalReverts() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 999}(999, new string[](0));
        vm.expectRevert(HoodfiDonations.GoalNotReached.selector);
        donations.finalize();
    }

    function test_FinalizeAtGoalAndFreeze() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 1000}(1000, new string[](0));

        vm.expectEmit(false, false, false, true);
        emit GoalReached(1000, donations.nameExpires(), block.number);
        donations.finalize(); // anyone can call
        assertTrue(donations.finalized());
        assertEq(donations.snapshotBlock(), block.number);

        vm.startPrank(alice);
        vm.expectRevert(HoodfiDonations.AlreadyFinalized.selector);
        donations.donate{value: PRICE}(1, new string[](0));
        vm.expectRevert(HoodfiDonations.AlreadyFinalized.selector);
        donations.reserve(_labels("blake"));
        vm.stopPrank();
    }

    function test_ExtendWorksAfterFinalizeWithoutSlots() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 1000}(1000, new string[](0));
        donations.finalize();

        uint256 expiryBefore = donations.nameExpires();
        vm.prank(bob);
        donations.extend{value: PRICE * 5}(5);
        assertEq(donations.nameExpires(), expiryBefore + 5 * YEAR);
        assertEq(donations.slots(bob), 0, "extend earns no slots");
        assertEq(donations.totalYearsDonated(), 1000, "extend does not count toward goal");
        assertEq(address(donations).balance, 0);
    }

    function test_ReentrancyOnRefundBlocked() public {
        ReentrantDonor attacker = new ReentrantDonor(donations);
        vm.deal(address(attacker), 10 ether);
        // Refund to attacker triggers reentry into donate(), which the guard rejects,
        // making the refund call fail and the whole donation revert.
        vm.expectRevert(HoodfiDonations.RefundFailed.selector);
        attacker.attack{value: PRICE + 1 ether}(1);
    }

    function test_SetBlocklistOnlyOwner() public {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256("admin");
        vm.prank(alice);
        vm.expectRevert();
        donations.setBlocklist(hashes, true);
    }
}
