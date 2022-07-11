const { tags: { StashFactory, deployment, Controller, RewardFactory, ExtraRewardStash } } = require("../config");

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy, execute } = deployments;
  const { root } = await getNamedAccounts();

  const controller = await deployments.get('Controller');
  const rewardFactory = await deployments.get('RewardFactory');
  
  await deploy("StashFactory", {
    from: root,
    args: [controller.address, rewardFactory.address],
    log: true,
  });
  
  // Set implementation contract on stash factory
  const stashDeployment = await deployments.get('ExtraRewardStash');

  await execute('StashFactory', { from: root, log: true }, 'setImplementation', stashDeployment.address)
};

module.exports = deployFunction;
module.exports.tags = [StashFactory, deployment];
module.exports.dependencies = [Controller, RewardFactory, ExtraRewardStash];