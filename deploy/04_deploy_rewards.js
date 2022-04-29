const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  const pid = 1; //1 for example (set correct later_)
  const stakingTokenInstance = await ethers.getContract("D2DToken");
  const rewardToken = address(0xC128a9954e6c874eA3d62ce62B468bA073093F25); //bal address
  const operator = address();
  const rewardManager = address();

  await deploy("BaseRewardPool", {
    contract: "BaseRewardPool",
    from: root,
    args: [pid, stakingTokenInstance.address, rewardToken, operator, rewardManager],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["BaseRewardPool"];

