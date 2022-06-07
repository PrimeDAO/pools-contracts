const minter = 'minter'
const veBal = 'veBal'
const bal = 'bal'
const gaugeController = 'gaugeController'
const wethBal = 'wethBal' // 80/20 BAL/WETH Balancer Pool Token
const PRIME_MULTISIG = 'PRIME_MULTISIG'

const contractAddresses = {
    'mainnet': {
        [minter]: "0x239e55F427D44C3cc793f49bFB507ebe76638a2b",
        [veBal]: "0xC128a9954e6c874eA3d62ce62B468bA073093F25", 
        [bal]: "0xba100000625a3754423978a60c9317c58a424e3d",
        [gaugeController]: "0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD",
        [wethBal]: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
        [PRIME_MULTISIG]: '' // TODO: setup multisig wallet
    },
    'kovan': {
        [minter]: "0xe1008f2871f5f5c3da47f806deba3cd83fe0e55b", // Address on balancer docs is wrong
        [veBal]: "0x16ba924752EF283C7946db8A122a6742AA35C1DC", 
        [bal]: "0xcb355677e36f390ccc4a5d4beadfbf1eb2071c81",
        [gaugeController]: "0x28bE1a58A534B281c3A22df28d3720323bfF331D", // again wrong address on docs
        [wethBal]: '0xdc2ecfdf2688f92c85064be0b929693acc6dbca6',
        [PRIME_MULTISIG]: '0x5F9a7EA6A79Ef04F103bfe7BD45dA65476a5155C', // Benjamin's dev wallet
    },
}

module.exports = {
    contractAddresses,
    getAddresses: function() {
        const blockchainOverride = process.env.BLOCKCHAIN_FORK ? process.env.BLOCKCHAIN_FORK : hre.network.name;
        return contractAddresses[blockchainOverride] ?? [];
    }
}