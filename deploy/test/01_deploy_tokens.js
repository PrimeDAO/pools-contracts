const path = require('path');
const scriptName = path.basename(__filename);

const deployFunction = async ({ getNamedAccounts, deployments, network }) => {

  if (network.live) {
    return console.log(`${scriptName} can only be deployed on the test network`);
  }

  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("D2DTokenMock", {
    contract: "ERC20Mock",
    from: root,
    args: ['D2DMock', 'D2D'],
    log: true,
  });

  await deploy("Balancer80BAL20WETHMock", {
    contract: "ERC20Mock",
    from: root,
    args: ['Balancer 80 BAL 20 WETH', 'B-80BAL-20WETH'],
    log: true,
  });

  const balMock = await deploy("BalMock", {
    contract: "ERC20Mock",
    from: root,
    args: ['BalMock', 'BAL'],
    log: true,
  });

  await deploy("veBalMock", {
    contract: "VeBalMock",
    from: root,
    args: [balMock.address, 'Vote Escrowed Balancer BPT', 'veBAL', root],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["D2DTokenMock", "Balancer80BAL20WETHMock", "BalMock" ,"veBalMock", 'mockTokens', 'test'];