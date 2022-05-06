// const { utils } = require("ethers");

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  let staker = await deploy("veBalMock", {
    from: root,
    args: [
      token_addr,
      "veBalMock",
      "VBM",
      _authorizer_adaptor,
    ],
    log: true,
  });

  let minter = await deploy("SeedPool", {
    from: root,
    args: [

    ],
    log: true,
  });

  // const staker = await ethers.getContract("veBalMock"); //the veBal staking rewards
  // const minter = await ethers.getContract("SeedPool "); //Rewards tokens minted by balancer for the liquidity providers.

  await deploy("Controller", {
    from: root,
    args: [
      staker,
      minter,
    ],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Controller"];
