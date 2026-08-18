// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice The smallest thing HoodfiSites needs a partner collection to be: something
///         that answers balanceOf. Not a real ERC-721 — the contract only ever asks
///         whether a wallet holds one, never moves anything.
contract MockCollection {
    mapping(address => uint256) public balanceOf;

    function mint(address to) external {
        balanceOf[to] += 1;
    }
}

/// @notice A collection that reverts on every call.
///
/// Exists because partner contracts are third-party code and one of them will eventually
/// be broken, self-destructed or upgraded into something that throws. HoodfiSites must
/// treat that as "not a holder" rather than letting it revert a payment.
contract RevertingCollection {
    function balanceOf(address) external pure returns (uint256) {
        revert("nope");
    }
}

/// @notice A collection that answers with nothing at all.
///
/// An address with no code returns empty data rather than reverting, and a naive
/// abi.decode of that is what turns "this partner address was a typo" into a panic in
/// the middle of a publish.
contract SilentCollection {
    fallback() external {}
}

/// @notice Not a contract at all — the case a mistyped partner address produces.
///         A staticcall to an address with no code SUCCEEDS and returns empty data, so
///         nothing reverts and there is nothing to decode. This is the one that catches
///         a naive `try/catch`.
