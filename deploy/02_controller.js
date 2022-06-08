const { getAddresses } = require('../config')

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
      addresses.feeDistro, 
      voterProxy.address,
      voterProxy.address,
      1 // distribution id
    ],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Controller"];
module.exports.dependencies = ['VoterProxy'];