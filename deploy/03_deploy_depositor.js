const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  //from hackmd: minter. Will be set up by constructor, we’ll need to use the address of d2dBAL token
  const minterInstance = await ethers.getContract("D2DToken");
  // const rewardToken = address(0xC128a9954e6c874eA3d62ce62B468bA073093F25); //bal address
  const staker = address();
  const escrow = address();

  await deploy("BalDepositor", {
    contract: "BalDepositor",
    from: root,
    args: [staker, minterInstance.address, escrow],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["BalDepositor"];

