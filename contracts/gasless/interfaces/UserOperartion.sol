// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable no-inline-assembly */

/**
 * User Operation struct
 * @param callContract the contract address user wants to call execution.
 * @param callData the method call to execute on callContract contract.
 * @param callGasLimit the max gas limit for method call to execute on callContract contract.
 * @param verificationGasLimit gas used for validateUserOp and validatePaymasterUserOp
 * @param maxFeePerGas same as EIP-1559 gas parameter
 * @param maxPriorityFeePerGas same as EIP-1559 gas parameter
 * @param paymasterAndData if set, this field hold the paymaster address and "paymaster-specific-data". the paymaster will pay for the transaction instead of the sender
 */
struct UserOperation {
    address callContract;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
}

library UserOperationLib {
    //relayer/miner might submit the TX with higher priorityFee, but the user should not
    // pay above what he signed for.
    function gasPrice(
        UserOperation calldata userOp
    ) internal view returns (uint256) {
        unchecked {
            uint256 maxFeePerGas = userOp.maxFeePerGas;
            uint256 maxPriorityFeePerGas = userOp.maxPriorityFeePerGas;
            if (maxFeePerGas == maxPriorityFeePerGas) {
                //legacy mode (for networks that don't support basefee opcode)
                return maxFeePerGas;
            }
            return min(maxFeePerGas, maxPriorityFeePerGas + block.basefee);
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
