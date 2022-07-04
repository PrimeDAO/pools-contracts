const { ethers } = require('hardhat');

const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${process.env.INFURA_KEY}`);
const wallet = new ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
const signer = wallet.connect(provider);
console.log('Signer Address: ', signer.address);

// https://github.com/makerdao/multicall
// In this exmaple we are using multicall2 contract
const multiCall2 = new ethers.Contract(
  '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
  [
    'function tryAggregate(bool requireSuccess, tuple[](address target, bytes callData)) public returns (tuple[](bool success, bytes callData))',
  ],
  provider
);

// Users are going to be presented a transaction that claims rewards from multiple `BaseRewardPool` smart contracts
// We will query subgraph to see users active investments, and if user has 3 investments
// we will craft a tx to claim from all 3 `BaseRewardPools` at once
async function getMultipleRewards() {
  // We will obtain addresses this addresses from subgraph
  // https://thegraph.com/hosted-service/subgraph/bxmmm1/tst?query=Query%20investments%20from%20one%20user
  // const baseRewardPoolAddresses = investments.map(x => x.pool.balRewards)
  const baseRewardPoolAddresses = ['0xD9c2a57Ad9784eB5A11AD29Fe2c8e7c908dFECE8'];

  const baseRewardPool = await ethers.getContractFactory('BaseRewardPool');

  const callDatas = [];
  for (const address of baseRewardPoolAddresses) {
    // for earmarkRewards we don't need address, just PID
    callDatas.push([
      address,
      baseRewardPool.interface.encodeFunctionData('getReward(address,bool)', [signer.address, true]),
    ]);
  }

  console.log('Calldatas: ', callDatas);
  const tx = await multiCall2.connect(signer).tryAggregate(true, callDatas);
  console.log('Tx receipt: ', tx);
}

getMultipleRewards();
