require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();
require("hardhat-gas-reporter");

const {PRIVATE_KEY, BSCSCAN_API_KEY, INFURA_PROJECT, ETHERSCAN_API_KEY} = process.env;


module.exports = {
  networks: {
    bscTestnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
      accounts: [PRIVATE_KEY]
    },
    bscMainnet: {
      url: `https://bsc-dataseed1.ninicoin.io`,
      accounts: [PRIVATE_KEY]
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT}`,
      accounts: [PRIVATE_KEY]
    },
  },
  solidity: {
    version: "0.8.3",
    settings: {
      optimizer: {
        enabled: true,
        runs: 400
      }
    }
  },
  defaultNetwork: "hardhat",
  gasPrice: "70000000000",
  gas: "auto",
  gasReporter: {
    gasPrice: 1,
    enabled: false,
    showTimeSpent: true
  },
  etherscan: {
    apiKey: BSCSCAN_API_KEY
  }
};

