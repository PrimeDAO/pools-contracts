const { getAddresses } = require('../config')

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const voterProxy = await deployments.get('VoterProxy');

  const addresses = getAddresses();

  await deploy("Controller", {
    from: root,
    args: [voterProxy.address, addresses.wethBal, addresses.bal, '0x0000000000000000000000000000000000000000'],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Controller"];
module.exports.dependencies = ['VoterProxy'];