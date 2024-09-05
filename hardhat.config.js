require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://polygon-mainnet.infura.io/v3/33070c255866408da07dc8a9588f853d",
        blockNumber: 46660455
      }
    },
    mumbai: {
      chainId: 80001,
      // url: "https://polygon-mumbai.g.alchemy.com/v2/" + process.env.ALCHEMY_KEY_TESTNET,
      url: "https://polygon-mumbai.infura.io/v3/947333767b8149ff8ecb75cb6b189185",
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 35000000000
    },
    mainnet: {
      chainId: 137,
      url: "https://polygon-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_KEY_MAINNET,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.POLYGON_API_KEY,
  },
};
