const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();
  
  const staker =  await ethers.getContract("VoterProxy");
  const minterInstance = await ethers.getContract("D2DBal");
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

const dplMock = () => {}
module.exports = dplMock;