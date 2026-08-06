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
        donations.donate{value: msg.value}(numYears);
    }

    receive() external payable {
        // Try to reenter donate() during the refund
        donations.donate{value: msg.value}(1);
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

    event Donated(
        address indexed donor,
        uint256 numYears,
        uint256 ethPaid,
        uint256 newExpiry,
        uint256 creditsTotal,
        uint256 totalYears
    );
    event GoalReached(uint256 totalYears, uint256 finalExpiry, uint256 snapshotBlock);
    event Extended(address indexed supporter, uint256 numYears, uint256 ethPaid, uint256 newExpiry);

    function setUp() public {
        controller = new MockEthRegistrarController();
        donations = new HoodfiDonations(address(controller), address(controller), owner);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                 QUOTES
    //////////////////////////////////////////////////////////////*/

    function test_QuoteMatchesOracle() public view {
        assertEq(donations.quote(1), PRICE);
        assertEq(donations.quote(10), PRICE * 10);
    }

    function test_GoalIs100Years() public view {
        assertEq(donations.GOAL_YEARS(), 100);
    }

    /*//////////////////////////////////////////////////////////////
                               DONATING
    //////////////////////////////////////////////////////////////*/

    function test_DonateRenewsAndCredits() public {
        uint256 expiryBefore = donations.nameExpires();
        vm.prank(alice);
        donations.donate{value: PRICE}(1);

        assertEq(donations.nameExpires(), expiryBefore + YEAR);
        assertEq(donations.totalYearsDonated(), 1);
        assertEq(donations.totalDonations(), 1);
        assertEq(donations.shortCredits(alice), 1);
    }

    function test_OneCreditPerYear() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 5}(5);
        assertEq(donations.shortCredits(alice), 5, "5 years = 5 credits");
    }

    function test_CreditsAccumulateAcrossDonations() public {
        vm.startPrank(alice);
        donations.donate{value: PRICE * 2}(2);
        donations.donate{value: PRICE * 3}(3);
        vm.stopPrank();
        assertEq(donations.shortCredits(alice), 5);
        assertEq(donations.totalDonations(), 2);
    }

    function test_CreditsArePerDonor() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 2}(2);
        vm.prank(bob);
        donations.donate{value: PRICE}(1);
        assertEq(donations.shortCredits(alice), 2);
        assertEq(donations.shortCredits(bob), 1);
        assertEq(donations.totalYearsDonated(), 3);
    }

    function test_DonateEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit Donated(alice, 2, PRICE * 2, donations.nameExpires() + 2 * YEAR, 2, 2);
        vm.prank(alice);
        donations.donate{value: PRICE * 2}(2);
    }

    function test_OverpaymentIsRefunded() public {
        uint256 before = alice.balance;
        vm.prank(alice);
        donations.donate{value: 1 ether}(1);
        assertEq(alice.balance, before - PRICE, "only oracle price kept");
        assertEq(address(donations).balance, 0, "zero-balance invariant");
    }

    function test_UnderpaymentReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(HoodfiDonations.InsufficientPayment.selector, PRICE, PRICE - 1)
        );
        vm.prank(alice);
        donations.donate{value: PRICE - 1}(1);
    }

    function test_ZeroYearsReverts() public {
        vm.expectRevert(HoodfiDonations.InvalidYears.selector);
        vm.prank(alice);
        donations.donate{value: PRICE}(0);
    }

    function test_TooManyYearsReverts() public {
        vm.expectRevert(HoodfiDonations.InvalidYears.selector);
        vm.prank(alice);
        donations.donate{value: 100 ether}(101);
    }

    function test_MaxYearsInOneDonationHitsGoal() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 100}(100);
        assertTrue(donations.goalReached());
        assertEq(donations.shortCredits(alice), 100);
    }

    function test_ReentrancyBlocked() public {
        ReentrantDonor attacker = new ReentrantDonor(donations);
        vm.deal(address(attacker), 10 ether);
        vm.expectRevert();
        attacker.attack{value: 1 ether}(1);
    }

    /*//////////////////////////////////////////////////////////////
                            GOAL & FINALIZE
    //////////////////////////////////////////////////////////////*/

    function test_GoalReachedView() public {
        assertFalse(donations.goalReached());
        assertEq(donations.yearsRemaining(), 100);

        vm.prank(alice);
        donations.donate{value: PRICE * 40}(40);
        assertFalse(donations.goalReached());
        assertEq(donations.yearsRemaining(), 60);

        vm.prank(bob);
        donations.donate{value: PRICE * 60}(60);
        assertTrue(donations.goalReached());
        assertEq(donations.yearsRemaining(), 0);
    }

    function test_FinalizeRevertsBeforeGoal() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 99}(99);
        vm.expectRevert(HoodfiDonations.GoalNotReached.selector);
        donations.finalize();
    }

    function test_FinalizeAtGoal() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 100}(100);
        donations.finalize();
        assertTrue(donations.finalized());
        assertEq(donations.snapshotBlock(), block.number);
    }

    function test_FinalizeIsIdempotentlyGuarded() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 100}(100);
        donations.finalize();
        vm.expectRevert(HoodfiDonations.AlreadyFinalized.selector);
        donations.finalize();
    }

    /// @dev Unlike v1, donations must keep working after the goal — the drive continues
    ///      and late donors still earn credits (which mint free even once shorts open).
    function test_DonationsContinueAfterFinalize() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 100}(100);
        donations.finalize();

        vm.prank(bob);
        donations.donate{value: PRICE * 2}(2);
        assertEq(donations.shortCredits(bob), 2, "late donors still earn credits");
        assertEq(donations.totalYearsDonated(), 102);
    }

    /*//////////////////////////////////////////////////////////////
                                EXTEND
    //////////////////////////////////////////////////////////////*/

    function test_ExtendRenewsWithoutCredits() public {
        uint256 expiryBefore = donations.nameExpires();
        vm.prank(alice);
        donations.extend{value: PRICE * 2}(2);

        assertEq(donations.nameExpires(), expiryBefore + 2 * YEAR);
        assertEq(donations.shortCredits(alice), 0, "extend earns no credits");
        assertEq(donations.totalYearsDonated(), 0, "extend does not count toward the goal");
    }

    function test_ExtendRefundsOverpayment() public {
        uint256 before = alice.balance;
        vm.prank(alice);
        donations.extend{value: 1 ether}(1);
        assertEq(alice.balance, before - PRICE);
        assertEq(address(donations).balance, 0);
    }

    function test_ExtendWorksAfterFinalize() public {
        vm.prank(alice);
        donations.donate{value: PRICE * 100}(100);
        donations.finalize();
        uint256 expiryBefore = donations.nameExpires();
        vm.prank(bob);
        donations.extend{value: PRICE}(1);
        assertEq(donations.nameExpires(), expiryBefore + YEAR);
    }

    function test_ExtendZeroYearsReverts() public {
        vm.expectRevert(HoodfiDonations.InvalidYears.selector);
        vm.prank(alice);
        donations.extend{value: PRICE}(0);
    }

    /*//////////////////////////////////////////////////////////////
                                 FUZZ
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CreditsAlwaysEqualYearsDonated(uint8 a, uint8 b) public {
        uint256 yearsA = bound(a, 1, 100);
        uint256 yearsB = bound(b, 1, 100);

        vm.prank(alice);
        donations.donate{value: PRICE * yearsA}(yearsA);
        vm.prank(alice);
        donations.donate{value: PRICE * yearsB}(yearsB);

        assertEq(donations.shortCredits(alice), yearsA + yearsB);
        assertEq(donations.totalYearsDonated(), yearsA + yearsB);
        assertEq(address(donations).balance, 0);
    }

    function testFuzz_ZeroBalanceInvariant(uint96 overpay) public {
        uint256 value = PRICE + bound(overpay, 0, 50 ether);
        vm.prank(alice);
        donations.donate{value: value}(1);
        assertEq(address(donations).balance, 0);
    }
}
