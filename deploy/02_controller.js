const { getAddresses, tags: { Controller, deployment, VoterProxy } } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const voterProxy = await deployments.get('VoterProxy');

  const addresses = getAddresses();

  await deploy("Controller", {
    from: root,
    args: [
      voterProxy.address, 
      addresses.bal,
      addresses.feeDistro
    ],
    log: true,
    gasLimit: process.env.GAS_LIMIT,
    gasPrice: process.env.GAS_PRICE
  });
};

module.exports = deployFunction;
module.exports.tags = [Controller, deployment];
module.exports.dependencies = [VoterProxy];