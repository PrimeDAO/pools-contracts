const { ethers } = require('hardhat');

module.exports = {
  ONE_ADDRESS: '0x0000000000000000000000000000000000000001',
  TWO_ADDRESS: '0x0000000000000000000000000000000000000002',
  ONE_HUNDRED_ETHER: ethers.utils.parseEther('100'),
  SECONDS_IN_DAY: 60 * 60 * 24, // seconds * minutes * hours
  MOCK_INITIAL_SUPPLY: ethers.utils.parseEther('100000'), // ERC20Mock.INITIAL_SUPPLY
};
