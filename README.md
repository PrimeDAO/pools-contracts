# Pools Contracts
[![Coverage](https://codecov.io/gh/PrimeDAO/pools-contracts/branch/main/graph/badge.svg?token=J7BVR28SM2)](https://codecov.io/gh/PrimeDAO/pools-contracts)
![build&tests](https://github.com/PrimeDAO/pools-contracts/actions/workflows/ci-config.yml/badge.svg) 


## How to test deployment without deploying

Create Moralis (https://moralis.io/) account and get api key

- add BLOCKCHAIN_FORK=kovan or BLOCKCHAIN_FORK=mainnet to .env
- add MORALIS_KEY to .env (Moralis has free archive nodes)
- npx hardhat node

Doing this will create a fork of mainnet / kovan, and try to depoloy smart contracts

## How to run integration tests on Kovan fork

- add BLOCKCHAIN_FORK=kovan to .env
- add MORALIS_KEY to .env (Moralis has free archive nodes)
- npm run test:integration-clean or test:integration-existing
