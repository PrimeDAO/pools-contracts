const { ethers } = require('hardhat');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const controller = await deployments.get('Controller');
  const rewardFactory = await deployments.get('RewardFactory');
  const proxyFactory = await deployments.get('ProxyFactory');
  
  const { address: stashFactoryAddress } = await deploy("StashFactory", {
    from: root,
    args: [controller.address, rewardFactory.address, proxyFactory.address],
    log: true,
  });
  
  // Set implementation contract on stash factory
  const stashDeployment = await deployments.get('ExtraRewardStash');

  const stashFactory = await ethers.getContractFactory('StashFactory')
  const stash = stashFactory.attach(stashFactoryAddress)

  await stash.setImplementation(stashDeployment.address)
};

module.exports = deployFunction;
module.exports.tags = ["StashFactory"];
module.exports.dependencies = ['Controller', 'RewardFactory', 'ProxyFactory', 'ExtraRewardStash'];