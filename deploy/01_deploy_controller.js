// const { utils } = require("ethers");

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const staker = '0xC128a9954e6c874eA3d62ce62B468bA073093F25'; //the veBal staking rewards
  const minter = '0xC128a9954e6c874eA3d62ce62B468bA073093F25'; //Rewards tokens minted by balancer for the liquidity providers.

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
