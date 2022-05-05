// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer1, deployer2, deployer3] = await ethers.getSigners();

  // const BalDepositorContract = await ethers.getContractFactory("BalDepositor"); 
  // let BalDepositor = await BalDepositorContract.deploy(deployer1.address,deployer2.address,deployer3.address);
  // await BalDepositor.deployed(); //Deploy contract
  // console.log("BalDepositor deployed to:", BalDepositor.address);
  

  //Deploy the mock token contract
  const ERC20Contract = await ethers.getContractFactory("SampleERC");
  let Token = await ERC20Contract.deploy();
  console.log("Mock Token deployed to:", Token.address);

  //Deploy the mock voetr proxy contract
  const VoterProxyContract = await ethers.getContractFactory("VoterProxy");
  let Voter = await VoterProxyContract.deploy();
  console.log("Mock VoterProxy contract deployed to:", Voter.address);
  

  const MockVbalContract = await ethers.getContractFactory("MockVBAL");
  let MockVbal = await MockVbalContract.deploy();
  console.log("Mock vbal contract deployed to:", MockVbal.address);

  
  const MockRewardsContract = await ethers.getContractFactory("MockRewards");
  let MockRewards = await MockRewardsContract.deploy();
  console.log("Mock Rewards contract deployed to:", MockRewards.address);

  const MockD2DBalContract = await ethers.getContractFactory("MockD2DBal");
  let MockD2DBal = await MockD2DBalContract.deploy();
  console.log("MockD2DBal contract deployed to:", MockD2DBal.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });