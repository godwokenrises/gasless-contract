import { Wallet } from "ethers";
import { ethers } from "hardhat";
import {
  EntryPoint,
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
  const user: Wallet = createNonRandomWallet();
  let dummyContract: DummyContract;
  let entryPoint: EntryPoint;

  const fullnode: Wallet = createNonRandomWallet();

  beforeEach(async function () {
    const [_walletOwner] = await ethers.getSigners();
    walletOwner = _walletOwner;
    const DummyContract = await ethers.getContractFactory("DummyContract");
    dummyContract = await DummyContract.deploy();
    await dummyContract.deployed();
    console.log(`Deploy dummy contract: ${dummyContract.address}`);
    const testTx = await dummyContract.populateTransaction.test(1, 1);
    dummyContractCallData = testTx.data ?? "";

    entryPoint = await getOrDeployEntrypointContract(fullnode.address, 1, 1);
    // const entryPointAddr = "0xd16f6ec881e60038596c193b534c840455e66f47"
    // const entryPoint = EntryPoint__factory.connect(entryPointAddr, walletOwner)
    // 0xd16f6ec881e60038596c193b534c840455e66f47
    console.log(`Deploy EntryPoint contract: ${entryPoint.address}`);
    console.log(`wallet owner: ${walletOwner.address}`);
  });
  describe("#Pausable", () => {
    it("pause and unpause", async () => {
      const alwaysSuccessPaymaster = await new AlwaysSuccessPaymaster__factory(
        walletOwner
      ).deploy(entryPoint.address);
      console.log(
        `Always Success Paymaster: ${alwaysSuccessPaymaster.address}`
      );
      await alwaysSuccessPaymaster.addStake(99999999, {
        value: parseEther("1.02"),
      });
      console.log("add stake for alwaysSuccessPaymaster");
      await entryPoint.depositTo(alwaysSuccessPaymaster.address, {
        value: parseEther("0.01"),
      });
      console.log("deposit to entrypoint for always success paymaster");

      // Mock UserOp
      const userOp: UserOperationStruct = {
        callContract: dummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([alwaysSuccessPaymaster.address, "0x1234"]),
      };

      // init state
      const initSum = await dummyContract.sum();
      expect(initSum).to.equal(1);
      // Send tx with a user.
      const tx = await entryPoint
        .connect(user)
        .handleOp(userOp, { gasLimit: 400000, gasPrice: 0 });
      await tx.wait();
      // check state changed
      const sum = await dummyContract.sum();
      expect(sum).to.equal(2);

      // pause the entrypoint
      await entryPoint.pause();

      // failed to call now
      await expect(
        entryPoint
          .connect(user)
          .callStatic.handleOp(userOp, { gasLimit: 400000, gasPrice: 0 })
      ).to.be.revertedWith("Pausable: paused");

      // unpaused
      await entryPoint.unpause();

      const tx2 = await entryPoint
        .connect(user)
        .handleOp(userOp, { gasLimit: 400000, gasPrice: 0 });
      const receipt2 = await tx2.wait();
      expect(receipt2.status).to.equal(1);
    });

    it("only owner can pause and unpause", async () => {
      await expect(
        entryPoint.connect(user).callStatic.pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      const tx = await entryPoint.connect(walletOwner).pause();
      await tx.wait();
      expect(await entryPoint.paused()).to.equal(true);

      await expect(
        entryPoint.connect(user).callStatic.unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      const tx2 = await entryPoint.connect(walletOwner).unpause();
      await tx2.wait();
      expect(await entryPoint.paused()).to.equal(false);
    });
  });
});
