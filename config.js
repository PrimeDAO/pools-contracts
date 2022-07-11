const minter = 'minter';
const veBal = 'veBal';
const bal = 'bal';
const gaugeController = 'gaugeController';
const wethBal = 'wethBal'; // 80/20 BAL/WETH Balancer Pool Token
const PRIME_MULTISIG = 'PRIME_MULTISIG';
const feeDistro = 'feeDistro';
const pools = 'pools';

const contractAddresses = {
  mainnet: {
    [minter]: '0x239e55F427D44C3cc793f49bFB507ebe76638a2b',
    [veBal]: '0xC128a9954e6c874eA3d62ce62B468bA073093F25',
    [bal]: '0xba100000625a3754423978a60c9317c58a424e3d',
    [gaugeController]: '0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD',
    [wethBal]: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
    [feeDistro]: '0x26743984e3357eFC59f2fd6C1aFDC310335a61c9',
    [PRIME_MULTISIG]: '', // TODO: setup multisig wallet
  },
  kovan: {
    [pools]: [
      {
        name: '50 WBTC 50 WETH',
        lpToken: '0x647c1fd457b95b75d0972ff08fe01d7d7bda05df',
        gauge: '0xE190E5363C925513228Bf25E4633C8cca4809C9a',
      },
      {
        name: '17WBTC-50BAL-33USDC',
        lpToken: '0xf767f0a3fcf1eafec2180b7de79d0c559d7e7e37',
        gauge: '0x5E7B7B41377Ce4B76d6008F7a91ff9346551c853',
      },
    ],
    [minter]: '0xe1008f2871f5f5c3da47f806deba3cd83fe0e55b', // wrong address on balancer docs
    [veBal]: '0x0BA4d28a89b0aB0c48253f4f36B204DE24354651',
    [bal]: '0xcb355677e36f390ccc4a5d4beadfbf1eb2071c81', // wrong address on balancer docs
    [gaugeController]: '0x28bE1a58A534B281c3A22df28d3720323bfF331D', // wrong address on balancer docs
    [wethBal]: '0xdc2ecfdf2688f92c85064be0b929693acc6dbca6',
    [feeDistro]: '0x2A49c0e4f081f54d9F02d92b580ECf616B86F1ff',
    [PRIME_MULTISIG]: '0xbF63Afb77A49159b4502E91CD3f4EbDcc161431f', // Dev wallet
  },
  goerli: {
    [pools]: [
      {
        name: '50 WBTC 50 WETH',
        lpToken: '0x16faf9f73748013155b7bc116a3008b57332d1e6',
        gauge: '0xf0f572ad66baacDd07d8c7ea3e0E5EFA56a76081',
      },
    ],
    [minter]: '0xdf0399539A72E2689B8B2DD53C3C2A0883879fDd',
    [veBal]: '0x33A99Dcc4C85C014cf12626959111D5898bbCAbF',
    [bal]: '0xfa8449189744799ad2ace7e0ebac8bb7575eff47',
    [gaugeController]: '0xBB1CE49b16d55A1f2c6e88102f32144C7334B116',
    [wethBal]: '0xf8a0623ab66F985EfFc1C69D05F1af4BaDB01b00',
    [feeDistro]: '0x7F91dcdE02F72b478Dc73cB21730cAcA907c8c44',
    [PRIME_MULTISIG]: '0xbF63Afb77A49159b4502E91CD3f4EbDcc161431f', // Dev wallet
  },
};

module.exports = {
  getAddresses: function() {
    const blockchainOverride = process.env.BLOCKCHAIN_FORK ? process.env.BLOCKCHAIN_FORK : hre.network.name;
    return contractAddresses[blockchainOverride] ?? [];
  },
  // Deployment tag constants
  tags: {
    deployment: 'deployment',
    VoterProxy: 'VoterProxy',
    BalDepositor: 'BalDepositor',
    D2DBal: 'D2DBal',
    Controller: 'Controller',
    TokenFactory: 'TokenFactory',
    ExtraRewardStash: 'ExtraRewardStash',
    RewardFactory: 'RewardFactory',
    StashFactory: 'StashFactory',
    VoterProxySetters: 'VoterProxySetters',
    ControllerSetters: 'ControllerSetters',
    BaseRewardPool: 'BaseRewardPool',
    addPools: 'addPools',
    integration: 'integration', // integration tests
  },
};
