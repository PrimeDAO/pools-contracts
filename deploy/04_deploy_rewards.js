const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  const pid = 1; //1 for example (set correct later_)
  const stakingTokenInstance = await ethers.getContract("D2DToken"); //Staking token provided will be a d2dBAL, minted in the Deposit contract.
  const rewardToken = await ethers.getContract("veBalMock"); //reward contract is going to be BAL, which will be received from BAL ve model.
  const operator = await ethers.getContract("Controller");
  const rewardManager = await ethers.getContract("Controller");

  await deploy("BaseRewardPool", {
    contract: "BaseRewardPool",
    from: root,
    args: [pid, stakingTokenInstance.address, rewardToken.address, operator.address, rewardManager.address],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["BaseRewardPool"];
