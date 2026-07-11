// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IExtendedResolver} from "@ensdomains/ens-contracts/resolvers/profiles/IExtendedResolver.sol";
import {NameEncoder} from "@ensdomains/ens-contracts/utils/NameEncoder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SignatureVerifier} from "../lib/SignatureVerifier.sol";

/// @dev Wire-format interface shared with the CCIP gateway (same shape as Durin's
///      L1Resolver, so Durin-style gateways work unchanged).
interface IResolverService {
    function stuffedResolveCall(
        bytes calldata name,
        bytes calldata data,
        uint64 targetChainId,
        address targetRegistryAddress
    ) external view returns (bytes memory result, uint64 expires, bytes memory sig);
}

/// @title HoodfiL1Resolver
/// @notice Mainnet resolver for hoodfi.eth. Single-tenant fork of Durin's L1Resolver:
///         - Apex (hoodfi.eth) records are stored ONCHAIN here, so legacy clients and
///           eth.limo keep working with no gateway dependency for the website.
///         - Subnames (*.hoodfi.eth) resolve via ENSIP-10 wildcard + EIP-3668 CCIP-Read
///           against the L2Registry on Robinhood Chain, through a trusted-signer gateway.
///         - supportsInterface advertises the record profiles (addr/addr-multicoin/text/
///           contenthash): ethers-based clients probe these before querying.
contract HoodfiL1Resolver is IExtendedResolver, Ownable {
    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice namehash of the parent name (hoodfi.eth).
    bytes32 public immutable parentNode;
    /// @dev keccak256 of the DNS-encoded parent name; resolve() compares against this
    ///      to route apex queries onchain instead of to the gateway.
    bytes32 public immutable parentNameHash;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    string public url;
    address public signer;
    uint64 public targetChainId;
    address public targetRegistry;

    mapping(bytes32 node => mapping(uint256 coinType => bytes)) private _addrs;
    mapping(bytes32 node => mapping(string key => string)) private _texts;
    mapping(bytes32 node => bytes) private _contenthashes;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event GatewayChanged(string url);
    event SignerChanged(address signer);
    event L2RegistrySet(uint64 chainId, address registry);
    event AddrChanged(bytes32 indexed node, address a);
    event AddressChanged(bytes32 indexed node, uint256 coinType, bytes newAddress);
    event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value);
    event ContenthashChanged(bytes32 indexed node, bytes hash);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidSignature();
    error OffchainLookup(
        address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData
    );

    constructor(
        string memory _parentName,
        string memory _url,
        address _signer,
        uint64 _targetChainId,
        address _targetRegistry,
        address _owner
    ) Ownable(_owner) {
        (bytes memory dnsName, bytes32 node) = NameEncoder.dnsEncodeName(_parentName);
        parentNode = node;
        parentNameHash = keccak256(dnsName);
        url = _url;
        signer = _signer;
        targetChainId = _targetChainId;
        targetRegistry = _targetRegistry;
        emit GatewayChanged(_url);
        emit SignerChanged(_signer);
        emit L2RegistrySet(_targetChainId, _targetRegistry);
    }

    /*//////////////////////////////////////////////////////////////
                        ENSIP-10 RESOLUTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Resolves a name as specified by ENSIP-10.
    /// @param name The DNS-encoded name to resolve.
    /// @param data ABI-encoded record call (addr(bytes32), text(bytes32,string), ...).
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        override
        returns (bytes memory)
    {
        if (keccak256(name) == parentNameHash) {
            // Apex query: answer from onchain storage by dispatching the record call
            // against this contract. Unknown record types return empty bytes.
            (bool ok, bytes memory result) = address(this).staticcall(data);
            if (ok) return result;
            return "";
        }

        bytes memory callData = abi.encodeWithSelector(
            IResolverService.stuffedResolveCall.selector, name, data, targetChainId, targetRegistry
        );
        string[] memory urls = new string[](1);
        urls[0] = url;

        revert OffchainLookup(
            address(this), urls, callData, HoodfiL1Resolver.resolveWithProof.selector, callData
        );
    }

    /// @notice EIP-3668 callback: verifies the gateway's signed response.
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (address _signer, bytes memory result) = SignatureVerifier.verify(extraData, response);
        if (_signer != signer) revert InvalidSignature();
        return result;
    }

    function supportsInterface(bytes4 interfaceID) public pure returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId // 0x9061b923 ENSIP-10
            || interfaceID == 0x3b3b57de // addr(bytes32)
            || interfaceID == 0xf1cb7e06 // addr(bytes32,uint256)
            || interfaceID == 0x59d1d43c // text(bytes32,string)
            || interfaceID == 0xbc1c58d1 // contenthash(bytes32)
            || interfaceID == 0x01ffc9a7; // ERC-165
    }

    /*//////////////////////////////////////////////////////////////
                      ONCHAIN RECORDS (APEX)
    //////////////////////////////////////////////////////////////*/

    function addr(bytes32 node) public view returns (address) {
        bytes memory a = _addrs[node][60];
        if (a.length != 20) return address(0);
        return address(bytes20(a));
    }

    function addr(bytes32 node, uint256 coinType) public view returns (bytes memory) {
        return _addrs[node][coinType];
    }

    function text(bytes32 node, string calldata key) public view returns (string memory) {
        return _texts[node][key];
    }

    function contenthash(bytes32 node) public view returns (bytes memory) {
        return _contenthashes[node];
    }

    function setAddr(bytes32 node, address a) external onlyOwner {
        _addrs[node][60] = abi.encodePacked(a);
        emit AddrChanged(node, a);
        emit AddressChanged(node, 60, abi.encodePacked(a));
    }

    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external onlyOwner {
        _addrs[node][coinType] = a;
        emit AddressChanged(node, coinType, a);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external onlyOwner {
        _texts[node][key] = value;
        emit TextChanged(node, key, key, value);
    }

    function setContenthash(bytes32 node, bytes calldata hash) external onlyOwner {
        _contenthashes[node] = hash;
        emit ContenthashChanged(node, hash);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setUrl(string calldata _url) external onlyOwner {
        url = _url;
        emit GatewayChanged(_url);
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit SignerChanged(_signer);
    }

    function setL2Registry(uint64 _chainId, address _registry) external onlyOwner {
        targetChainId = _chainId;
        targetRegistry = _registry;
        emit L2RegistrySet(_chainId, _registry);
    }
}
