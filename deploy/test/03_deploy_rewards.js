const path = require('path');
const scriptName = path.basename(__filename);

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { root, rewardManager } = await getNamedAccounts();

  if (network.live) {
    return console.log(`${scriptName} can only be deployed on the test network`);
  }

  const pid = 1; // 1 for example (set correct later_)
  const stakingTokenInstance = await ethers.getContract("Balancer80BAL20WETHMock"); // Staking token provided will be a d2dBAL, minted in the Deposit contract.
  const rewardToken = await ethers.getContract("BalMock"); // reward contract is going to be BAL, which will be received from BAL ve model.
  
  const operator = await ethers.getContract("ControllerMock");

  await deploy("BaseRewardPool", {
    contract: "BaseRewardPoolInTest",
    from: root,
    args: [pid, stakingTokenInstance.address, rewardToken.address, operator.address, rewardManager],
    log: true,
  });

  // We need to mint reward token to pool so that it can be rewarded to stakers
  const baseRewardPool = await ethers.getContract("BaseRewardPool");
  
  await rewardToken.mint(baseRewardPool.address, ethers.utils.parseEther("100"));
};

module.exports = deployFunction;
module.exports.tags = ['BaseRewardPool', 'test'];