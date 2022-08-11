const { getAddresses, tags: { RewardFactory, deployment, Controller } } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const addresses = getAddresses();

  const controller = await deployments.get('Controller');

  await deploy("RewardFactory", {
    from: root,
    args: [controller.address, addresses.bal],
    log: true,
    gasLimit: process.env.GAS_LIMIT,
    gasPrice: process.env.GAS_PRICE
  });
};

module.exports = deployFunction;
module.exports.tags = [RewardFactory, deployment];
module.exports.dependencies = [Controller]