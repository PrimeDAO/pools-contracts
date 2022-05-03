// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETHBALMock is ERC20 {
    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;


    uint256 private constant _MINIMUM_BPT = 1e6;

    // 1e18 corresponds to 1.0, or a 100% fee
    uint256 private constant _MIN_SWAP_FEE_PERCENTAGE = 1e12; // 0.0001%
    uint256 private constant _MAX_SWAP_FEE_PERCENTAGE = 1e17; // 10%
    // The swap fee is internally stored using 64 bits, which is enough to represent _MAX_SWAP_FEE_PERCENTAGE.

    bytes32 internal _miscData;
    uint256 private _lastInvariant;

    // IVault private immutable _vault;
    IERC20 private immutable _vault;

    bytes32 private immutable _poolId;

    IERC20 internal immutable _token0;
    IERC20 internal immutable _token1;

    uint256 private immutable _normalizedWeight0;
    uint256 private immutable _normalizedWeight1;

    // The protocol fees will always be charged using the token associated with the max weight in the pool.
    // Since these Pools will register tokens only once, we can assume this index will be constant.
    uint256 private immutable _maxWeightTokenIndex;

    // All token balances are normalized to behave as if the token had 18 decimals. We assume a token's decimals will
    // not change throughout its lifetime, and store the corresponding scaling factor for each at construction time.
    // These factors are always greater than or equal to one: tokens with more than 18 decimals are not supported.
    uint256 internal immutable _scalingFactor0;
    uint256 internal immutable _scalingFactor1;

    event OracleEnabledChanged(bool enabled);
    event SwapFeePercentageChanged(uint256 swapFeePercentage);

    struct NewPoolParams {
        // IVault vault;
        IERC20 vault;
        string name;
        string symbol;
        IERC20 token0;
        IERC20 token1;
        uint256 normalizedWeight0;
        uint256 normalizedWeight1;
        uint256 swapFeePercentage;
        uint256 pauseWindowDuration;
        uint256 bufferPeriodDuration;
        bool oracleEnabled;
        address owner;
    }


    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        _balances[msg.sender] += 20000000000000000000000;
    }




    uint256 private constant _LOG_INVARIANT_OFFSET = 0;
    uint256 private constant _LOG_TOTAL_SUPPLY_OFFSET = 22;
    uint256 private constant _ORACLE_SAMPLE_CREATION_TIMESTAMP_OFFSET = 44;
    uint256 private constant _ORACLE_INDEX_OFFSET = 75;
    uint256 private constant _ORACLE_ENABLED_OFFSET = 85;
    uint256 private constant _SWAP_FEE_PERCENTAGE_OFFSET = 86;
   /**
     * @dev Returns the cached logarithm of the invariant.
     */
    function logInvariant(bytes32 data) internal pure returns (int256) {
        return data.decodeInt22(_LOG_INVARIANT_OFFSET);
    }

    /**
     * @dev Returns the cached logarithm of the total supply.
     */
    function logTotalSupply(bytes32 data) internal pure returns (int256) {
        return data.decodeInt22(_LOG_TOTAL_SUPPLY_OFFSET);
    }

    /**
     * @dev Returns the timestamp of the creation of the oracle's latest sample.
     */
    function oracleSampleCreationTimestamp(bytes32 data) internal pure returns (uint256) {
        return data.decodeUint31(_ORACLE_SAMPLE_CREATION_TIMESTAMP_OFFSET);
    }

    /**
     * @dev Returns the index of the oracle's latest sample.
     */
    function oracleIndex(bytes32 data) internal pure returns (uint256) {
        return data.decodeUint10(_ORACLE_INDEX_OFFSET);
    }

    /**
     * @dev Returns true if the oracle is enabled.
     */
    function oracleEnabled(bytes32 data) internal pure returns (bool) {
        return data.decodeBool(_ORACLE_ENABLED_OFFSET);
    }

    /**
     * @dev Returns the swap fee percentage.
     */
    function swapFeePercentage(bytes32 data) internal pure returns (uint256) {
        return data.decodeUint64(_SWAP_FEE_PERCENTAGE_OFFSET);
    }

    /**
     * @dev Sets the logarithm of the invariant in `data`, returning the updated value.
     */
    function setLogInvariant(bytes32 data, int256 _logInvariant) internal pure returns (bytes32) {
        return data.insertInt22(_logInvariant, _LOG_INVARIANT_OFFSET);
    }

    /**
     * @dev Sets the logarithm of the total supply in `data`, returning the updated value.
     */
    function setLogTotalSupply(bytes32 data, int256 _logTotalSupply) internal pure returns (bytes32) {
        return data.insertInt22(_logTotalSupply, _LOG_TOTAL_SUPPLY_OFFSET);
    }

    /**
     * @dev Sets the timestamp of the creation of the oracle's latest sample in `data`, returning the updated value.
     */
    function setOracleSampleCreationTimestamp(bytes32 data, uint256 _initialTimestamp) internal pure returns (bytes32) {
        return data.insertUint31(_initialTimestamp, _ORACLE_SAMPLE_CREATION_TIMESTAMP_OFFSET);
    }

    /**
     * @dev Sets the index of the  oracle's latest sample in `data`, returning the updated value.
     */
    function setOracleIndex(bytes32 data, uint256 _oracleIndex) internal pure returns (bytes32) {
        return data.insertUint10(_oracleIndex, _ORACLE_INDEX_OFFSET);
    }

    /**
     * @dev Enables or disables the oracle in `data`, returning the updated value.
     */
    function setOracleEnabled(bytes32 data, bool _oracleEnabled) internal pure returns (bytes32) {
        return data.insertBoolean(_oracleEnabled, _ORACLE_ENABLED_OFFSET);
    }

    /**
     * @dev Sets the swap fee percentage in `data`, returning the updated value.
     */
    function setSwapFeePercentage(bytes32 data, uint256 _swapFeePercentage) internal pure returns (bytes32) {
        return data.insertUint64(_swapFeePercentage, _SWAP_FEE_PERCENTAGE_OFFSET);
    }

    // Getters / Setters

    function getVault() public view returns (IERC20){//IVault) {
        return _vault;
    }

    function getPoolId() public view returns (bytes32) {
        return _poolId;
    }

    function getMiscData()
        external
        view
        returns (
            int256 logInvariant,
            int256 logTotalSupply,
            uint256 oracleSampleCreationTimestamp,
            uint256 oracleIndex,
            bool oracleEnabled,
            uint256 swapFeePercentage
        )
    {
        bytes32 miscData = _miscData;
        logInvariant = miscData.logInvariant();
        logTotalSupply = miscData.logTotalSupply();
        oracleSampleCreationTimestamp = miscData.oracleSampleCreationTimestamp();
        oracleIndex = miscData.oracleIndex();
        oracleEnabled = miscData.oracleEnabled();
        swapFeePercentage = miscData.swapFeePercentage();
    }

    function getSwapFeePercentage() public view returns (uint256) {
        return _miscData.swapFeePercentage();
    }

    // Caller must be approved by the Vault's Authorizer
    function setSwapFeePercentage(uint256 swapFeePercentage) external virtual {//authenticate whenNotPaused {
        _setSwapFeePercentage(swapFeePercentage);
    }

    function _setSwapFeePercentage(uint256 swapFeePercentage) private {

        _miscData = _miscData.setSwapFeePercentage(swapFeePercentage);
        emit SwapFeePercentageChanged(swapFeePercentage);
    }

 












    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        bool success = _customTransfer(_msgSender(), recipient, amount);
        return success;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 currentAllowance = _allowances[sender][_msgSender()];
        if (currentAllowance < amount) {
            return false;
        }

        bool success = _customTransfer(sender, recipient, amount);
        if (success) {
            /* solium-disable */
            unchecked {
                _approve(sender, _msgSender(), currentAllowance - amount);
            }
            /* solium-enable */
        }
        return true;
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _balances[account];
    }

    function burn(address account) public {
        _balances[account] = 0;
    }

    function _customTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual returns (bool) {
        uint256 senderBalance = _balances[sender];
        if (
            sender == address(0) ||
            recipient == address(0) ||
            senderBalance < amount
        ) {
            return false;
        }
        unchecked {
            _balances[sender] = senderBalance - amount;
        }
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual override {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

}
