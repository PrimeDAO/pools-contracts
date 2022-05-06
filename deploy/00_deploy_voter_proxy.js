// const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
//   const { deploy } = deployments;
//   const { root } = await getNamedAccounts();
//   // const safeInstance =
//   //   network.name == "kovan" ? root : await ethers.getContract("VoterProxy");

//   let minter;
//   let bal = await ethers.getContract("D2DToken");
//   let veBal = await deploy("veBalMock", {
//     from: root,
//     args: [
//       token_addr,
//       "veBalMock",
//       "VBM",
//       _authorizer_adaptor,
//     ],
//     log: true,
//   });
//   let gaugeController;

//   const { address: seedAddress } = await deploy("VoterProxy", {
//     from: root,
//     args: [minter, bal, veBal, gaugeController],
//     log: true,
//   });
// };

// module.exports = deployFunction;
// module.exports.tags = ["VoterProxy"];
