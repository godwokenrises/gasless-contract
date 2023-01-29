import { Wallet } from "ethers";
import { ethers } from "hardhat";
import {
  EntryPoint,
  DemoPaymaster,
  DummyContract,
  AlwaysSuccessPaymaster__factory,
} from "../typechain-types";
import { hexConcat, parseEther } from "ethers/lib/utils";
import { UserOperationStruct } from "../typechain-types/contracts/gasless/core/EntryPoint";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { createNonRandomWallet, getOrDeployEntrypointContract } from "./util";

describe("EntryPoint with whitelist paymaster", function () {
  let dummyContractCallData: string;
  let walletOwner: SignerWithAddress;
  let whitelistUser: SignerWithAddress;
  const invalidUser: Wallet = createNonRandomWallet();
  let dummyContract: DummyContract;
  let entryPoint: EntryPoint;
  let alwaysSuccessPaymaster: DemoPaymaster;

  const fullnode: Wallet = createNonRandomWallet();
  const depositAmount = parseEther("0.01");

  beforeEach(async function () {
    const [_walletOwner, _whitelistUser] = await ethers.getSigners();
    walletOwner = _walletOwner;
    whitelistUser = _whitelistUser;
    const DummyContract = await ethers.getContractFactory("DummyContract");
    dummyContract = await DummyContract.deploy();
    console.log(`Deploy dummy contract: ${dummyContract.address}`);
    const testTx = await dummyContract.populateTransaction.test(1, 1);
    dummyContractCallData = testTx.data ?? "";

    entryPoint = await getOrDeployEntrypointContract(fullnode.address, 1, 1);
    // const entryPointAddr = "0xd16f6ec881e60038596c193b534c840455e66f47"
    // const entryPoint = EntryPoint__factory.connect(entryPointAddr, walletOwner)
    // 0xd16f6ec881e60038596c193b534c840455e66f47
    console.log(`Deploy EntryPoint contract: ${entryPoint.address}`);
    console.log(`wallet owner: ${walletOwner.address}`);
    console.log(`User in whitelist: ${whitelistUser.address}`);

    alwaysSuccessPaymaster = await new AlwaysSuccessPaymaster__factory(
      walletOwner
    ).deploy(entryPoint.address);
    console.log(`Always Success Paymaster: ${alwaysSuccessPaymaster.address}`);
    await alwaysSuccessPaymaster.addStake(99999999, {
      value: parseEther("1.02"),
    });
    console.log("add stake for alwaysSuccessPaymaster");
    await entryPoint.depositTo(alwaysSuccessPaymaster.address, {
      value: depositAmount,
    });
    console.log("deposit to entrypoint for always success paymaster");
  });
  describe("#Entrypoint", () => {
    it("should cover cost", async () => {
      const zeroAddr = "0x" + "00".repeat(20);

      const baseUserOp: UserOperationStruct = {
        callContract: dummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        preVerificationGas: 100000,
        paymasterAndData: hexConcat([alwaysSuccessPaymaster.address, "0x1234"]),
      };

      const callGasLimit = await entryPoint
        .connect(zeroAddr)
        .callStatic.simulateCallContract(baseUserOp);
      baseUserOp.callGasLimit = callGasLimit;

      const { preOpGas } = await entryPoint
        .connect(zeroAddr)
        .callStatic.simulateValidation(baseUserOp, { gasPrice: 0 });
      const verificationGasLimit = preOpGas.mul(1);

      baseUserOp.verificationGasLimit = verificationGasLimit;
      const total = await entryPoint.estimateGas.handleOp(baseUserOp, {
        gasPrice: 0,
      });
      baseUserOp.preVerificationGas = total
        .sub(callGasLimit)
        .sub(verificationGasLimit);

      // Mock UserOp
      const userOp: UserOperationStruct = baseUserOp;

      // init state
      const initSum = await dummyContract.sum();
      expect(initSum).to.equal(1);
      const initDeposit = await entryPoint.balanceOf(
        alwaysSuccessPaymaster.address
      );
      expect(initDeposit).to.equal(depositAmount);

      // Send tx with a valid user.
      const tx = await entryPoint
        .connect(invalidUser)
        .handleOp(userOp, { gasLimit: 400000, gasPrice: 0 });
      const receipt = await tx.wait();
      expect(receipt.status).equal(1);
      // check state changed
      const sum = await dummyContract.sum();
      expect(sum).to.equal(2);

      const deposit = await entryPoint.balanceOf(
        alwaysSuccessPaymaster.address
      );
      // todo: it seems hard to make the gas cost equals to the real income on boundler
      // we only check if the income is larger than the real cost
      // in another word, we charge more.
      expect(receipt.gasUsed.mul(userOp.maxFeePerGas as string)).to.lt(
        initDeposit.sub(deposit)
      );
    });
  });
});
