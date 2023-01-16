import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "solidity-coverage";

require("hardhat-contract-sizer");

const config: HardhatUserConfig = {
  solidity: "0.8.17",
};

export default config;
