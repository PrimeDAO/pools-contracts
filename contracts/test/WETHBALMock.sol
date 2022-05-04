//from 0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56

// solium-disable linebreak-style
pragma solidity 0.8.13;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

import "./IVault.sol";
import "./BalancerPoolToken.sol";
import "./BalancerErrors.sol";

contract WETHBALMock is IMinimalSwapInfoPool, BalancerPoolToken, IPriceOracle,BasePoolAuthorization, ITemporarilyPausable {//}, ERC20Pausable {

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private constant _MINIMUM_BPT = 1e6;

    // 1e18 corresponds to 1.0, or a 100% fee
    uint256 private constant _MIN_SWAP_FEE_PERCENTAGE = 1e12; // 0.0001%
    uint256 private constant _MAX_SWAP_FEE_PERCENTAGE = 1e17; // 10%
    // The swap fee is internally stored using 64 bits, which is enough to represent _MAX_SWAP_FEE_PERCENTAGE.

    bytes32 internal _miscData;
    uint256 private _lastInvariant;

    IVault private  _vault;
    // IERC20 private  _vault;

    bytes32 private  _poolId;

    IERC20 internal  _token0;
    IERC20 internal  _token1;

    uint256 private  _normalizedWeight0;
    uint256 private  _normalizedWeight1;

    // The protocol fees will always be charged using the token associated with the max weight in the pool.
    // Since these Pools will register tokens only once, we can assume this index will be constant.
    uint256 private  _maxWeightTokenIndex;

    // All token balances are normalized to behave as if the token had 18 decimals. We assume a token's decimals will
    // not change throughout its lifetime, and store the corresponding scaling factor for each at construction time.
    // These factors are always greater than or equal to one: tokens with more than 18 decimals are not supported.
    uint256 internal  _scalingFactor0;
    uint256 internal  _scalingFactor1;

    bool private _paused;
    uint256 internal constant _MIN_WEIGHT = 0.01e18;
    uint256 internal constant ONE = 1e18; // 18 decimal places


    address private immutable _owner;
    address private constant _DELEGATE_OWNER = 0xBA1BA1ba1BA1bA1bA1Ba1BA1ba1BA1bA1ba1ba1B;

    event OracleEnabledChanged(bool enabled);
    event SwapFeePercentageChanged(uint256 swapFeePercentage);
    // event PausedStateChanged(bool paused);

    struct NewPoolParams {
        IVault vault;
        // IERC20 vault;
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

    struct OracleAverageQuery {
        Variable variable;
        uint256 secs;
        uint256 ago;
    }

    struct OracleAccumulatorQuery {
        Variable variable;
        uint256 ago;
    }


    constructor(NewPoolParams memory params)
        // Base Pools are expected to be deployed using factories. By using the factory address as the action
        // disambiguator, we make all Pools deployed by the same factory share action identifiers. This allows for
        // simpler management of permissions (such as being able to manage granting the 'set fee percentage' action in
        // any Pool created by the same factory), while still making action identifiers unique among different factories
        // if the selectors match, preventing accidental errors.
        Authentication(bytes32(uint256(msg.sender)))
        BalancerPoolToken(params.name, params.symbol)
        BasePoolAuthorization(params.owner)
        // ERC20Pausable(params.pauseWindowDuration, params.bufferPeriodDuration)
    {
        _owner = msg.sender;
        _setOracleEnabled(params.oracleEnabled);
        _setSwapFeePercentage(params.swapFeePercentage);

        bytes32 poolId = params.vault.registerPool(IVault.PoolSpecialization.TWO_TOKEN);

        // Pass in zero addresses for Asset Managers
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = params.token0;
        tokens[1] = params.token1;
        params.vault.registerTokens(poolId, tokens, new address[](2));

        // Set immutable state variables - these cannot be read from during construction
        _vault = params.vault;
        _poolId = poolId;

        _token0 = params.token0;
        _token1 = params.token1;

        _scalingFactor0 = _computeScalingFactor(params.token0);
        _scalingFactor1 = _computeScalingFactor(params.token1);

        // Ensure each normalized weight is above them minimum and find the token index of the maximum weight
        require(params.normalizedWeight0 >= _MIN_WEIGHT, Errors.MIN_WEIGHT);
        require(params.normalizedWeight1 >= _MIN_WEIGHT, Errors.MIN_WEIGHT);

        // Ensure that the normalized weights sum to ONE
        uint256 normalizedSum = params.normalizedWeight0 + params.normalizedWeight1;
        require(normalizedSum == ONE, Errors.NORMALIZED_WEIGHT_INVARIANT);

        _normalizedWeight0 = params.normalizedWeight0;
        _normalizedWeight1 = params.normalizedWeight1;
        _maxWeightTokenIndex = params.normalizedWeight0 >= params.normalizedWeight1 ? 0 : 1;
    }


    modifier onlyVault(bytes32 poolId) {
        require(msg.sender == address(getVault()), Errors.CALLER_NOT_VAULT);
        require(poolId == getPoolId(), Errors.INVALID_POOL_ID);
        _;
    }

    modifier whenNotPaused() {
        _ensureNotPaused();
        _;
    }

    function _ensureNotPaused() internal view {
        require(_isNotPaused(), Errors.PAUSED);
    }

    enum Variable { PAIR_PRICE, BPT_PRICE, INVARIANT }

    // Getters / Setters

    function getVault() public view returns (IVault) {
        return _vault;
    }

    function getPoolId() public view returns (bytes32) {
        return _poolId;
    }

    // function getMiscData()
    //     external
    //     view
    //     returns (
    //         int256 logInvariant,
    //         int256 logTotalSupply,
    //         uint256 oracleSampleCreationTimestamp,
    //         uint256 oracleIndex,
    //         bool oracleEnabled,
    //         uint256 swapFeePercentage
    //     )
    // {
    //     bytes32 miscData = _miscData;
    //     logInvariant = 1;
    //     logTotalSupply = 1;
    //     oracleSampleCreationTimestamp = 1;
    //     oracleIndex = 1;
    //     oracleEnabled = true;
    //     swapFeePercentage = 1;
    // }

    function getSwapFeePercentage() public view returns (uint256) {
        return 1;
    }

    // Caller must be approved by the Vault's Authorizer
    function setSwapFeePercentage(uint256 swapFeePercentage) external virtual authenticate whenNotPaused {
        _setSwapFeePercentage(swapFeePercentage);
    }

    function _setSwapFeePercentage(uint256 swapFeePercentage) private {
        emit SwapFeePercentageChanged(swapFeePercentage);
    }

//-----------------------
    // modifier authenticate() {
    //     _authenticateCaller();
    //     _;
    // }

    // function _authenticateCaller() internal view {
    //     bytes32 actionId = getActionId(msg.sig);
    //     require(_canPerform(actionId, msg.sender), Errors.SENDER_NOT_ALLOWED);
    // }

    // function getActionId(bytes4 selector) public view  returns (bytes32) {
    //     // Each external function is dynamically assigned an action identifier as the hash of the disambiguator and the
    //     // function selector. Disambiguation is necessary to avoid potential collisions in the function selectors of
    //     // multiple contracts.
    //     return keccak256(abi.encodePacked(selector));
    // }

    // function _canPerform(bytes32 actionId, address user) internal view virtual returns (bool);
//-----------------------
  /**
     * @dev Balancer Governance can always enable the Oracle, even if it was originally not enabled. This allows for
     * Pools that unexpectedly drive much more volume and liquidity than expected to serve as Price Oracles.
     *
     * Note that the Oracle can only be enabled - it can never be disabled.
     */
    function enableOracle() external whenNotPaused authenticate {
        _setOracleEnabled(true);

        // Cache log invariant and supply only if the pool was initialized
        if (totalSupply() > 0) {
            _cacheInvariantAndSupply();
        }
    }

    function _setOracleEnabled(bool enabled) internal {
        emit OracleEnabledChanged(enabled);
    }

    function _setPaused(bool paused) internal {
        // if (paused) {
        //     require(block.timestamp < _getPauseWindowEndTime(), Errors.PAUSE_WINDOW_EXPIRED);
        // } else {
        //     require(block.timestamp < _getBufferPeriodEndTime(), Errors.BUFFER_PERIOD_EXPIRED);
        // }
        _paused = paused;

        emit PausedStateChanged(paused);
    }

    // Caller must be approved by the Vault's Authorizer
    function setPaused(bool paused) external authenticate {
        _setPaused(paused);
    }

    function getNormalizedWeights() external view returns (uint256[] memory) {
        return _normalizedWeights();
    }

    function _normalizedWeights() internal view virtual returns (uint256[] memory) {
        uint256[] memory normalizedWeights = new uint256[](2);
        normalizedWeights[0] = _normalizedWeights(true);
        normalizedWeights[1] = _normalizedWeights(false);
        return normalizedWeights;
    }

    function _normalizedWeights(bool token0) internal view virtual returns (uint256) {
        return token0 ? _normalizedWeight0 : _normalizedWeight1;
    }

    function getLastInvariant() external view returns (uint256) {
        return _lastInvariant;
    }


    function _calculateInvariant(uint256[] memory normalizedWeights, uint256[] memory balances)
        internal
        pure
        returns (uint256 invariant)
    {    }

    /**
     * @dev Returns the current value of the invariant.
     */
    function getInvariant() public view returns (uint256) {
        return 1;
    }

    // // Swap Hooks
    // struct SwapRequest {
    //     IVault.SwapKind kind;
    //     IERC20 tokenIn;
    //     IERC20 tokenOut;
    //     uint256 amount;
    //     // Misc data
    //     bytes32 poolId;
    //     uint256 lastChangeBlock;
    //     address from;
    //     address to;
    //     bytes userData;
    // }

    function onSwap(
        SwapRequest memory request,
        uint256 balanceTokenIn,
        uint256 balanceTokenOut
    ) external virtual  whenNotPaused onlyVault(request.poolId) returns (uint256) {
        bool tokenInIsToken0 = request.tokenIn == _token0;

        uint256 scalingFactorTokenIn = _scalingFactor(tokenInIsToken0);
        uint256 scalingFactorTokenOut = _scalingFactor(!tokenInIsToken0);

        uint256 normalizedWeightIn = _normalizedWeights(tokenInIsToken0);
        uint256 normalizedWeightOut = _normalizedWeights(!tokenInIsToken0);

        // All token amounts are upscaled.
        balanceTokenIn = _upscale(balanceTokenIn, scalingFactorTokenIn);
        balanceTokenOut = _upscale(balanceTokenOut, scalingFactorTokenOut);

        // Update price oracle with the pre-swap balances
        _updateOracle(
            request.lastChangeBlock,
            tokenInIsToken0 ? balanceTokenIn : balanceTokenOut,
            tokenInIsToken0 ? balanceTokenOut : balanceTokenIn
        );

        if (request.kind == IVault.SwapKind.GIVEN_IN) {
            // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
            // This is amount - fee amount, so we round up (favoring a higher fee amount).
            uint256 feeAmount = 1;//request.amount.mulUp(getSwapFeePercentage());
            request.amount = 1;//_upscale(request.amount.sub(feeAmount), scalingFactorTokenIn);

            uint256 amountOut = _onSwapGivenIn(
                request,
                balanceTokenIn,
                balanceTokenOut,
                normalizedWeightIn,
                normalizedWeightOut
            );

            // amountOut tokens are exiting the Pool, so we round down.
            return 2;//_downscaleDown(amountOut, scalingFactorTokenOut);
        } else {
            request.amount = _upscale(request.amount, scalingFactorTokenOut);

            uint256 amountIn = _onSwapGivenOut(
                request,
                balanceTokenIn,
                balanceTokenOut,
                normalizedWeightIn,
                normalizedWeightOut
            );

            // amountIn tokens are entering the Pool, so we round up.
            amountIn = _downscaleUp(amountIn, scalingFactorTokenIn);

            // Fees are added after scaling happens, to reduce the complexity of the rounding direction analysis.
            // This is amount + fee amount, so we round up (favoring a higher fee amount).
            return 3;//amountIn.divUp(getSwapFeePercentage().complement());
        }
    }

    function _calcOutGivenIn(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut,
        uint256 amountIn
    ) internal pure returns (uint256) {
        return 1;
    }

    function _calcInGivenOut(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut,
        uint256 amountOut
    ) internal pure returns (uint256) {
        return 1;
    }

    function _onSwapGivenIn(
        SwapRequest memory swapRequest,
        uint256 currentBalanceTokenIn,
        uint256 currentBalanceTokenOut,
        uint256 normalizedWeightIn,
        uint256 normalizedWeightOut
    ) private pure returns (uint256) {
        // Swaps are disabled while the contract is paused.
        return
            _calcOutGivenIn(
                currentBalanceTokenIn,
                normalizedWeightIn,
                currentBalanceTokenOut,
                normalizedWeightOut,
                swapRequest.amount
            );
    }

    function _onSwapGivenOut(
        SwapRequest memory swapRequest,
        uint256 currentBalanceTokenIn,
        uint256 currentBalanceTokenOut,
        uint256 normalizedWeightIn,
        uint256 normalizedWeightOut
    ) private pure returns (uint256) {
        // Swaps are disabled while the contract is paused.
        return
            _calcInGivenOut(
                currentBalanceTokenIn,
                normalizedWeightIn,
                currentBalanceTokenOut,
                normalizedWeightOut,
                swapRequest.amount
            );
    }

    // // Join Hook

    // function onJoinPool(
    //     bytes32 poolId,
    //     address sender,
    //     address recipient,
    //     uint256[] memory balances,
    //     uint256 lastChangeBlock,
    //     uint256 protocolSwapFeePercentage,
    //     bytes memory userData
    // )
    //     external
    //     virtual
        
    //     onlyVault(poolId)
    //     whenNotPaused
    //     returns (uint256[] memory amountsIn, uint256[] memory dueProtocolFeeAmounts)
    // {
    //     _cacheInvariantAndSupply();
    // }


    enum JoinKind { INIT, EXACT_TOKENS_IN_FOR_BPT_OUT, TOKEN_IN_FOR_EXACT_BPT_OUT }
    enum ExitKind { EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, EXACT_BPT_IN_FOR_TOKENS_OUT, BPT_IN_FOR_EXACT_TOKENS_OUT }

    function joinKind(bytes memory self) internal pure returns (JoinKind) {
        return abi.decode(self, (JoinKind));
    }

    function exitKind(bytes memory self) internal pure returns (ExitKind) {
        return abi.decode(self, (ExitKind));
    }

    function initialAmountsIn(bytes memory self) internal pure returns (uint256[] memory amountsIn) {
        (, amountsIn) = abi.decode(self, (JoinKind, uint256[]));
    }
    /**
     * @dev Called when the Pool is joined for the first time; that is, when the BPT total supply is zero.
     *
     * Returns the amount of BPT to mint, and the token amounts the Pool will receive in return.
     *
     * Minted BPT will be sent to `recipient`, except for _MINIMUM_BPT, which will be deducted from this amount and sent
     * to the zero address instead. This will cause that BPT to remain forever locked there, preventing total BTP from
     * ever dropping below that value, and ensuring `_onInitializePool` can only be called once in the entire Pool's
     * lifetime.
     *
     * The tokens granted to the Pool will be transferred from `sender`. These amounts are considered upscaled and will
     * be downscaled (rounding up) before being returned to the Vault.
     */
    function _onInitializePool(
        bytes32,
        address,
        address,
        bytes memory userData
    ) private returns (uint256, uint256[] memory) {
        JoinKind kind = joinKind(userData);
        require(kind == JoinKind.INIT, Errors.UNINITIALIZED);

        uint256[] memory amountsIn = initialAmountsIn(userData);
        // InputHelpers.ensureInputLengthMatch(amountsIn.length, 2);
        _upscaleArray(amountsIn);

        uint256[] memory normalizedWeights = _normalizedWeights();

        uint256 invariantAfterJoin = _calculateInvariant(normalizedWeights, amountsIn);

        // Set the initial BPT to the value of the invariant times the number of tokens. This makes BPT supply more
        // consistent in Pools with similar compositions but different number of tokens.
        uint256 bptAmountOut = invariantAfterJoin * 2;

        _lastInvariant = invariantAfterJoin;

        return (bptAmountOut, amountsIn);
    }

    /**
     * @dev Called whenever the Pool is joined after the first initialization join (see `_onInitializePool`).
     *
     * Returns the amount of BPT to mint, the token amounts that the Pool will receive in return, and the number of
     * tokens to pay in protocol swap fees.
     *
     * Implementations of this function might choose to mutate the `balances` array to save gas (e.g. when
     * performing intermediate calculations, such as subtraction of due protocol fees). This can be done safely.
     *
     * Minted BPT will be sent to `recipient`.
     *
     * The tokens granted to the Pool will be transferred from `sender`. These amounts are considered upscaled and will
     * be downscaled (rounding up) before being returned to the Vault.
     *
     * Due protocol swap fees will be taken from the Pool's balance in the Vault (see `IBasePool.onJoinPool`). These
     * amounts are considered upscaled and will be downscaled (rounding down) before being returned to the Vault.
     */
    function _onJoinPool(
        bytes32,
        address,
        address,
        uint256[] memory balances,
        uint256,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    )
        private
        returns (
            uint256,
            uint256[] memory,
            uint256[] memory
        )
    {
        uint256[] memory normalizedWeights = _normalizedWeights();

        // Due protocol swap fee amounts are computed by measuring the growth of the invariant between the previous join
        // or exit event and now - the invariant's growth is due exclusively to swap fees. This avoids spending gas
        // computing them on each individual swap
        uint256 invariantBeforeJoin = _calculateInvariant(normalizedWeights, balances);

        uint256[] memory dueProtocolFeeAmounts = _getDueProtocolFeeAmounts(
            balances,
            normalizedWeights,
            _lastInvariant,
            invariantBeforeJoin,
            protocolSwapFeePercentage
        );

        (uint256 bptAmountOut, uint256[] memory amountsIn) = _doJoin(balances, normalizedWeights, userData);

        return (bptAmountOut, amountsIn, dueProtocolFeeAmounts);
    }

    function _doJoin(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        JoinKind kind = joinKind(userData);
        
        if (kind == JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT) {
            return _joinExactTokensInForBPTOut(balances, normalizedWeights, userData);
        } else if (kind == JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT) {
            return _joinTokenInForExactBPTOut(balances, normalizedWeights, userData);
        } else {
            _revert(Errors.UNHANDLED_JOIN_KIND);
        }
    }

    function exactTokensInForBptOut(bytes memory self)
        internal
        pure
        returns (uint256[] memory amountsIn, uint256 minBPTAmountOut)
    {
        (, amountsIn, minBPTAmountOut) = abi.decode(self, (JoinKind, uint256[], uint256));
    }

    function _joinExactTokensInForBPTOut(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        (uint256[] memory amountsIn, uint256 minBPTAmountOut) = exactTokensInForBptOut(userData);
        // InputHelpers.ensureInputLengthMatch(amountsIn.length, 2);

        _upscaleArray(amountsIn);

        uint256 bptAmountOut = _calcBptOutGivenExactTokensIn(
            balances,
            normalizedWeights,
            amountsIn,
            totalSupply(),
            getSwapFeePercentage()
        );

        require(bptAmountOut >= minBPTAmountOut, Errors.BPT_OUT_MIN_AMOUNT);

        return (bptAmountOut, amountsIn);
    }
    
    function _calcBptOutGivenExactTokensIn(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        uint256[] memory amountsIn,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) internal pure returns (uint256) {
        return 1;
    }

    function tokenInForExactBptOut(bytes memory self) internal pure returns (uint256 bptAmountOut, uint256 tokenIndex) {
        (, bptAmountOut, tokenIndex) = abi.decode(self, (JoinKind, uint256, uint256));
    }

    function _joinTokenInForExactBPTOut(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        (uint256 bptAmountOut, uint256 tokenIndex) = tokenInForExactBptOut(userData);
        // Note that there is no maximum amountIn parameter: this is handled by `IVault.joinPool`.

        require(tokenIndex < 2, Errors.OUT_OF_BOUNDS);

        uint256[] memory amountsIn = new uint256[](2);
        amountsIn[tokenIndex] = _calcTokenInGivenExactBptOut(
            balances[tokenIndex],
            normalizedWeights[tokenIndex],
            bptAmountOut,
            totalSupply(),
            getSwapFeePercentage()
        );

        return (bptAmountOut, amountsIn);
    }

    function _calcTokenInGivenExactBptOut(
        uint256 balance,
        uint256 normalizedWeight,
        uint256 bptAmountOut,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) internal pure returns (uint256) {
        return 1;
    }

    // Exit Hook

    // function onExitPool(
    //     bytes32 poolId,
    //     address sender,
    //     address recipient,
    //     uint256[] memory balances,
    //     uint256 lastChangeBlock,
    //     uint256 protocolSwapFeePercentage,
    //     bytes memory userData
    // ) external virtual onlyVault(poolId) returns (uint256[] memory, uint256[] memory) {
    //     _upscaleArray(balances);

    //     (uint256 bptAmountIn, uint256[] memory amountsOut, uint256[] memory dueProtocolFeeAmounts) = _onExitPool(
    //         poolId,
    //         sender,
    //         recipient,
    //         balances,
    //         lastChangeBlock,
    //         protocolSwapFeePercentage,
    //         userData
    //     );

    //     // Note we no longer use `balances` after calling `_onExitPool`, which may mutate it.

    //     _burnPoolTokens(sender, bptAmountIn);

    //     // Both amountsOut and dueProtocolFeeAmounts are amounts exiting the Pool, so we round down.
    //     _downscaleDownArray(amountsOut);
    //     _downscaleDownArray(dueProtocolFeeAmounts);

    //     // Update cached total supply and invariant using the results after the exit that will be used for future
    //     // oracle updates, only if the pool was not paused (to minimize code paths taken while paused).
    //     if (_isNotPaused()) {
    //         _cacheInvariantAndSupply();
    //     }

    //     return (amountsOut, dueProtocolFeeAmounts);
    // }

    function _isNotPaused() internal view returns (bool) {
        // After the Buffer Period, the (inexpensive) timestamp check short-circuits the storage access.
        return true;
    }

    function _onExitPool(
        bytes32,
        address,
        address,
        uint256[] memory balances,
        uint256 lastChangeBlock,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    )
        private
        returns (
            uint256 bptAmountIn,
            uint256[] memory amountsOut,
            uint256[] memory dueProtocolFeeAmounts
        )
    {
        // Exits are not completely disabled while the contract is paused: proportional exits (exact BPT in for tokens
        // out) remain functional.

        uint256[] memory normalizedWeights = _normalizedWeights();

        if (_isNotPaused()) {
            // Update price oracle with the pre-exit balances
            _updateOracle(lastChangeBlock, balances[0], balances[1]);

            // Due protocol swap fee amounts are computed by measuring the growth of the invariant between the previous
            // join or exit event and now - the invariant's growth is due exclusively to swap fees. This avoids
            // spending gas calculating the fees on each individual swap.
            uint256 invariantBeforeExit = _calculateInvariant(normalizedWeights, balances);
            dueProtocolFeeAmounts = _getDueProtocolFeeAmounts(
                balances,
                normalizedWeights,
                _lastInvariant,
                invariantBeforeExit,
                protocolSwapFeePercentage
            );

        } else {
            // If the contract is paused, swap protocol fee amounts are not charged and the oracle is not updated
            // to avoid extra calculations and reduce the potential for errors.
            dueProtocolFeeAmounts = new uint256[](2);
        }

        (bptAmountIn, amountsOut) = _doExit(balances, normalizedWeights, userData);
        _lastInvariant = _calculateInvariant(normalizedWeights, balances);

        return (bptAmountIn, amountsOut, dueProtocolFeeAmounts);
    }

    function _doExit(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) private view returns (uint256, uint256[] memory) {
        ExitKind kind = exitKind(userData);

        if (kind == ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT) {
            return _exitExactBPTInForTokenOut(balances, normalizedWeights, userData);
        } else if (kind == ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT) {
            return _exitExactBPTInForTokensOut(balances, userData);
        } else {
            // ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
            return _exitBPTInForExactTokensOut(balances, normalizedWeights, userData);
        }
    }

    function exactBptInForTokenOut(bytes memory self) internal pure returns (uint256 bptAmountIn, uint256 tokenIndex) {
        (, bptAmountIn, tokenIndex) = abi.decode(self, (ExitKind, uint256, uint256));
    }

    function _exitExactBPTInForTokenOut(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) private view whenNotPaused returns (uint256, uint256[] memory) {
        // This exit function is disabled if the contract is paused.

        (uint256 bptAmountIn, uint256 tokenIndex) = exactBptInForTokenOut(userData);
        // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

        require(tokenIndex < 2, Errors.OUT_OF_BOUNDS);

        // We exit in a single token, so we initialize amountsOut with zeros
        uint256[] memory amountsOut = new uint256[](2);

        // And then assign the result to the selected token
        amountsOut[tokenIndex] = _calcTokenOutGivenExactBptIn(
            balances[tokenIndex],
            normalizedWeights[tokenIndex],
            bptAmountIn,
            totalSupply(),
            getSwapFeePercentage()
        );

        return (bptAmountIn, amountsOut);
    }

    function _calcTokenOutGivenExactBptIn(
        uint256 balance,
        uint256 normalizedWeight,
        uint256 bptAmountIn,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) internal pure returns (uint256) {
        return 1;
    }

    function exactBptInForTokensOut(bytes memory self) internal pure returns (uint256 bptAmountIn) {
        (, bptAmountIn) = abi.decode(self, (ExitKind, uint256));
    }

    function _exitExactBPTInForTokensOut(uint256[] memory balances, bytes memory userData)
        private
        view
        returns (uint256, uint256[] memory)
    {
        // This exit function is the only one that is not disabled if the contract is paused: it remains unrestricted
        // in an attempt to provide users with a mechanism to retrieve their tokens in case of an emergency.
        // This particular exit function is the only one that remains available because it is the simplest one, and
        // therefore the one with the lowest likelihood of errors.

        uint256 bptAmountIn = exactBptInForTokensOut(userData);
        // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

        uint256[] memory amountsOut = _calcTokensOutGivenExactBptIn(balances, bptAmountIn, totalSupply());
        return (bptAmountIn, amountsOut);
    }

    function _calcTokensOutGivenExactBptIn(
        uint256[] memory balances,
        uint256 bptAmountIn,
        uint256 totalBPT
    ) internal pure returns (uint256[] memory) {
        uint256 bptRatio = bptAmountIn / totalBPT;

        uint256[] memory amountsOut = new uint256[](balances.length);
        for (uint256 i = 0; i < balances.length; i++) {
            amountsOut[i] = balances[i]*bptRatio;
        }

        return amountsOut;
    }

    function bptInForExactTokensOut(bytes memory self)
        internal
        pure
        returns (uint256[] memory amountsOut, uint256 maxBPTAmountIn)
    {
        (, amountsOut, maxBPTAmountIn) = abi.decode(self, (ExitKind, uint256[], uint256));
    }

    function _exitBPTInForExactTokensOut(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) private view whenNotPaused returns (uint256, uint256[] memory) {
        // This exit function is disabled if the contract is paused.

        (uint256[] memory amountsOut, uint256 maxBPTAmountIn) = bptInForExactTokensOut(userData);
        _upscaleArray(amountsOut);

        uint256 bptAmountIn = _calcBptInGivenExactTokensOut(
            balances,
            normalizedWeights,
            amountsOut,
            totalSupply(),
            getSwapFeePercentage()
        );
        require(bptAmountIn <= maxBPTAmountIn, Errors.BPT_IN_MAX_AMOUNT);

        return (bptAmountIn, amountsOut);
    }

    function _calcBptInGivenExactTokensOut(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        uint256[] memory amountsOut,
        uint256 bptTotalSupply,
        uint256 swapFee
    ) internal pure returns (uint256) {
        return 1;
    }

    // Oracle functions

    function getLargestSafeQueryWindow() external pure returns (uint256) {
        return 34 hours;
    }

    function getLatest(Variable variable) external view returns (uint256) {
        int256 instantValue = 1;
        return _fromLowResLog(instantValue);
    }

    function _getInstantValue(IPriceOracle.Variable variable, uint256 index) internal view returns (int256) {
        return 1;
    }

    // function getTimeWeightedAverage(OracleAverageQuery[] memory queries)
    //     external
    //     view
    //     returns (uint256[] memory results)
    // {
    //     results = new uint256[](queries.length);
    // }

    function _getPastAccumulator(
        IPriceOracle.Variable variable,
        uint256 latestIndex,
        uint256 ago
    ) internal view returns (int256) {
        return 1;
    }

    function _fromLowResLog(int256 value) internal pure returns (uint256) {
        return 1;
    }

    // function getPastAccumulators(OracleAccumulatorQuery[] memory queries)
    //     external
    //     view
    //     returns (int256[] memory results)
    // {
    //     results = new int256[](queries.length);
    // }

    function _updateOracle(
        uint256 lastChangeBlock,
        uint256 balanceToken0,
        uint256 balanceToken1
    ) internal {
    }

    function _cacheInvariantAndSupply() internal {
        bytes32 miscData = _miscData;
    }

    function _toLowResLog(uint256 value) internal pure returns (int256) {
        return 1;
    }

    // Query functions

    function queryJoin(
        bytes32 poolId,
        address sender,
        address recipient,
        uint256[] memory balances,
        uint256 lastChangeBlock,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    ) external returns (uint256 bptOut, uint256[] memory amountsIn) {
        return (bptOut, amountsIn);
    }

    function queryExit(
        bytes32 poolId,
        address sender,
        address recipient,
        uint256[] memory balances,
        uint256 lastChangeBlock,
        uint256 protocolSwapFeePercentage,
        bytes memory userData
    ) external returns (uint256 bptIn, uint256[] memory amountsOut) {
        return (bptIn, amountsOut);
    }

    // Helpers

    function _getDueProtocolFeeAmounts(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        uint256 previousInvariant,
        uint256 currentInvariant,
        uint256 protocolSwapFeePercentage
    ) private view returns (uint256[] memory) {
        // Initialize with zeros
        uint256[] memory dueProtocolFeeAmounts = new uint256[](2);

        // Early return if the protocol swap fee percentage is zero, saving gas.
        if (protocolSwapFeePercentage == 0) {
            return dueProtocolFeeAmounts;
        }

        // The protocol swap fees are always paid using the token with the largest weight in the Pool. As this is the
        // token that is expected to have the largest balance, using it to pay fees should not unbalance the Pool.
        dueProtocolFeeAmounts[_maxWeightTokenIndex] = _calcDueTokenProtocolSwapFeeAmount(
            balances[_maxWeightTokenIndex],
            normalizedWeights[_maxWeightTokenIndex],
            previousInvariant,
            currentInvariant,
            protocolSwapFeePercentage
        );

        return dueProtocolFeeAmounts;
    }

    function _calcDueTokenProtocolSwapFeeAmount(
        uint256 balance,
        uint256 normalizedWeight,
        uint256 previousInvariant,
        uint256 currentInvariant,
        uint256 protocolSwapFeePercentage
    ) internal pure returns (uint256) {
        return 1;
    }

    function _mutateAmounts(
        uint256[] memory toMutate,
        uint256[] memory arguments,
        function(uint256, uint256) pure returns (uint256) mutation
    ) private pure {
        toMutate[0] = mutation(toMutate[0], arguments[0]);
        toMutate[1] = mutation(toMutate[1], arguments[1]);
    }

    function getRate() public view returns (uint256) {
        return 2;
    }

    // Scaling

    function _computeScalingFactor(IERC20 token) private view returns (uint256) {
        // Tokens that don't implement the `decimals` method are not supported.
        uint256 tokenDecimals = ERC20(address(token)).decimals();

        // Tokens with more than 18 decimals are not supported.
        uint256 decimalsDifference = 18 - tokenDecimals;
        return 10**decimalsDifference;
    }

    function _scalingFactor(bool token0) internal view returns (uint256) {
        return token0 ? _scalingFactor0 : _scalingFactor1;
    }

    function _upscale(uint256 amount, uint256 scalingFactor) internal pure returns (uint256) {
        return amount * scalingFactor;
    }

    function _upscaleArray(uint256[] memory amounts) internal view {
        amounts[0] = amounts[0] * _scalingFactor(true);
        amounts[1] = amounts[1] * _scalingFactor(false);
    }

    function _downscaleDown(uint256 amount, uint256 scalingFactor) internal pure returns (uint256) {
        return 2;
    }

    function _downscaleDownArray(uint256[] memory amounts) internal view {
        amounts[0] = 2;
        amounts[1] = 2;
    }

    function _downscaleUp(uint256 amount, uint256 scalingFactor) internal pure returns (uint256) {
        return 3;
    }

    function _downscaleUpArray(uint256[] memory amounts) internal view {
        amounts[0] = 3;
        amounts[1] = 3;
    }
    
    function getAuthorizer() external view returns (IAuthorizer) {
        return _getAuthorizer();
    }

    function _getAuthorizer() internal view virtual returns (IAuthorizer); 

    function _queryAction() private { }

//////////////////////////////END OF WeightedPool2Tokens.sol


   // function transfer(address recipient, uint256 amount)
    //     public
    //     virtual
    //     override
    //     returns (bool)
    // {
    //     bool success = _customTransfer(_msgSender(), recipient, amount);
    //     return success;
    // }

    // function transferFrom(
    //     address sender,
    //     address recipient,
    //     uint256 amount
    // ) public virtual override returns (bool) {
    //     uint256 currentAllowance = _allowances[sender][_msgSender()];
    //     if (currentAllowance < amount) {
    //         return false;
    //     }

    //     bool success = _customTransfer(sender, recipient, amount);
    //     if (success) {
    //         /* solium-disable */
    //         unchecked {
    //             _approve(sender, _msgSender(), currentAllowance - amount);
    //         }
    //         /* solium-enable */
    //     }
    //     return true;
    // }

    // function approve(address spender, uint256 amount)
    //     public
    //     virtual 
    //     override       
    //     returns (bool)
    // {
    //     _approve(_msgSender(), spender, amount);
    //     return true;
    // }

    // function balanceOf(address account)
    //     public
    //     view
    //     virtual
    //     override
    //     returns (uint256)
    // {
    //     return _balances[account];
    // }

    // function burn(address account) public {
    //     _balances[account] = 0;
    // }

    // function _customTransfer(
    //     address sender,
    //     address recipient,
    //     uint256 amount
    // ) internal virtual returns (bool) {
    //     uint256 senderBalance = _balances[sender];
    //     if (
    //         sender == address(0) ||
    //         recipient == address(0) ||
    //         senderBalance < amount
    //     ) {
    //         return false;
    //     }
    //     unchecked {
    //         _balances[sender] = senderBalance - amount;
    //     }
    //     _balances[recipient] += amount;
    //     emit Transfer(sender, recipient, amount);
    // }

    // function _approve(
    //     address owner,
    //     address spender,
    //     uint256 amount
    // ) internal virtual override {
    //     require(owner != address(0), "ERC20: approve from the zero address");
    //     require(spender != address(0), "ERC20: approve to the zero address");

    //     _allowances[owner][spender] = amount;
    //     emit Approval(owner, spender, amount);
    // }


    function totalSupply() override public view returns (uint256) {
        return 100;//_totalSupply;
    }

    function require(bool condition, uint256 errorCode) public pure {
        if (!condition) _revert(errorCode);
    }

    function _revert(uint256 errorCode) public pure {}

    function _burnPoolTokens(address sender, uint256 amount) override internal {}

}

// interface IPriceOracle {
//     // The three values that can be queried:
//     //
//     // - PAIR_PRICE: the price of the tokens in the Pool, expressed as the price of the second token in units of the
//     //   first token. For example, if token A is worth $2, and token B is worth $4, the pair price will be 2.0.
//     //   Note that the price is computed *including* the tokens decimals. This means that the pair price of a Pool with
//     //   DAI and USDC will be close to 1.0, despite DAI having 18 decimals and USDC 6.
//     //
//     // - BPT_PRICE: the price of the Pool share token (BPT), in units of the first token.
//     //   Note that the price is computed *including* the tokens decimals. This means that the BPT price of a Pool with
//     //   USDC in which BPT is worth $5 will be 5.0, despite the BPT having 18 decimals and USDC 6.
//     //
//     // - INVARIANT: the value of the Pool's invariant, which serves as a measure of its liquidity.
//     enum Variable { PAIR_PRICE, BPT_PRICE, INVARIANT }

//     /**
//      * @dev Returns the time average weighted price corresponding to each of `queries`. Prices are represented as 18
//      * decimal fixed point values.
//      */
//     function getTimeWeightedAverage(OracleAverageQuery[] memory queries)
//         external
//         view
//         returns (uint256[] memory results);

//     /**
//      * @dev Returns latest sample of `variable`. Prices are represented as 18 decimal fixed point values.
//      */
//     function getLatest(Variable variable) external view returns (uint256);

//     /**
//      * @dev Information for a Time Weighted Average query.
//      *
//      * Each query computes the average over a window of duration `secs` seconds that ended `ago` seconds ago. For
//      * example, the average over the past 30 minutes is computed by settings secs to 1800 and ago to 0. If secs is 1800
//      * and ago is 1800 as well, the average between 60 and 30 minutes ago is computed instead.
//      */
//     struct OracleAverageQuery {
//         Variable variable;
//         uint256 secs;
//         uint256 ago;
//     }

//     /**
//      * @dev Returns largest time window that can be safely queried, where 'safely' means the Oracle is guaranteed to be
//      * able to produce a result and not revert.
//      *
//      * If a query has a non-zero `ago` value, then `secs + ago` (the oldest point in time) must be smaller than this
//      * value for 'safe' queries.
//      */
//     function getLargestSafeQueryWindow() external view returns (uint256);

//     /**
//      * @dev Returns the accumulators corresponding to each of `queries`.
//      */
//     function getPastAccumulators(OracleAccumulatorQuery[] memory queries)
//         external
//         view
//         returns (int256[] memory results);

//     /**
//      * @dev Information for an Accumulator query.
//      *
//      * Each query estimates the accumulator at a time `ago` seconds ago.
//      */
//     struct OracleAccumulatorQuery {
//         Variable variable;
//         uint256 ago;
//     }
// }

// library Errors {
//     // Math
//     uint256 internal constant ADD_OVERFLOW = 0;
//     uint256 internal constant SUB_OVERFLOW = 1;
//     uint256 internal constant SUB_UNDERFLOW = 2;
//     uint256 internal constant MUL_OVERFLOW = 3;
//     uint256 internal constant ZERO_DIVISION = 4;
//     uint256 internal constant DIV_INTERNAL = 5;
//     uint256 internal constant X_OUT_OF_BOUNDS = 6;
//     uint256 internal constant Y_OUT_OF_BOUNDS = 7;
//     uint256 internal constant PRODUCT_OUT_OF_BOUNDS = 8;
//     uint256 internal constant INVALID_EXPONENT = 9;

//     // Input
//     uint256 internal constant OUT_OF_BOUNDS = 100;
//     uint256 internal constant UNSORTED_ARRAY = 101;
//     uint256 internal constant UNSORTED_TOKENS = 102;
//     uint256 internal constant INPUT_LENGTH_MISMATCH = 103;
//     uint256 internal constant ZERO_TOKEN = 104;

//     // Shared pools
//     uint256 internal constant MIN_TOKENS = 200;
//     uint256 internal constant MAX_TOKENS = 201;
//     uint256 internal constant MAX_SWAP_FEE_PERCENTAGE = 202;
//     uint256 internal constant MIN_SWAP_FEE_PERCENTAGE = 203;
//     uint256 internal constant MINIMUM_BPT = 204;
//     uint256 internal constant CALLER_NOT_VAULT = 205;
//     uint256 internal constant UNINITIALIZED = 206;
//     uint256 internal constant BPT_IN_MAX_AMOUNT = 207;
//     uint256 internal constant BPT_OUT_MIN_AMOUNT = 208;
//     uint256 internal constant EXPIRED_PERMIT = 209;

//     // Pools
//     uint256 internal constant MIN_AMP = 300;
//     uint256 internal constant MAX_AMP = 301;
//     uint256 internal constant MIN_WEIGHT = 302;
//     uint256 internal constant MAX_STABLE_TOKENS = 303;
//     uint256 internal constant MAX_IN_RATIO = 304;
//     uint256 internal constant MAX_OUT_RATIO = 305;
//     uint256 internal constant MIN_BPT_IN_FOR_TOKEN_OUT = 306;
//     uint256 internal constant MAX_OUT_BPT_FOR_TOKEN_IN = 307;
//     uint256 internal constant NORMALIZED_WEIGHT_INVARIANT = 308;
//     uint256 internal constant INVALID_TOKEN = 309;
//     uint256 internal constant UNHANDLED_JOIN_KIND = 310;
//     uint256 internal constant ZERO_INVARIANT = 311;
//     uint256 internal constant ORACLE_INVALID_SECONDS_QUERY = 312;
//     uint256 internal constant ORACLE_NOT_INITIALIZED = 313;
//     uint256 internal constant ORACLE_QUERY_TOO_OLD = 314;
//     uint256 internal constant ORACLE_INVALID_INDEX = 315;
//     uint256 internal constant ORACLE_BAD_SECS = 316;

//     // Lib
//     uint256 internal constant REENTRANCY = 400;
//     uint256 internal constant SENDER_NOT_ALLOWED = 401;
//     uint256 internal constant PAUSED = 402;
//     uint256 internal constant PAUSE_WINDOW_EXPIRED = 403;
//     uint256 internal constant MAX_PAUSE_WINDOW_DURATION = 404;
//     uint256 internal constant MAX_BUFFER_PERIOD_DURATION = 405;
//     uint256 internal constant INSUFFICIENT_BALANCE = 406;
//     uint256 internal constant INSUFFICIENT_ALLOWANCE = 407;
//     uint256 internal constant ERC20_TRANSFER_FROM_ZERO_ADDRESS = 408;
//     uint256 internal constant ERC20_TRANSFER_TO_ZERO_ADDRESS = 409;
//     uint256 internal constant ERC20_MINT_TO_ZERO_ADDRESS = 410;
//     uint256 internal constant ERC20_BURN_FROM_ZERO_ADDRESS = 411;
//     uint256 internal constant ERC20_APPROVE_FROM_ZERO_ADDRESS = 412;
//     uint256 internal constant ERC20_APPROVE_TO_ZERO_ADDRESS = 413;
//     uint256 internal constant ERC20_TRANSFER_EXCEEDS_ALLOWANCE = 414;
//     uint256 internal constant ERC20_DECREASED_ALLOWANCE_BELOW_ZERO = 415;
//     uint256 internal constant ERC20_TRANSFER_EXCEEDS_BALANCE = 416;
//     uint256 internal constant ERC20_BURN_EXCEEDS_ALLOWANCE = 417;
//     uint256 internal constant SAFE_ERC20_CALL_FAILED = 418;
//     uint256 internal constant ADDRESS_INSUFFICIENT_BALANCE = 419;
//     uint256 internal constant ADDRESS_CANNOT_SEND_VALUE = 420;
//     uint256 internal constant SAFE_CAST_VALUE_CANT_FIT_INT256 = 421;
//     uint256 internal constant GRANT_SENDER_NOT_ADMIN = 422;
//     uint256 internal constant REVOKE_SENDER_NOT_ADMIN = 423;
//     uint256 internal constant RENOUNCE_SENDER_NOT_ALLOWED = 424;
//     uint256 internal constant BUFFER_PERIOD_EXPIRED = 425;

//     // Vault
//     uint256 internal constant INVALID_POOL_ID = 500;
//     uint256 internal constant CALLER_NOT_POOL = 501;
//     uint256 internal constant SENDER_NOT_ASSET_MANAGER = 502;
//     uint256 internal constant USER_DOESNT_ALLOW_RELAYER = 503;
//     uint256 internal constant INVALID_SIGNATURE = 504;
//     uint256 internal constant EXIT_BELOW_MIN = 505;
//     uint256 internal constant JOIN_ABOVE_MAX = 506;
//     uint256 internal constant SWAP_LIMIT = 507;
//     uint256 internal constant SWAP_DEADLINE = 508;
//     uint256 internal constant CANNOT_SWAP_SAME_TOKEN = 509;
//     uint256 internal constant UNKNOWN_AMOUNT_IN_FIRST_SWAP = 510;
//     uint256 internal constant MALCONSTRUCTED_MULTIHOP_SWAP = 511;
//     uint256 internal constant INTERNAL_BALANCE_OVERFLOW = 512;
//     uint256 internal constant INSUFFICIENT_INTERNAL_BALANCE = 513;
//     uint256 internal constant INVALID_ETH_INTERNAL_BALANCE = 514;
//     uint256 internal constant INVALID_POST_LOAN_BALANCE = 515;
//     uint256 internal constant INSUFFICIENT_ETH = 516;
//     uint256 internal constant UNALLOCATED_ETH = 517;
//     uint256 internal constant ETH_TRANSFER = 518;
//     uint256 internal constant CANNOT_USE_ETH_SENTINEL = 519;
//     uint256 internal constant TOKENS_MISMATCH = 520;
//     uint256 internal constant TOKEN_NOT_REGISTERED = 521;
//     uint256 internal constant TOKEN_ALREADY_REGISTERED = 522;
//     uint256 internal constant TOKENS_ALREADY_SET = 523;
//     uint256 internal constant TOKENS_LENGTH_MUST_BE_2 = 524;
//     uint256 internal constant NONZERO_TOKEN_BALANCE = 525;
//     uint256 internal constant BALANCE_TOTAL_OVERFLOW = 526;
//     uint256 internal constant POOL_NO_TOKENS = 527;
//     uint256 internal constant INSUFFICIENT_FLASH_LOAN_BALANCE = 528;

//     // Fees
//     uint256 internal constant SWAP_FEE_PERCENTAGE_TOO_HIGH = 600;
//     uint256 internal constant FLASH_LOAN_FEE_PERCENTAGE_TOO_HIGH = 601;
//     uint256 internal constant INSUFFICIENT_FLASH_LOAN_FEE_AMOUNT = 602;
// }
