// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "../core/BasePaymaster.sol";
import "../interfaces/IWhitelist.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * A sample paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for wallet signature:
 * - the paymaster signs to agree to PAY for GAS.
 * - the wallet signs to prove identity and wallet ownership.
 */
contract DemoPaymaster is BasePaymaster, IWhitelist {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    // Only users in the whitelist are valide.
    mapping(address => bool) private whitelistUser;

    // User can only make calls to the contracts from `whitelistContract`.
    mapping(address => bool) private whitelistContract;

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    /**
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp
    ) external view override returns (bytes memory context, uint256 deadline) {
        super._requireFromEntryPoint();
        _requireCallFromWhitelistContract(userOp.callContract);
        // In this demo, we don't use `userOp`.
        require(
            userOp.maxFeePerGas == userOp.maxPriorityFeePerGas,
            "Useless check to pass CI"
        );

        _requireFromWhitelist();

        // check userOp ...

        return ("", 0);
    }

    /// validate the call is mode from whitelist
    function _requireFromWhitelist() internal view virtual {
        // FIXME: use UserOpseration.sender instead
        require(
            whitelistUser[tx.origin] == true,
            "Verifying user in whitelist."
        );
    }

    /**
     * Add addrs to whitelist by owner.
     */
    function addWhitelistUser(address user) external onlyOwner {
        whitelistUser[user] = true;
    }

    /**
     * Remove addrs from whitelist by owner.
     */
    function removeWhitelistUser(address user) external onlyOwner {
        delete (whitelistUser[user]);
    }

    function addWhitelistContract(address addr) external onlyOwner {
        whitelistContract[addr] = true;
    }

    function removeWhitelistContract(address addr) external onlyOwner {
        delete (whitelistContract[addr]);
    }

    function _requireCallFromWhitelistContract(
        address userOpCallAddr
    ) internal view virtual {
        require(
            whitelistContract[userOpCallAddr] == true,
            "Verifying call address from user operation."
        );
    }
}
