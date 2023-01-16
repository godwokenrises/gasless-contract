// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "../core/BasePaymaster.sol";
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
contract DemoPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    /**
     * verify our external signer signed this request.
     * the "paymasterAndData" is expected to be the paymaster and a signature over the entire request params
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp
    ) external view override returns (bytes memory context, uint256 deadline) {
        super._requireFromEntryPoint();
        super._requireCallFromAvailAddrs(userOp.callContract);
        // In this demo, we don't use `userOp`.
        require(
            userOp.maxFeePerGas == userOp.maxPriorityFeePerGas,
            "Useless check to pass CI"
        );

        super._requireFromWhitelist();

        // check userOp ...

        return ("", 0);
    }
}
