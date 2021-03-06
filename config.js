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
    // [PRIME_MULTISIG]: '0xbF63Afb77A49159b4502E91CD3f4EbDcc161431f', // Dev wallet
    [PRIME_MULTISIG]: '0x8E2944982DC2837B250e1B115b195b2e6d808F31', // https://gnosis-safe.io/app/eth:0x8E2944982DC2837B250e1B115b195b2e6d808F31/home
    [pools]: [],
  },
  goerli: {
    [pools]: [
      {
        name: '50 WBTC 50 WETH',
        lpToken: '0x16faf9f73748013155b7bc116a3008b57332d1e6',
        gauge: '0xf0f572ad66baacDd07d8c7ea3e0E5EFA56a76081',
      },
      {
        name: 'Balancer stETH Stable Pool',
        lpToken: '0xb60e46d90f2de35f7062a27d3a98749414036d5d',
        gauge: '0xec94b0453E14cde7fE1A66B54DCA29E9547C57ef',
      },
      {
        name: '50 WETH 50 USDC',
        lpToken: '0x9F1F16B025F703eE985B58cEd48dAf93daD2f7EF',
        gauge: '0x2002F2006303748665AF4cFf8ce37a42Fb72f170',
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
  getAddresses: function () {
    const blockchainOverride = process.env.BLOCKCHAIN_FORK ? process.env.BLOCKCHAIN_FORK : hre.network.name;
    return contractAddresses[blockchainOverride] ?? [];
  },
  PRIME_MULTISIG,
  // Deployment tag constants
  tags: {
    deployment: 'deployment',
    VoterProxy: 'VoterProxy',
    BalDepositor: 'BalDepositor',
    D2DBal: 'D2DBal',
    Controller: 'Controller',
    TokenFactory: 'TokenFactory',
    ProxyFactory: 'ProxyFactory',
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
