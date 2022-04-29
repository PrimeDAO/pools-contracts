const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  const pid = 1; //1 for example (set correct later_)
  const stakingTokenInstance = await ethers.getContract("D2DToken"); //Staking token provided will be a d2dBAL, minted in the Deposit contract.
  const rewardToken = address(0xC128a9954e6c874eA3d62ce62B468bA073093F25); //reward contract is going to be BAL, which will be received from BAL ve model.
  const operator = await ethers.getContract("Controller");
  const rewardManager = address(0xedccb35798fae4925718a43cc608ae136208aa8d);

  await deploy("BaseRewardPool", {
    contract: "BaseRewardPool",
    from: root,
    args: [pid, stakingTokenInstance.address, rewardToken, operator.address, rewardManager],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["BaseRewardPool"];
