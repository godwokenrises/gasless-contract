import * as fs from "fs";
import { ethers } from "ethers";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";

require("hardhat-contract-sizer");

const TEST_PK1 =
  process.env.PRIVATE_KEY ??
  // eth_address: 0x966b30e576a4d6731996748b48dd67c94ef29067
  "1390c30e5d5867ee7246619173b5922d3b04009cab9e9d91e14506231281a997";
const TEST_PK2 =
  process.env.PRIVATE_KEY2 ??
  // eth_address: 0x4fef21f1d42e0d23d72100aefe84d555781c31bb
  "2dc6374a2238e414e51874f514b0fa871f8ce0eb1e7ecaa0aed229312ffc91b0";
/**
 * TEST_PK3 should be an EOA containing some GWK.
 */
const TEST_PK3 =
  process.env.PRIVATE_KEY3 ??
  // eth_address: 0x0c1efcca2bcb65a532274f3ef24c044ef4ab6d73
  "dd50cac37ec6dd12539a968c1a2cbedda75bd8724f7bcad486548eaabb87fc8b";

const PRIVATE_KEY0 = ethers.Wallet.createRandom().privateKey;

const PRIVATE_KEY1 = ethers.Wallet.createRandom().privateKey;
const mnemonicFileName =
  process.env.MNEMONIC_FILE ??
  `${process.env.HOME}/.secret/testnet-mnemonic.txt`;
let mnemonic = "test ".repeat(11) + "junk";
if (fs.existsSync(mnemonicFileName)) {
  mnemonic = fs.readFileSync(mnemonicFileName, "ascii");
}

function getNetwork1(url: string): {
  url: string;
  accounts: { mnemonic: string };
} {
  return {
    url,
    accounts: { mnemonic },
  };
}

function getNetwork(name: string): {
  url: string;
  accounts: { mnemonic: string };
} {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`);
  // return getNetwork1(`wss://${name}.infura.io/ws/v3/${process.env.INFURA_ID}`)
}

const optimizedComilerSettings = {
  version: "0.8.17",
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true,
  },
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: { enabled: true, runs: 1000000 },
        },
      },
    ],
    overrides: {
      "contracts/core/EntryPoint.sol": optimizedComilerSettings,
      "contracts/samples/SimpleWallet.sol": optimizedComilerSettings,
    },
  },
  networks: {
    gw_devnet_v1: {
      url: "http://localhost:8024/instant-finality-hack",
      accounts: [
        `0x${TEST_PK1}`,
        `0x${TEST_PK2}`,
        `0x${TEST_PK3}`,
        `${PRIVATE_KEY0}`,
        `${PRIVATE_KEY1}`,
      ],
    },
    gw_alphanet_v1: {
      // for internal testing
      url: "https://gw-alphanet-v1.godwoken.cf/instant-finality-hack",
      accounts: [
        `0x${TEST_PK1}`,
        `0x${TEST_PK2}`,
        `${PRIVATE_KEY0}`,
        `${PRIVATE_KEY1}`,
      ],
      chainId: 202206,
    },
    gw_testnet_v1: {
      url: "https://v1.testnet.godwoken.io/rpc/instant-finality-hack",
      accounts: [
        `0x${TEST_PK1}`,
        `0x${TEST_PK2}`,
        `${PRIVATE_KEY0}`,
        `${PRIVATE_KEY1}`,
      ],
      chainId: 71401,
    },
    dev: { url: "http://localhost:8545" },
    // github action starts localgeth service, for gas calculations
    localgeth: { url: "http://localgeth:8545" },
    goerli: getNetwork("goerli"),
    proxy: getNetwork1("http://localhost:8545"),
    kovan: getNetwork("kovan"),
    hardhat: {
      gasPrice: 0,
      gas: "auto",
      gasMultiplier: 0,
      initialBaseFeePerGas: 0,
    },
  },
  mocha: {
    timeout: 40000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

// coverage chokes on the "compilers" settings
if (process.env.COVERAGE != null) {
  // @ts-ignore
  config.solidity = config.solidity.compilers[0];
}

export default config;
