const { getAddresses, tags: { VoterProxy, BalDepositor, D2DBal, deployment } } = require('../config');

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy, execute } = deployments;
  const { root } = await getNamedAccounts();

  const addresses = getAddresses();

  const voterProxy = await deployments.get('VoterProxy');

  const { address: d2dBalAddress } = await deploy("D2DBal", {
    from: root,
    log: true,
    gasLimit: process.env.GAS_LIMIT,
  })

  const { address: balDepositor } = await deploy("BalDepositor", {
    from: root,
    args: [addresses.wethBal, addresses.veBal, voterProxy.address, d2dBalAddress],
    log: true,
    gasLimit: process.env.GAS_LIMIT,
  });

  // Owner of D2DBal should be BalDepositor
  await execute('D2DBal', { from: root, log: true, gasLimit: process.env.GAS_LIMIT }, 'transferOwnership', balDepositor)
};

module.exports = deployFunction;
module.exports.tags = [BalDepositor, D2DBal, deployment];
module.exports.dependencies = [VoterProxy];