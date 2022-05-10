// const { utils } = require("ethers");

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  let staker =  await ethers.getContract("veBalMock");

  let minter = "0xEFc3a819695932394D89b8AF6f49e0D89EDf9A40"; // change with seedPool mock

  // const staker = await ethers.getContract("veBalMock"); //the veBal staking rewards
  // const minter = await ethers.getContract("SeedPool "); //Rewards tokens minted by balancer for the liquidity providers.

  await deploy("Controller", {
    from: root,
    args: [
      staker.address,
      minter,
    ],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Controller"];
