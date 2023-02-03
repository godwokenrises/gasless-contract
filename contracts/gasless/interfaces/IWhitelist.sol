// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

/*
 * Manage user and contract in whitelist. This interface should be
 * implemented for paymasters.
 * Only user in the whitelist can send gasless tx.
 * Only contract in the whitelist can be used in UserOperation.
 */
interface IWhitelist {
    function addWhitelistUser(address user) external;

    function removeWhitelistUser(address user) external;

    function addWhitelistContract(address contractAddress) external;

    function removeWhitelistContract(address contractAddress) external;
}
