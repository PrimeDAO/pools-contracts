## Prime Pools Smart Contracts
[![Coverage](https://codecov.io/gh/PrimeDAO/pools-contracts/branch/main/graph/badge.svg?token=J7BVR28SM2)](https://codecov.io/gh/PrimeDAO/pools-contracts)
![build&tests](https://github.com/PrimeDAO/pools-contracts/actions/workflows/ci-config.yml/badge.svg)

This repo contains the smart contracts making up Prime Pools

### What is Prime Pools
Prime Pools is a Balancer reward optimizer that aims to empower DAOs and individuals to contribute to the Balancer ecosystem by providing additional rewards and control.

Unlike current solutions, Prime Pools does not introduce a native governance token and instead aims to enable current veBAL holders to collectively lock their tokens and provide benefits to liquidity providers to enhance their rewards. By adopting Prime Pools instead of an aggregation platform with a Native token, Balancer can keep the majority of the value created by BAL inside of the Balancer Ecosystem.

Holders of 20% WETH / 80% BAL can convert their LP tokens to d2dBAL in the Prime Pools dApp. (Converting 20% WETH / 80% BAL to d2dBAL is irreversible; however secondary markets may exist.)

Prime Pools utilizes all 20% WETH / 80% BAL tokens under its control to vote to lock it for the max (1 year) duration in Balancer. The veBAL is controlled by the Prime Pools Common Controller. At the start, the Common Controller will be managed by a 4 out of 7 multi-sig; within four months, the Common Controller will be transitioned to a fully on-chain solution. Unlike current solutions, d2dBAL is the only controlling token in Prime Pools.

To learn more about Prime Pools, please see [here](https://medium.com/primedao/prime-pools-a-cooperative-dao-liquidity-management-solution-2948bdb7a118)

### Prerequisites
Make sure you have node.js [Latest LTS Version: 16.15.1](https://nodejs.org/en/)

### Install
Install dependencies with the following command:
```
npm i
```
## Environment setup
please prepare `.env` file

```bash
touch .env
```

and add the following

```
INFURA_KEY = infura key
PK = private-key
ETHERSCAN_API_KEY = etherscan key
```

Note:`.env` should be created in root directory.

### Automated Tests
Run
```
npm run test
```
To run integration tests:
```
npm run test:integration-existing
```

## How to test deployment without deploying

Create Moralis (https://moralis.io/) account and get api key

- add BLOCKCHAIN_FORK=kovan or BLOCKCHAIN_FORK=mainnet to .env
- add MORALIS_KEY to .env (Moralis has free archive nodes)
- npx hardhat node

Doing this will create a fork of mainnet / kovan, and try to deploy smart contracts

## How to run integration tests on Kovan fork

- add BLOCKCHAIN_FORK=kovan to .env
- add MORALIS_KEY to .env (Moralis has free archive nodes)
- npm run test:integration-clean or test:integration-existing

## Deployment
This project uses the hardhat-deploy plugin to deploy contracts. When a contract has been deployed, its _ABI_ is saved as JSON to the `/deployments/` directory, including its _address_.

Since this is a project that is continuously being extended, it is generally not desirable to always deploy all contracts. Therefore, this project makes use of [deployment tags](https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies). These are specified at the end of each deploy script.

There are two **npm scripts** that facilitate the deployment to _mainnet_, and _kovan_. All require the specification of **tags**. When using these scripts, at the end of the deployment, it automatically exports the addresses & artifacts in one file per network.

### Deployment to kovan

General:
`npm run deploy:contracts:kovan`

### Deployment to mainnet

General:
`npm run deploy:contracts:mainnet`

## Verify Contracts

To verify contracts, the enviornment variable should contain `ETHERSCAN_API_KEY` set.

General:
`npm run verify:contracts:kovan`

Find more information in the documentation of [hardhat-etherscan](https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html)

Additional useful links include: [Prime Pools Medium Article](https://medium.com/primedao/prime-pools-a-cooperative-dao-liquidity-management-solution-2948bdb7a118)

