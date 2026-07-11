// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NameEncoder} from "@ensdomains/ens-contracts/utils/NameEncoder.sol";

import {HoodfiL1Resolver} from "src/hoodfi/HoodfiL1Resolver.sol";
import {SignatureVerifier} from "src/lib/SignatureVerifier.sol";

contract HoodfiL1ResolverTest is Test {
    HoodfiL1Resolver public resolver;

    address public owner = makeAddr("owner");
    address public gatewaySigner;
    uint256 public gatewaySignerKey;

    uint64 constant ROBINHOOD_CHAIN_ID = 4663;
    address constant L2_REGISTRY = address(0xBEEF);
    string constant GATEWAY_URL = "https://hoodfi-gateway.example.workers.dev/v1/{sender}/{data}";

    bytes32 public parentNode;
    bytes public parentDnsName;
    bytes public subDnsName;

    function setUp() public {
        (gatewaySigner, gatewaySignerKey) = makeAddrAndKey("gatewaySigner");
        resolver = new HoodfiL1Resolver(
            "hoodfi.eth", GATEWAY_URL, gatewaySigner, ROBINHOOD_CHAIN_ID, L2_REGISTRY, owner
        );
        (parentDnsName, parentNode) = NameEncoder.dnsEncodeName("hoodfi.eth");
        (subDnsName,) = NameEncoder.dnsEncodeName("blake.hoodfi.eth");
    }

    /*//////////////////////////////////////////////////////////////
                           APEX (ONCHAIN) PATH
    //////////////////////////////////////////////////////////////*/

    function test_ApexAddrResolvesOnchain() public {
        vm.prank(owner);
        resolver.setAddr(parentNode, address(0x1234));

        bytes memory result = resolver.resolve(
            parentDnsName, abi.encodeWithSignature("addr(bytes32)", parentNode)
        );
        assertEq(abi.decode(result, (address)), address(0x1234));
        // Direct legacy call path also works
        assertEq(resolver.addr(parentNode), address(0x1234));
    }

    function test_ApexTextAndContenthash() public {
        vm.startPrank(owner);
        resolver.setText(parentNode, "url", "https://hoodfi.eth.limo");
        resolver.setContenthash(parentNode, hex"e30101701220aabbcc");
        vm.stopPrank();

        bytes memory textResult = resolver.resolve(
            parentDnsName, abi.encodeWithSignature("text(bytes32,string)", parentNode, "url")
        );
        assertEq(abi.decode(textResult, (string)), "https://hoodfi.eth.limo");

        bytes memory chResult = resolver.resolve(
            parentDnsName, abi.encodeWithSignature("contenthash(bytes32)", parentNode)
        );
        assertEq(abi.decode(chResult, (bytes)), hex"e30101701220aabbcc");
    }

    function test_ApexMulticoinAddr() public {
        bytes memory btcScript = hex"0014aabbccddeeff00112233445566778899aabbccdd";
        vm.prank(owner);
        resolver.setAddr(parentNode, 0, btcScript);
        bytes memory result = resolver.resolve(
            parentDnsName, abi.encodeWithSignature("addr(bytes32,uint256)", parentNode, uint256(0))
        );
        assertEq(abi.decode(result, (bytes)), btcScript);
    }

    function test_ApexUnknownRecordReturnsEmpty() public view {
        bytes memory result = resolver.resolve(
            parentDnsName, abi.encodeWithSignature("pubkey(bytes32)", parentNode)
        );
        assertEq(result.length, 0);
    }

    function test_RecordSettersOnlyOwner() public {
        vm.expectRevert();
        resolver.setAddr(parentNode, address(0x1234));
        vm.expectRevert();
        resolver.setContenthash(parentNode, hex"aa");
    }

    /*//////////////////////////////////////////////////////////////
                        SUBNAME (CCIP-READ) PATH
    //////////////////////////////////////////////////////////////*/

    function test_SubnameRevertsOffchainLookup() public {
        bytes memory data = abi.encodeWithSignature("addr(bytes32)", bytes32(uint256(1)));

        try resolver.resolve(subDnsName, data) {
            fail();
        } catch (bytes memory err) {
            bytes4 selector = bytes4(err);
            assertEq(selector, HoodfiL1Resolver.OffchainLookup.selector);

            // Strip the selector and decode the error payload
            bytes memory payload = new bytes(err.length - 4);
            for (uint256 i = 0; i < payload.length; i++) {
                payload[i] = err[i + 4];
            }
            (
                address sender,
                string[] memory urls,
                bytes memory callData,
                bytes4 callbackFunction,
                bytes memory extraData
            ) = abi.decode(payload, (address, string[], bytes, bytes4, bytes));

            assertEq(sender, address(resolver));
            assertEq(urls.length, 1);
            assertEq(urls[0], GATEWAY_URL);
            assertEq(callbackFunction, HoodfiL1Resolver.resolveWithProof.selector);
            assertEq(keccak256(callData), keccak256(extraData), "extraData mirrors callData");

            // The stuffed call embeds the L2 target for the gateway
            bytes memory args = new bytes(callData.length - 4);
            for (uint256 i = 0; i < args.length; i++) {
                args[i] = callData[i + 4];
            }
            (bytes memory name, bytes memory innerData, uint64 chainId, address registryAddr) =
                abi.decode(args, (bytes, bytes, uint64, address));
            assertEq(keccak256(name), keccak256(subDnsName));
            assertEq(keccak256(innerData), keccak256(data));
            assertEq(chainId, ROBINHOOD_CHAIN_ID);
            assertEq(registryAddr, L2_REGISTRY);
        }
    }

    function test_ResolveWithProofVerifiesSignature() public view {
        bytes memory request = hex"deadbeef";
        bytes memory result = abi.encode(address(0x1234));
        uint64 expires = uint64(block.timestamp + 1000);

        bytes memory response = _signResponse(gatewaySignerKey, request, result, expires);
        bytes memory out = resolver.resolveWithProof(response, request);
        assertEq(keccak256(out), keccak256(result));
    }

    function test_ResolveWithProofWrongSignerReverts() public {
        (, uint256 mallorySignerKey) = makeAddrAndKey("mallory");
        bytes memory request = hex"deadbeef";
        bytes memory result = abi.encode(address(0x1234));
        uint64 expires = uint64(block.timestamp + 1000);

        bytes memory response = _signResponse(mallorySignerKey, request, result, expires);
        vm.expectRevert(HoodfiL1Resolver.InvalidSignature.selector);
        resolver.resolveWithProof(response, request);
    }

    function test_ResolveWithProofExpiredReverts() public {
        vm.warp(1_000_000);
        bytes memory request = hex"deadbeef";
        bytes memory result = abi.encode(address(0x1234));
        uint64 expires = uint64(block.timestamp - 1);

        bytes memory response = _signResponse(gatewaySignerKey, request, result, expires);
        vm.expectRevert("SignatureVerifier: Signature expired");
        resolver.resolveWithProof(response, request);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERFACES + ADMIN
    //////////////////////////////////////////////////////////////*/

    function test_SupportsInterfaceFullSet() public view {
        assertTrue(resolver.supportsInterface(0x9061b923), "ENSIP-10");
        assertTrue(resolver.supportsInterface(0x3b3b57de), "addr");
        assertTrue(resolver.supportsInterface(0xf1cb7e06), "addr multicoin");
        assertTrue(resolver.supportsInterface(0x59d1d43c), "text");
        assertTrue(resolver.supportsInterface(0xbc1c58d1), "contenthash");
        assertTrue(resolver.supportsInterface(0x01ffc9a7), "ERC-165");
        assertFalse(resolver.supportsInterface(0xffffffff));
    }

    function test_AdminSetters() public {
        vm.startPrank(owner);
        resolver.setUrl("https://new.example/{sender}/{data}");
        resolver.setSigner(address(0xABCD));
        resolver.setL2Registry(999, address(0xCAFE));
        vm.stopPrank();
        assertEq(resolver.url(), "https://new.example/{sender}/{data}");
        assertEq(resolver.signer(), address(0xABCD));
        assertEq(resolver.targetChainId(), 999);
        assertEq(resolver.targetRegistry(), address(0xCAFE));

        vm.expectRevert();
        resolver.setSigner(address(1));
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Mirrors the gateway's signing exactly: 0x1900 ‖ resolver ‖ expires ‖
    ///      keccak(request) ‖ keccak(result), raw digest (not EIP-191).
    function _signResponse(
        uint256 signerKey,
        bytes memory request,
        bytes memory result,
        uint64 expires
    ) internal view returns (bytes memory) {
        bytes32 digest = SignatureVerifier.makeSignatureHash(
            address(resolver), expires, request, result
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encode(result, expires, abi.encodePacked(r, s, v));
    }
}
