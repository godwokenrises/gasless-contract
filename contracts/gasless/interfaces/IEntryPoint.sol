/**
 ** Account-Abstraction (EIP-4337) singleton EntryPoint implementation.
 ** Only one instance required on each chain.
 **/
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "./UserOperartion.sol";
import "./IStakeManager.sol";

interface IEntryPoint is IStakeManager {
    /***
     * An event emitted after each successful request
     * @param sender - the user that sends this request and asking for sponsor
     * @param paymaster - if non-null, the paymaster that pays for this request.
     * @param actualGasCost - the total cost (in gas) of this request.
     * @param actualGasPrice - the actual gas price the sender agreed to pay.
     * @param success - true if the sender transaction succeeded, false if reverted.
     */
    event UserOperationEvent(
        address indexed sender,
        address indexed paymaster,
        uint256 actualGasCost,
        uint256 actualGasPrice,
        bool success
    );

    /**
     * An event emitted if the UserOperation "callData" reverted with non-zero length
     * @param sender the sender of this request
     * @param revertReason - the return bytes from the (reverted) call to "callData".
     */
    event UserOperationRevertReason(address indexed sender, bytes revertReason);

    /**
     * a custom revert error of handleOp, to identify the offending op.
     *  NOTE: if simulateValidation passes successfully, there should be no reason for handleOps to fail on it.
     *  @param paymaster - if paymaster.validatePaymasterUserOp fails, this will be the paymaster's address. if validateUserOp failed,
     *       this value will be zero (since it failed before accessing the paymaster)
     *  @param reason - revert reason
     *   Should be caught in off-chain handleOps simulation and not happen on-chain.
     *   Useful for mitigating DoS attempts against batchers or for troubleshooting of wallet/paymaster reverts.
     */
    error FailedOp(address paymaster, string reason);

    /**
     * Execute a UserOperation.
     * @param op the operations to execute
     */
    function handleOp(UserOperation calldata op) external;

    /**
     * Simulate a call to paymaster.validatePaymasterUserOp.
     * Validation succeeds if the call doesn't revert.
     * @dev The node must also verify it doesn't use banned opcodes, and that it doesn't reference storage outside the wallet's data.
     *      In order to split the running opcodes of the wallet (validateUserOp) from the paymaster's validatePaymasterUserOp,
     *      it should look for the NUMBER opcode at depth=1 (which itself is a banned opcode)
     * @param userOp the user operation to validate.
     * @return preOpGas total gas used by validation (aka. gasUsedBeforeOperation)
     * @return prefund the amount the paymaster had to prefund
     * @return deadline until what time this userOp is valid (paymaster's deadline)
     */
    function simulateValidation(
        UserOperation calldata userOp
    ) external returns (uint256 preOpGas, uint256 prefund, uint256 deadline);
}
