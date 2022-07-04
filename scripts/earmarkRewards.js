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

// We will need to call earmark rewards as a daily job or something
async function earmarkRewardsForMultiplePools() {
  // At the moment on Goerli we only have one pool with pid = 0
  const pids = [0];

  // Goerli Controller.sol address
  const controllerAddress = '0x4D0b160307f2D93029d0A16a075875Ef581A4616';
  const controllerFactory = await ethers.getContractFactory('Controller');

  const callDatas = [];
  for (const pid of pids) {
    callDatas.push([controllerAddress, controllerFactory.interface.encodeFunctionData('earmarkRewards', [pid])]);
  }

  console.log('Calldatas: ', callDatas);
  const tx = await multiCall2.connect(signer).tryAggregate(true, callDatas);
  console.log('Tx receipt: ', tx);
}

earmarkRewardsForMultiplePools();
