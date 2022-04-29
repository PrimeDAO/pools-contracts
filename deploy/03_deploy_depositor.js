const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  const staker = address(); //balWeth. Immutable address of the 80BAL/20WETH token instead of crv, sent in the constractor
  //from hackmd: minter. Will be set up by constructor, we’ll need to use the address of d2dBAL token
  const minterInstance = await ethers.getContract("D2DToken");
  const veBal = address();
  const escrow = veBal; //veBal. Immutable address of the veBal token instead of escrow received in the constructor

  await deploy("BalDepositor", {
    contract: "BalDepositor",
    from: root,
    args: [staker, minterInstance.address, escrow],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["BalDepositor"];

