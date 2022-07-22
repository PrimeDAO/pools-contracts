const { tags: { ProxyFactory, deployment } } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("ProxyFactory", {
    from: root,
    log: true,
    gasLimit: process.env.GAS_LIMIT,
  });
};

module.exports = deployFunction;
module.exports.tags = [ProxyFactory, deployment];