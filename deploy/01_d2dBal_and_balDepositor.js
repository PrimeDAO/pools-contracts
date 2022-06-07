const { getAddresses } = require('../config')

const deployFunction = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const addresses = getAddresses();

  const voterProxy = await deployments.get('VoterProxy');

  const { address: d2dBalAddress } = await deploy("D2DBal", {
    from: root,
    log: true,
  })

  const { address: balDepositor } = await deploy("BalDepositor", {
    from: root,
    args: [addresses.wethBal, addresses.veBal, voterProxy.address, d2dBalAddress],
    log: true,
  });

  // Owner of D2DBal should be BalDepositor
  const D2DBalFactory = await ethers.getContractFactory('D2DBal')
  const D2DBal = D2DBalFactory.attach(d2dBalAddress)

  await D2DBal.transferOwnership(balDepositor)
};

module.exports = deployFunction;
module.exports.tags = ["BalDepositor", "D2DBal"];
module.exports.dependencies = ['VoterProxy'];