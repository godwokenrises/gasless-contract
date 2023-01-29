import { BigNumber, Contract, ContractFactory, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import {
  EntryPoint,
  DemoPaymaster,
  DemoPaymaster__factory,
  DummyContract,
  AlwaysSuccessPaymaster__factory,
} from "../typechain-types";
import { hexConcat, parseEther } from "ethers/lib/utils";
import { UserOperationStruct } from "../typechain-types/contracts/gasless/core/EntryPoint";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { readFile } from "fs/promises";
import abi from "../erc20/abi.json";
import { createNonRandomWallet, getOrDeployEntrypointContract } from "./util";

describe("EntryPoint with whitelist paymaster", function () {
  let dummyContractCallData: string;
  let walletOwner: SignerWithAddress;
  let whitelistUser: SignerWithAddress;
  const invalidUser: Wallet = createNonRandomWallet();
  let dummyContract: DummyContract;
  let entryPoint: EntryPoint;
  let paymaster: DemoPaymaster;

  const fullnode: Wallet = createNonRandomWallet();

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

    paymaster = await new DemoPaymaster__factory(walletOwner).deploy(
      entryPoint.address
    );
    console.log(`Paymaster: ${paymaster.address}`);
    // add DummyContract to paymaster
    await paymaster.addAvailAddr(dummyContract.address);

    const paymasterStake = await entryPoint.paymasterStake();
    console.log(`min stake: ${paymasterStake.toString()}`);

    await paymaster.addStake(99999999, { value: parseEther("1.1") });
    console.log("add stake for paymaster");
    await paymaster.addWhitelistAddress(whitelistUser.address);
    console.log("add whitelist for paymaster");

    await entryPoint.depositTo(paymaster.address, {
      value: parseEther("0.01"),
    });
    console.log("deposit to entrypoint for paymaster");
  });
  describe("#Whitelist", () => {
    it("always success paymaster", async () => {
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
        preVerificationGas: 60000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([alwaysSuccessPaymaster.address, "0x1234"]),
      };

      // init state
      const initSum = await dummyContract.sum();
      expect(initSum).to.equal(1);
      // Send tx with a valid user.
      const tx = await entryPoint
        .connect(invalidUser)
        .handleOp(userOp, { gasLimit: 400000, gasPrice: 0 });
      await tx.wait();
      // check state changed
      const sum = await dummyContract.sum();
      expect(sum).to.equal(2);
    });

    it("whitelist valid", async () => {
      // Mock UserOp
      const userOp: UserOperationStruct = {
        callContract: dummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 60000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([paymaster.address, "0x1234"]),
      };

      // init state
      const initSum = await dummyContract.sum();
      expect(initSum).to.equal(1);
      // Send tx with a valid user.
      const tx = await entryPoint
        .connect(whitelistUser)
        .handleOp(userOp, { gasLimit: 400000, gasPrice: 0 });
      await tx.wait();
      // check state changed
      const sum = await dummyContract.sum();
      expect(sum).to.equal(2);
    });
    it("make call to an invalid address", async () => {
      // Deploy another DummyContract which is not valid in paymaster.
      const DummyContract = await ethers.getContractFactory("DummyContract");
      const invalidDummyContract = await DummyContract.deploy();

      // Mock UserOp
      const userOp: UserOperationStruct = {
        callContract: invalidDummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 60000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([paymaster.address, "0x1234"]),
      };

      // init state
      const initSum = await invalidDummyContract.sum();
      expect(initSum).to.equal(1);
      // Send tx with a valid user to an invalid address.
      await expect(
        entryPoint
          .connect(whitelistUser)
          .callStatic.handleOp(userOp, { gasLimit: 400000, gasPrice: 0 })
      )
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(
          paymaster.address,
          "Verifying call address from user operation."
        );
    });
    it("whitelist valid with plain tx", async () => {
      // Mock UserOp
      const userOp: UserOperationStruct = {
        callContract: dummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 60000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([paymaster.address, "0x1234"]),
      };

      // init state
      const initSum = await dummyContract.sum();
      expect(initSum).to.equal(1);

      // construct plain tx
      const abiCoder = new ethers.utils.AbiCoder();
      let payload = abiCoder.encode(
        [
          "tuple(address callContract, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData) UserOperation",
        ],
        [userOp]
      );
      payload = "0xb4e9984f" + payload.slice(2);

      const plainTx = {
        from: whitelistUser.address,
        to: entryPoint.address,
        data: payload,
        gasPrice: 0,
        gasLimit: 400000,
        value: 0,
      };
      const tx = await whitelistUser.sendTransaction(plainTx);
      await tx.wait();

      // check state changed
      expect(await dummyContract.sum()).to.equal(2);

      const sum: BigNumber = await dummyContract.sum();
      expect(sum).to.equal(2);
    });

    it("invalid user", async () => {
      // Mock UserOp
      const userOp: UserOperationStruct = {
        callContract: dummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 60000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([paymaster.address, "0x1234"]),
      };
      // Send tx with a invalid user.
      await expect(
        entryPoint
          .connect(invalidUser)
          .callStatic.handleOp(userOp, { gasLimit: 400000, gasPrice: 0 })
      )
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(paymaster.address, "Verifying user in whitelist.");
    });

    it("remove from whitelist", async () => {
      // Remove from whitelist.
      await paymaster.removeWhitelistAddress(whitelistUser.address);
      // Mock UserOp
      const userOp: UserOperationStruct = {
        callContract: dummyContract.address,
        callData: dummyContractCallData,
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 60000,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 1,
        paymasterAndData: hexConcat([paymaster.address, "0x1234"]),
      };
      // Send tx with a invalid user.
      await expect(
        entryPoint
          .connect(whitelistUser)
          .callStatic.handleOp(userOp, { gasLimit: 400000, gasPrice: 0 })
      )
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(paymaster.address, "Verifying user in whitelist.");
    });
  });

  if (network.name === "gw_devnet_v1" || network.name === "gw_alphanet_v1") {
    describe("transfer ERC-20", () => {
      let erc20: Contract;
      let sender: Wallet;
      let receiver: Wallet;
      let amount: BigNumber;
      beforeEach(async function () {
        let bin = await readFile("erc20/ERC20Proxy.bin", "utf8");
        bin = bin.trim().replace("\n", "");
        const Erc20 = new ContractFactory(abi, bin, walletOwner);
        erc20 = await Erc20.deploy(
          "DemoErc",
          "Erc20",
          BigNumber.from(9876543210),
          1,
          8
        );
        console.log(`Sudt erc20 proxy addr: ${erc20.address}`);
        sender = new ethers.Wallet(
          ethers.Wallet.createRandom().privateKey,
          walletOwner.provider
        );
        receiver = new ethers.Wallet(
          ethers.Wallet.createRandom().privateKey,
          walletOwner.provider
        );
        console.log(`Create target account: ${sender.address}`);
        expect(await erc20.callStatic.balanceOf(sender.address)).to.equal(0);
        expect(await erc20.callStatic.balanceOf(receiver.address)).to.equal(0);
        amount = parseEther("0.0001");
      });
      it("without gasless", async () => {
        await expect(
          erc20.connect(sender).transfer(sender.address, amount)
        ).to.rejectedWith(Error);
      });
      it("with gasless", async () => {
        const rawTx = await erc20
          .connect(sender)
          .populateTransaction.transfer(receiver.address, amount);
        const callData: string = rawTx.data ?? "";
        const userOp: UserOperationStruct = {
          callContract: erc20.address,
          callData,
          callGasLimit: 100000,
          verificationGasLimit: 100000,
          preVerificationGas: 60000,
          maxFeePerGas: 1,
          maxPriorityFeePerGas: 1,
          paymasterAndData: hexConcat([paymaster.address, "0x1234"]),
        };
        await paymaster.addWhitelistAddress(sender.address);
        const tx = await entryPoint
          .connect(sender)
          .handleOp(userOp, { gasLimit: 400000, gasPrice: 0 });
        await tx.wait();
        expect(await erc20.callStatic.balanceOf(receiver.address)).to.equal(
          amount
        );
      });
    });
  }
});
