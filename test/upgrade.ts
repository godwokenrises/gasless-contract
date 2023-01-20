import { ethers, upgrades } from "hardhat";
import { UpgradeToV999, UpgradeV1 } from "../typechain-types";
import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";

describe("#OpenZeppelinUpgradable", () => {
  let contractAddress: string;
  it("deploy v1", async () => {
    const Contract = await ethers.getContractFactory("UpgradeV1");
    const contract = (await upgrades.deployProxy(Contract, [])) as UpgradeV1;
    await contract.deployed();
    expect(await contract.VERSION()).to.equal(1);

    contractAddress = contract.address;
  });

  it("upgrade v999", async () => {
    const UpgradeContract = await ethers.getContractFactory("UpgradeToV999");
    const upgraded = await upgrades.upgradeProxy(
      contractAddress,
      UpgradeContract
    );
    console.log("contract upgrade!");

    // Note:
    // currently op-upgrade does not support re-initialize for upgrade
    // see: https://forum.openzeppelin.com/t/how-can-initializer-be-called-again-after-upgrading/25277
    expect(await upgraded.VERSION()).equal(1);

    // call new method after upgrades
    expect(await (upgraded as UpgradeToV999).getUpgradeVersion()).equal(999);
    // the contract address must stay the same after upgrades
    expect(upgraded.address).equal(contractAddress);
  });
});
