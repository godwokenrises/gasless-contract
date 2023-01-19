import fetch from "cross-fetch";
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { arrayify, keccak256 } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";
import { EntryPoint, EntryPoint__factory } from "../typechain-types";

let counter = 0;

export async function deployEntryPoint(
  fullNodeMiner: string,
  paymasterStake: BigNumberish,
  unstakeDelaySecs: BigNumberish,
  _provider = ethers.provider
): Promise<EntryPoint> {
  const Contract = await ethers.getContractFactory("EntryPoint");
  const contract = (await upgrades.deployProxy(Contract, [
    fullNodeMiner,
    paymasterStake,
    unstakeDelaySecs,
  ])) as EntryPoint;
  return await contract.deployed();
}

export async function connectEntryPoint(
  addr: string,
  provider = ethers.provider
): Promise<EntryPoint> {
  return EntryPoint__factory.connect(addr, provider.getSigner());
}

// create non-random account, so gas calculations are deterministic
export function createNonRandomWallet(): Wallet {
  const privateKey = keccak256(
    Buffer.from(arrayify(BigNumber.from(++counter)))
  );
  return new ethers.Wallet(privateKey, ethers.provider);
}

export async function getOrDeployEntrypointContract(
  fullnodeMiner: string,
  paymasterStake: BigNumberish,
  unstakeDelaySecs: BigNumberish
): Promise<EntryPoint> {
  if (network.name.startsWith("gw") && "url" in network.config) {
    const response = await fetch(network.config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "poly_version",
        params: [],
        id: 42,
      }),
    });
    const data = JSON.parse(await response.text());
    const addr = data.result.nodeInfo.gaslessTx.entrypointAddress;
    return connectEntryPoint(addr);
  }
  return deployEntryPoint(fullnodeMiner, paymasterStake, unstakeDelaySecs);
}
