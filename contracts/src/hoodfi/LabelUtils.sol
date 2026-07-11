// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Shared label validation for hoodfi.eth subnames.
/// @dev Restricting the charset to ASCII [a-z0-9-] means byte length == character
///      length, so no unicode-aware strlen is needed. Frontends must additionally
///      run ENSIP-15 normalization before submitting.
library LabelUtils {
    uint256 internal constant MAX_LABEL_LENGTH = 32;

    /// @notice Minimum length for donor reservations. 1-3 char names are premium
    ///         inventory sold only in the public phase, never reservable via donation.
    uint256 internal constant MIN_RESERVABLE_LENGTH = 4;

    /// @notice Validates charset and length bounds: [a-z0-9-], 1-32 bytes, no edge hyphens.
    function isValidLabel(string memory label) internal pure returns (bool) {
        bytes memory b = bytes(label);
        uint256 len = b.length;
        if (len == 0 || len > MAX_LABEL_LENGTH) return false;
        if (b[0] == "-" || b[len - 1] == "-") return false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "-";
            if (!ok) return false;
        }
        return true;
    }

    function isReservableLabel(string memory label) internal pure returns (bool) {
        return isValidLabel(label) && bytes(label).length >= MIN_RESERVABLE_LENGTH;
    }

    /// @notice Price tier for a label: 0 = 1 char, 1 = 2 chars, 2 = 3 chars, 3 = 4+ chars.
    function tierOf(string memory label) internal pure returns (uint256) {
        uint256 len = bytes(label).length;
        if (len >= 4) return 3;
        return len - 1;
    }

    function labelhash(string memory label) internal pure returns (bytes32) {
        return keccak256(bytes(label));
    }
}
