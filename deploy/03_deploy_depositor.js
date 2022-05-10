const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  const staker = await deploy("PoolToken", {
    contract: "PoolToken",
    from: root,
    args: ["BALWETH Token", "BALWETH", 10],
    log: true,
  }); //balWeth. Immutable address of the 80BAL/20WETH token instead of crv, sent in the constractor
  //from hackmd: minter. Will be set up by constructor, we’ll need to use the address of d2dBAL token
  const minterInstance = await ethers.getContract("D2DToken");
  const veBal = await ethers.getContract("veBalMock");//address(); //TODO: veBal will be taken from chain(it is already deployed), preferrably from config file
  const escrow = veBal; //veBal. Immutable address of the veBal token instead of escrow received in the constructor

  await deploy("BalDepositor", {
    contract: "BalDepositor",
    from: root,
    args: [staker.address, minterInstance.address, escrow.address],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["BalDepositor"];

