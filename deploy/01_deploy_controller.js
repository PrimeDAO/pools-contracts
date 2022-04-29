const { utils } = require("ethers");
const { parseEther } = utils;

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  const staker = address(0xC128a9954e6c874eA3d62ce62B468bA073093F25);
  const minter = address(0xC128a9954e6c874eA3d62ce62B468bA073093F25); //Rewards tokens minted by balancer for the liquidity providers.

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
