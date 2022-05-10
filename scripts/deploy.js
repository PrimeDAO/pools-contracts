const { ethers } = require("hardhat");

async function main() {


  const ERC20Contract = await ethers.getContractFactory("SampleERC");
  await ERC20Contract.deploy();

  const VoterProxyContract = await ethers.getContractFactory("VoterProxy");
  await VoterProxyContract.deploy();
  
  const MockVbalContract = await ethers.getContractFactory("MockVBAL");
  await MockVbalContract.deploy();

  const MockRewardsContract = await ethers.getContractFactory("MockRewards");
  await MockRewardsContract.deploy();

  const MockD2DBalContract = await ethers.getContractFactory("MockD2DBal");
  await MockD2DBalContract.deploy();

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });