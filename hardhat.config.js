require('dotenv').config({ path: './.env' });
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('solidity-coverage');
require('@nomiclabs/hardhat-web3');
require('hardhat-gas-reporter');

const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, ARBISCAN_API_KEY, PK } = process.env;
const DEFAULT_MNEMONIC = 'hello darkness my old friend';

const sharedNetworkConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

// Moralis has archive node for free
// And we are using it to test the deployment on a fork
const testForking = {
  ...sharedNetworkConfig,
  forking: {
    url: `https://speedy-nodes-nyc.moralis.io/${process.env.MORALIS_KEY}/eth/${process.env.BLOCKCHAIN_FORK}/archive`,
    blockNumber: process.env.BLOCKCHAIN_FORK == 'kovan' ? 32152859 : 14854404, // Adapt if needed
  },
};

module.exports = {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'deploy',
    sources: 'contracts',
    imports: 'imports',
  },
  gasReporter: {
    currency: 'USD',
    token: 'ETH',
    gasPrice: 100, // Leaving gas price constant so that we can see results better
    // gasPriceApi:
    //     "https://api.etherscan.com/api?module=proxy&action=eth_gasPrice&apikey=" +
    //     process.env.ETHERSCAN_API_KEY,
    enabled: process.env.REPORT_GAS ? true : false,
    src: './contracts',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  networks: {
    localhost: {
      ...sharedNetworkConfig,
      blockGasLimit: 100000000,
      gas: 2000000,
      saveDeployments: false,
    },
    hardhat: process.env.BLOCKCHAIN_FORK
      ? testForking
      : {
          blockGasLimit: 10000000000000,
          gas: 200000000000,
          saveDeployments: false,
          initialBaseFeePerGas: 0,
          hardfork: 'london',
          defaultNetwork: 'hardhat',
        },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    kovan: {
      ...sharedNetworkConfig,
      url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    ganache: {
      ...sharedNetworkConfig,
      url: 'http://127.0.0.1:7545',
      saveDeployments: false,
    },
    arbitrumTest: {
      ...sharedNetworkConfig,
      url: 'https://rinkeby.arbitrum.io/rpc',
      saveDeployments: true,
    },
    arbitrum: {
      ...sharedNetworkConfig,
      url: 'https://arb1.arbitrum.io/rpc',
      saveDeployments: true,
    },
  },
  verify: {
    etherscan: {
      apiKey: {
        mainnet: ETHERSCAN_API_KEY,
        kovan: ETHERSCAN_API_KEY,
        arbitrumOne: ARBISCAN_API_KEY,
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.14',
        settings: {
          viaIR: false, // false gives us better results
          optimizer: {
            enabled: true,
            runs: 100000, // 100k gives better results than 10k
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
    },
  },
  namedAccounts: {
    root: 0,
    prime: 1,
    beneficiary: 2,
    rewardManager: 3, // BaseRewardPool reward manager
    treasury: 4,
  },
};
