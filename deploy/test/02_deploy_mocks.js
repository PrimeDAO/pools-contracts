const path = require('path');
const scriptName = path.basename(__filename);

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {

  if (network.live) {
    return console.log(`${scriptName} can only be deployed on the test network`);
  }

  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("ControllerMock", {
    contract: "ControllerMock",
    from: root,
    args: [],
    log: true,
  });

  await deploy("ExtraRewardMock", {
    contract: "ExtraRewardMock",
    from: root,
    args: [],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["ControllerMock", 'ExtraRewardMock', 'test'];