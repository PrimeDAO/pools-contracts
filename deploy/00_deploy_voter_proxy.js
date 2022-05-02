// const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
//   const { deploy } = deployments;
//   const { root } = await getNamedAccounts();
//   // const safeInstance =
//   //   network.name == "kovan" ? root : await ethers.getContract("VoterProxy");

//   const { address: seedAddress } = await deploy("VoterProxy", {
//     from: root,
//     args: [],
//     log: true,
//   });
// };

// module.exports = deployFunction;
// module.exports.tags = ["VoterProxy"];
