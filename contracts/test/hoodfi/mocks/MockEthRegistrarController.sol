// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Mimics the live ETHRegistrarController + BaseRegistrar renewal surface:
///      oracle-priced renew that refunds overpayment to msg.sender, like the real one.
contract MockEthRegistrarController {
    uint256 public constant PRICE_PER_YEAR = 0.0027 ether;
    uint256 public constant YEAR = 365 days;

    mapping(uint256 tokenId => uint256) public expiries;

    constructor() {
        // hoodfi.eth starts ~1 year out, mirroring the live state
        expiries[uint256(keccak256("hoodfi"))] = block.timestamp + YEAR;
    }

    function rentPrice(string memory, uint256 duration)
        external
        pure
        returns (uint256 base, uint256 premium)
    {
        return ((duration * PRICE_PER_YEAR) / YEAR, 0);
    }

    function renew(string calldata name, uint256 duration, bytes32) external payable {
        uint256 cost = (duration * PRICE_PER_YEAR) / YEAR;
        require(msg.value >= cost, "insufficient");
        uint256 tokenId = uint256(keccak256(bytes(name)));
        expiries[tokenId] += duration;
        if (msg.value > cost) {
            // The real controller refunds excess to msg.sender
            (bool ok,) = msg.sender.call{value: msg.value - cost}("");
            require(ok, "refund failed");
        }
    }

    function nameExpires(uint256 tokenId) external view returns (uint256) {
        return expiries[tokenId];
    }
}
