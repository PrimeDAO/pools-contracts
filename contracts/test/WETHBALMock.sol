// //from 0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56

// // solium-disable linebreak-style
// pragma solidity 0.8.13;

// // import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// // import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

// import "./IVault.sol";
// import "./BalancerPoolToken.sol";
// import "./BalancerErrors.sol";

// contract WETHBALMock is IMinimalSwapInfoPool, IPriceOracle, BasePoolAuthorization, BalancerPoolToken, TemporarilyPausable, PoolPriceOracle {

//     mapping(address => uint256) private _balances;
//     mapping(address => mapping(address => uint256)) private _allowances;

//     uint256 private constant _MINIMUM_BPT = 1e6;

//     // 1e18 corresponds to 1.0, or a 100% fee
//     uint256 private constant _MIN_SWAP_FEE_PERCENTAGE = 1e12; // 0.0001%
//     uint256 private constant _MAX_SWAP_FEE_PERCENTAGE = 1e17; // 10%
//     // The swap fee is internally stored using 64 bits, which is enough to represent _MAX_SWAP_FEE_PERCENTAGE.

//     bytes32 internal _miscData;
//     uint256 private _lastInvariant;

//     IVault private  _vault;
//     // IERC20 private  _vault;

//     bytes32 private  _poolId;

//     IERC20 internal  _token0;
//     IERC20 internal  _token1;

//     uint256 private  _normalizedWeight0;
//     uint256 private  _normalizedWeight1;

//     // The protocol fees will always be charged using the token associated with the max weight in the pool.
//     // Since these Pools will register tokens only once, we can assume this index will be constant.
//     uint256 private  _maxWeightTokenIndex;

//     // All token balances are normalized to behave as if the token had 18 decimals. We assume a token's decimals will
//     // not change throughout its lifetime, and store the corresponding scaling factor for each at construction time.
//     // These factors are always greater than or equal to one: tokens with more than 18 decimals are not supported.
//     uint256 internal  _scalingFactor0;
//     uint256 internal  _scalingFactor1;

//     bool private _paused;
//     uint256 internal constant _MIN_WEIGHT = 0.01e18;
//     uint256 internal constant ONE = 1e18; // 18 decimal places


//     address private immutable _owner;
//     address private constant _DELEGATE_OWNER = 0xBA1BA1ba1BA1bA1bA1Ba1BA1ba1BA1bA1ba1ba1B;

//     event OracleEnabledChanged(bool enabled);
//     event SwapFeePercentageChanged(uint256 swapFeePercentage);
//     // event PausedStateChanged(bool paused);

//     struct NewPoolParams {
//         IVault vault;
//         // IERC20 vault;
//         string name;
//         string symbol;
//         IERC20 token0;
//         IERC20 token1;
//         uint256 normalizedWeight0;
//         uint256 normalizedWeight1;
//         uint256 swapFeePercentage;
//         uint256 pauseWindowDuration;
//         uint256 bufferPeriodDuration;
//         bool oracleEnabled;
//         address owner;
//     }

//     struct OracleAverageQuery {
//         Variable variable;
//         uint256 secs;
//         uint256 ago;
//     }

//     struct OracleAccumulatorQuery {
//         Variable variable;
//         uint256 ago;
//     }


//     constructor(NewPoolParams memory params)
//         // Base Pools are expected to be deployed using factories. By using the factory address as the action
//         // disambiguator, we make all Pools deployed by the same factory share action identifiers. This allows for
//         // simpler management of permissions (such as being able to manage granting the 'set fee percentage' action in
//         // any Pool created by the same factory), while still making action identifiers unique among different factories
//         // if the selectors match, preventing accidental errors.
//         Authentication(bytes32(uint256(uint160(address(msg.sender)))))
//         BalancerPoolToken(params.name, params.symbol)
//         BasePoolAuthorization(params.owner)
//         TemporarilyPausable(params.pauseWindowDuration, params.bufferPeriodDuration)
//     {
//         _owner = msg.sender;
//         _setOracleEnabled(params.oracleEnabled);
//         _setSwapFeePercentage(params.swapFeePercentage);

//         bytes32 poolId = params.vault.registerPool(IVault.PoolSpecialization.TWO_TOKEN);

//         // Pass in zero addresses for Asset Managers
//         IERC20[] memory tokens = new IERC20[](2);
//         tokens[0] = params.token0;
//         tokens[1] = params.token1;
//         params.vault.registerTokens(poolId, tokens, new address[](2));

//         // Set immutable state variables - these cannot be read from during construction
//         _vault = params.vault;
//         _poolId = poolId;

//         _token0 = params.token0;
//         _token1 = params.token1;

//         _scalingFactor0 = _computeScalingFactor(params.token0);
//         _scalingFactor1 = _computeScalingFactor(params.token1);

//         // Ensure each normalized weight is above them minimum and find the token index of the maximum weight
//         _require(params.normalizedWeight0 >= _MIN_WEIGHT, Errors.MIN_WEIGHT);
//         _require(params.normalizedWeight1 >= _MIN_WEIGHT, Errors.MIN_WEIGHT);

//         // Ensure that the normalized weights sum to ONE
//         uint256 normalizedSum = params.normalizedWeight0 + params.normalizedWeight1;
//         _require(normalizedSum == ONE, Errors.NORMALIZED_WEIGHT_INVARIANT);

//         _normalizedWeight0 = params.normalizedWeight0;
//         _normalizedWeight1 = params.normalizedWeight1;
//         _maxWeightTokenIndex = params.normalizedWeight0 >= params.normalizedWeight1 ? 0 : 1;
//     }


//     modifier onlyVault(bytes32 poolId) {
//         _require(msg.sender == address(getVault()), Errors.CALLER_NOT_VAULT);
//         _require(poolId == getPoolId(), Errors.INVALID_POOL_ID);
//         _;
//     }

//     enum Variable { PAIR_PRICE, BPT_PRICE, INVARIANT }

//     // Getters / Setters

//     function getVault() public view returns (IVault) {
//         return _vault;
//     }

//     function getPoolId() public view returns (bytes32) {
//         return _poolId;
//     }

//     function getMiscData()
//         external
//         view
//         returns (
//             int256 logInvariant,
//             int256 logTotalSupply,
//             uint256 oracleSampleCreationTimestamp,
//             uint256 oracleIndex,
//             bool oracleEnabled,
//             uint256 swapFeePercentage
//         )
//     {
//         bytes32 miscData = _miscData;
//         logInvariant = 1;
//         logTotalSupply = 1;
//         oracleSampleCreationTimestamp = 1;
//         oracleIndex = 1;
//         oracleEnabled = true;
//         swapFeePercentage = 1;
//     }

//     function getSwapFeePercentage() public view returns (uint256) {
//         return 1;
//     }

//     // Caller must be approved by the Vault's Authorizer
//     function setSwapFeePercentage(uint256 swapFeePercentage) external virtual authenticate whenNotPaused {
//         _setSwapFeePercentage(swapFeePercentage);
//     }

//     function _setSwapFeePercentage(uint256 swapFeePercentage) private {
//         emit SwapFeePercentageChanged(swapFeePercentage);
//     }

//   /**
//      * @dev Balancer Governance can always enable the Oracle, even if it was originally not enabled. This allows for
//      * Pools that unexpectedly drive much more volume and liquidity than expected to serve as Price Oracles.
//      *
//      * Note that the Oracle can only be enabled - it can never be disabled.
//      */
//     function enableOracle() external whenNotPaused authenticate {
//         _setOracleEnabled(true);

//         // Cache log invariant and supply only if the pool was initialized
//         if (totalSupply() > 0) {
//             _cacheInvariantAndSupply();
//         }
//     }

//     function _setOracleEnabled(bool enabled) internal {
//         emit OracleEnabledChanged(enabled);
//     }

//     // Caller must be approved by the Vault's Authorizer
//     function setPaused(bool paused) external authenticate {
//         _setPaused(paused);
//     }

//     function getNormalizedWeights() external view returns (uint256[] memory) {
//         return _normalizedWeights();
//     }

//     function _normalizedWeights() internal view virtual returns (uint256[] memory) {
//         uint256[] memory normalizedWeights = new uint256[](2);
//         normalizedWeights[0] = _normalizedWeights(true);
//         normalizedWeights[1] = _normalizedWeights(false);
//         return normalizedWeights;
//     }

//     function _normalizedWeights(bool token0) internal view virtual returns (uint256) {
//         return token0 ? _normalizedWeight0 : _normalizedWeight1;
//     }

//     function getLastInvariant() external view returns (uint256) {
//         return _lastInvariant;
//     }


//     function _calculateInvariant(uint256[] memory normalizedWeights, uint256[] memory balances)
//         internal
//         pure
//         returns (uint256 invariant)
//     {    }

//     /**
//      * @dev Returns the current value of the invariant.
//      */
//     function getInvariant() public view returns (uint256) {
//         return 1;
//     }

//     function onSwap(
//         SwapRequest memory request,
//         uint256 balanceTokenIn,
//         uint256 balanceTokenOut
//     ) external virtual  whenNotPaused onlyVault(request.poolId) returns (uint256) {
//         return 1;
//     }


//     enum JoinKind { INIT, EXACT_TOKENS_IN_FOR_BPT_OUT, TOKEN_IN_FOR_EXACT_BPT_OUT }
//     enum ExitKind { EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, EXACT_BPT_IN_FOR_TOKENS_OUT, BPT_IN_FOR_EXACT_TOKENS_OUT }

//     function joinKind(bytes memory self) internal pure returns (JoinKind) {
//         return abi.decode(self, (JoinKind));
//     }

//     function exitKind(bytes memory self) internal pure returns (ExitKind) {
//         return abi.decode(self, (ExitKind));
//     }

//     function initialAmountsIn(bytes memory self) internal pure returns (uint256[] memory amountsIn) {
//         (, amountsIn) = abi.decode(self, (JoinKind, uint256[]));
//     }
//     /**
//      * @dev Called when the Pool is joined for the first time; that is, when the BPT total supply is zero.
//      *
//      * Returns the amount of BPT to mint, and the token amounts the Pool will receive in return.
//      *
//      * Minted BPT will be sent to `recipient`, except for _MINIMUM_BPT, which will be deducted from this amount and sent
//      * to the zero address instead. This will cause that BPT to remain forever locked there, preventing total BTP from
//      * ever dropping below that value, and ensuring `_onInitializePool` can only be called once in the entire Pool's
//      * lifetime.
//      *
//      * The tokens granted to the Pool will be transferred from `sender`. These amounts are considered upscaled and will
//      * be downscaled (rounding up) before being returned to the Vault.
//      */
//     function _onInitializePool(
//         bytes32,
//         address,
//         address,
//         bytes memory userData
//     ) private returns (uint256, uint256[] memory) {
//         JoinKind kind = joinKind(userData);
//         _require(kind == JoinKind.INIT, Errors.UNINITIALIZED);

//         uint256[] memory amountsIn = initialAmountsIn(userData);
//         // InputHelpers.ensureInputLengthMatch(amountsIn.length, 2);
//         _upscaleArray(amountsIn);

//         uint256[] memory normalizedWeights = _normalizedWeights();

//         uint256 invariantAfterJoin = _calculateInvariant(normalizedWeights, amountsIn);

//         // Set the initial BPT to the value of the invariant times the number of tokens. This makes BPT supply more
//         // consistent in Pools with similar compositions but different number of tokens.
//         uint256 bptAmountOut = invariantAfterJoin * 2;

//         _lastInvariant = invariantAfterJoin;

//         return (bptAmountOut, amountsIn);
//     }

//     /**
//      * @dev Called whenever the Pool is joined after the first initialization join (see `_onInitializePool`).
//      *
//      * Returns the amount of BPT to mint, the token amounts that the Pool will receive in return, and the number of
//      * tokens to pay in protocol swap fees.
//      *
//      * Implementations of this function might choose to mutate the `balances` array to save gas (e.g. when
//      * performing intermediate calculations, such as subtraction of due protocol fees). This can be done safely.
//      *
//      * Minted BPT will be sent to `recipient`.
//      *
//      * The tokens granted to the Pool will be transferred from `sender`. These amounts are considered upscaled and will
//      * be downscaled (rounding up) before being returned to the Vault.
//      *
//      * Due protocol swap fees will be taken from the Pool's balance in the Vault (see `IBasePool.onJoinPool`). These
//      * amounts are considered upscaled and will be downscaled (rounding down) before being returned to the Vault.
//      */
//     function _onJoinPool(
//         bytes32,
//         address,
//         address,
//         uint256[] memory balances,
//         uint256,
//         uint256 protocolSwapFeePercentage,
//         bytes memory userData
//     )
//         private
//         returns (
//             uint256,
//             uint256[] memory,
//             uint256[] memory
//         )
//     {
//         uint256[] memory normalizedWeights = _normalizedWeights();

//         // Due protocol swap fee amounts are computed by measuring the growth of the invariant between the previous join
//         // or exit event and now - the invariant's growth is due exclusively to swap fees. This avoids spending gas
//         // computing them on each individual swap
//         uint256 invariantBeforeJoin = _calculateInvariant(normalizedWeights, balances);

//         uint256[] memory dueProtocolFeeAmounts = _getDueProtocolFeeAmounts(
//             balances,
//             normalizedWeights,
//             _lastInvariant,
//             invariantBeforeJoin,
//             protocolSwapFeePercentage
//         );

//         (uint256 bptAmountOut, uint256[] memory amountsIn) = _doJoin(balances, normalizedWeights, userData);

//         return (bptAmountOut, amountsIn, dueProtocolFeeAmounts);
//     }

//     function _doJoin(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         bytes memory userData
//     ) private view returns (uint256, uint256[] memory) {
//         JoinKind kind = joinKind(userData);
        
//         if (kind == JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT) {
//             return _joinExactTokensInForBPTOut(balances, normalizedWeights, userData);
//         } else if (kind == JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT) {
//             return _joinTokenInForExactBPTOut(balances, normalizedWeights, userData);
//         } else {
//             _revert(Errors.UNHANDLED_JOIN_KIND);
//         }
//     }

//     function exactTokensInForBptOut(bytes memory self)
//         internal
//         pure
//         returns (uint256[] memory amountsIn, uint256 minBPTAmountOut)
//     {
//         (, amountsIn, minBPTAmountOut) = abi.decode(self, (JoinKind, uint256[], uint256));
//     }

//     function _joinExactTokensInForBPTOut(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         bytes memory userData
//     ) private view returns (uint256, uint256[] memory) {
//         (uint256[] memory amountsIn, uint256 minBPTAmountOut) = exactTokensInForBptOut(userData);
//         // InputHelpers.ensureInputLengthMatch(amountsIn.length, 2);

//         _upscaleArray(amountsIn);

//         uint256 bptAmountOut = _calcBptOutGivenExactTokensIn(
//             balances,
//             normalizedWeights,
//             amountsIn,
//             totalSupply(),
//             getSwapFeePercentage()
//         );

//         _require(bptAmountOut >= minBPTAmountOut, Errors.BPT_OUT_MIN_AMOUNT);

//         return (bptAmountOut, amountsIn);
//     }
    
//     function _calcBptOutGivenExactTokensIn(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         uint256[] memory amountsIn,
//         uint256 bptTotalSupply,
//         uint256 swapFee
//     ) internal pure returns (uint256) {
//         return 1;
//     }

//     function tokenInForExactBptOut(bytes memory self) internal pure returns (uint256 bptAmountOut, uint256 tokenIndex) {
//         (, bptAmountOut, tokenIndex) = abi.decode(self, (JoinKind, uint256, uint256));
//     }

//     function _joinTokenInForExactBPTOut(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         bytes memory userData
//     ) private view returns (uint256, uint256[] memory) {
//         (uint256 bptAmountOut, uint256 tokenIndex) = tokenInForExactBptOut(userData);
//         // Note that there is no maximum amountIn parameter: this is handled by `IVault.joinPool`.

//         _require(tokenIndex < 2, Errors.OUT_OF_BOUNDS);

//         uint256[] memory amountsIn = new uint256[](2);
//         amountsIn[tokenIndex] = _calcTokenInGivenExactBptOut(
//             balances[tokenIndex],
//             normalizedWeights[tokenIndex],
//             bptAmountOut,
//             totalSupply(),
//             getSwapFeePercentage()
//         );

//         return (bptAmountOut, amountsIn);
//     }

//     function _calcTokenInGivenExactBptOut(
//         uint256 balance,
//         uint256 normalizedWeight,
//         uint256 bptAmountOut,
//         uint256 bptTotalSupply,
//         uint256 swapFee
//     ) internal pure returns (uint256) {
//         return 1;
//     }

//     function _onExitPool(
//         bytes32,
//         address,
//         address,
//         uint256[] memory balances,
//         uint256 lastChangeBlock,
//         uint256 protocolSwapFeePercentage,
//         bytes memory userData
//     )
//         private
//         returns (
//             uint256 bptAmountIn,
//             uint256[] memory amountsOut,
//             uint256[] memory dueProtocolFeeAmounts
//         )
//     {
//         // Exits are not completely disabled while the contract is paused: proportional exits (exact BPT in for tokens
//         // out) remain functional.

//         uint256[] memory normalizedWeights = _normalizedWeights();

//         if (_isNotPaused()) {
//             // Update price oracle with the pre-exit balances
//             _updateOracle(lastChangeBlock, balances[0], balances[1]);

//             // Due protocol swap fee amounts are computed by measuring the growth of the invariant between the previous
//             // join or exit event and now - the invariant's growth is due exclusively to swap fees. This avoids
//             // spending gas calculating the fees on each individual swap.
//             uint256 invariantBeforeExit = _calculateInvariant(normalizedWeights, balances);
//             dueProtocolFeeAmounts = _getDueProtocolFeeAmounts(
//                 balances,
//                 normalizedWeights,
//                 _lastInvariant,
//                 invariantBeforeExit,
//                 protocolSwapFeePercentage
//             );

//         } else {
//             // If the contract is paused, swap protocol fee amounts are not charged and the oracle is not updated
//             // to avoid extra calculations and reduce the potential for errors.
//             dueProtocolFeeAmounts = new uint256[](2);
//         }

//         (bptAmountIn, amountsOut) = _doExit(balances, normalizedWeights, userData);
//         _lastInvariant = _calculateInvariant(normalizedWeights, balances);

//         return (bptAmountIn, amountsOut, dueProtocolFeeAmounts);
//     }

//     function _doExit(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         bytes memory userData
//     ) private view returns (uint256, uint256[] memory) {
//         ExitKind kind = exitKind(userData);

//         if (kind == ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT) {
//             return _exitExactBPTInForTokenOut(balances, normalizedWeights, userData);
//         } else if (kind == ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT) {
//             return _exitExactBPTInForTokensOut(balances, userData);
//         } else {
//             // ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
//             return _exitBPTInForExactTokensOut(balances, normalizedWeights, userData);
//         }
//     }

//     function exactBptInForTokenOut(bytes memory self) internal pure returns (uint256 bptAmountIn, uint256 tokenIndex) {
//         (, bptAmountIn, tokenIndex) = abi.decode(self, (ExitKind, uint256, uint256));
//     }

//     function _exitExactBPTInForTokenOut(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         bytes memory userData
//     ) private view whenNotPaused returns (uint256, uint256[] memory) {
//         // This exit function is disabled if the contract is paused.

//         (uint256 bptAmountIn, uint256 tokenIndex) = exactBptInForTokenOut(userData);
//         // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

//         _require(tokenIndex < 2, Errors.OUT_OF_BOUNDS);

//         // We exit in a single token, so we initialize amountsOut with zeros
//         uint256[] memory amountsOut = new uint256[](2);

//         // And then assign the result to the selected token
//         amountsOut[tokenIndex] = _calcTokenOutGivenExactBptIn(
//             balances[tokenIndex],
//             normalizedWeights[tokenIndex],
//             bptAmountIn,
//             totalSupply(),
//             getSwapFeePercentage()
//         );

//         return (bptAmountIn, amountsOut);
//     }

//     function _calcTokenOutGivenExactBptIn(
//         uint256 balance,
//         uint256 normalizedWeight,
//         uint256 bptAmountIn,
//         uint256 bptTotalSupply,
//         uint256 swapFee
//     ) internal pure returns (uint256) {
//         return 1;
//     }

//     function exactBptInForTokensOut(bytes memory self) internal pure returns (uint256 bptAmountIn) {
//         (, bptAmountIn) = abi.decode(self, (ExitKind, uint256));
//     }

//     function _exitExactBPTInForTokensOut(uint256[] memory balances, bytes memory userData)
//         private
//         view
//         returns (uint256, uint256[] memory)
//     {
//         // This exit function is the only one that is not disabled if the contract is paused: it remains unrestricted
//         // in an attempt to provide users with a mechanism to retrieve their tokens in case of an emergency.
//         // This particular exit function is the only one that remains available because it is the simplest one, and
//         // therefore the one with the lowest likelihood of errors.

//         uint256 bptAmountIn = exactBptInForTokensOut(userData);
//         // Note that there is no minimum amountOut parameter: this is handled by `IVault.exitPool`.

//         uint256[] memory amountsOut = _calcTokensOutGivenExactBptIn(balances, bptAmountIn, totalSupply());
//         return (bptAmountIn, amountsOut);
//     }

//     function _calcTokensOutGivenExactBptIn(
//         uint256[] memory balances,
//         uint256 bptAmountIn,
//         uint256 totalBPT
//     ) internal pure returns (uint256[] memory) {
//         uint256 bptRatio = bptAmountIn / totalBPT;

//         uint256[] memory amountsOut = new uint256[](balances.length);
//         for (uint256 i = 0; i < balances.length; i++) {
//             amountsOut[i] = balances[i]*bptRatio;
//         }

//         return amountsOut;
//     }

//     function bptInForExactTokensOut(bytes memory self)
//         internal
//         pure
//         returns (uint256[] memory amountsOut, uint256 maxBPTAmountIn)
//     {
//         (, amountsOut, maxBPTAmountIn) = abi.decode(self, (ExitKind, uint256[], uint256));
//     }

//     function _exitBPTInForExactTokensOut(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         bytes memory userData
//     ) private view whenNotPaused returns (uint256, uint256[] memory) {
//         // This exit function is disabled if the contract is paused.

//         (uint256[] memory amountsOut, uint256 maxBPTAmountIn) = bptInForExactTokensOut(userData);
//         _upscaleArray(amountsOut);

//         uint256 bptAmountIn = _calcBptInGivenExactTokensOut(
//             balances,
//             normalizedWeights,
//             amountsOut,
//             totalSupply(),
//             getSwapFeePercentage()
//         );
//         _require(bptAmountIn <= maxBPTAmountIn, Errors.BPT_IN_MAX_AMOUNT);

//         return (bptAmountIn, amountsOut);
//     }

//     function _calcBptInGivenExactTokensOut(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         uint256[] memory amountsOut,
//         uint256 bptTotalSupply,
//         uint256 swapFee
//     ) internal pure returns (uint256) {
//         return 1;
//     }

//     // Oracle functions

//     function getLargestSafeQueryWindow() external pure returns (uint256) {
//         return 34 hours;
//     }

//     function getLatest(Variable variable) external view returns (uint256) {
//         int256 instantValue = 1;
//         return _fromLowResLog(instantValue);
//     }

//     function _getInstantValue(IPriceOracle.Variable variable, uint256 index) internal view returns (int256) {
//         return 1;
//     }

//     function getTimeWeightedAverage(OracleAverageQuery[] memory queries)
//         external
//         view
//         returns (uint256[] memory results)
//     {
//         results = new uint256[](queries.length);
//     }

//     function _getPastAccumulator(
//         IPriceOracle.Variable variable,
//         uint256 latestIndex,
//         uint256 ago
//     ) internal view returns (int256) {
//         return 1;
//     }

//     function _fromLowResLog(int256 value) internal pure returns (uint256) {
//         return 1;
//     }

//     function getPastAccumulators(OracleAccumulatorQuery[] memory queries)
//         external
//         view
//         returns (int256[] memory results)
//     {
//         results = new int256[](queries.length);
//     }

//     function _updateOracle(
//         uint256 lastChangeBlock,
//         uint256 balanceToken0,
//         uint256 balanceToken1
//     ) internal {
//     }

//     function _cacheInvariantAndSupply() internal {
//         bytes32 miscData = _miscData;
//     }

//     function _toLowResLog(uint256 value) internal pure returns (int256) {
//         return 1;
//     }

//     // Query functions

//     function queryJoin(
//         bytes32 poolId,
//         address sender,
//         address recipient,
//         uint256[] memory balances,
//         uint256 lastChangeBlock,
//         uint256 protocolSwapFeePercentage,
//         bytes memory userData
//     ) external returns (uint256 bptOut, uint256[] memory amountsIn) {
//         return (bptOut, amountsIn);
//     }

//     function queryExit(
//         bytes32 poolId,
//         address sender,
//         address recipient,
//         uint256[] memory balances,
//         uint256 lastChangeBlock,
//         uint256 protocolSwapFeePercentage,
//         bytes memory userData
//     ) external returns (uint256 bptIn, uint256[] memory amountsOut) {
//         return (bptIn, amountsOut);
//     }

//     // Helpers

//     function _getDueProtocolFeeAmounts(
//         uint256[] memory balances,
//         uint256[] memory normalizedWeights,
//         uint256 previousInvariant,
//         uint256 currentInvariant,
//         uint256 protocolSwapFeePercentage
//     ) private view returns (uint256[] memory) {
//         // Initialize with zeros
//         uint256[] memory dueProtocolFeeAmounts = new uint256[](2);

//         // Early return if the protocol swap fee percentage is zero, saving gas.
//         if (protocolSwapFeePercentage == 0) {
//             return dueProtocolFeeAmounts;
//         }

//         // The protocol swap fees are always paid using the token with the largest weight in the Pool. As this is the
//         // token that is expected to have the largest balance, using it to pay fees should not unbalance the Pool.
//         dueProtocolFeeAmounts[_maxWeightTokenIndex] = _calcDueTokenProtocolSwapFeeAmount(
//             balances[_maxWeightTokenIndex],
//             normalizedWeights[_maxWeightTokenIndex],
//             previousInvariant,
//             currentInvariant,
//             protocolSwapFeePercentage
//         );

//         return dueProtocolFeeAmounts;
//     }

//     function _calcDueTokenProtocolSwapFeeAmount(
//         uint256 balance,
//         uint256 normalizedWeight,
//         uint256 previousInvariant,
//         uint256 currentInvariant,
//         uint256 protocolSwapFeePercentage
//     ) internal pure returns (uint256) {
//         return 1;
//     }

//     function _mutateAmounts(
//         uint256[] memory toMutate,
//         uint256[] memory arguments,
//         function(uint256, uint256) pure returns (uint256) mutation
//     ) private pure {
//         toMutate[0] = mutation(toMutate[0], arguments[0]);
//         toMutate[1] = mutation(toMutate[1], arguments[1]);
//     }

//     function getRate() public view returns (uint256) {
//         return 2;
//     }

//     // Scaling

//     function _computeScalingFactor(IERC20 token) private view returns (uint256) {
//         // Tokens that don't implement the `decimals` method are not supported.
//         uint256 tokenDecimals = ERC20(address(token)).decimals();

//         // Tokens with more than 18 decimals are not supported.
//         uint256 decimalsDifference = 18 - tokenDecimals;
//         return 10**decimalsDifference;
//     }

//     function _scalingFactor(bool token0) internal view returns (uint256) {
//         return token0 ? _scalingFactor0 : _scalingFactor1;
//     }

//     function _upscale(uint256 amount, uint256 scalingFactor) internal pure returns (uint256) {
//         return amount * scalingFactor;
//     }

//     function _upscaleArray(uint256[] memory amounts) internal view {
//         amounts[0] = amounts[0] * _scalingFactor(true);
//         amounts[1] = amounts[1] * _scalingFactor(false);
//     }

//     function _downscaleDown(uint256 amount, uint256 scalingFactor) internal pure returns (uint256) {
//         return 2;
//     }

//     function _downscaleDownArray(uint256[] memory amounts) internal view {
//         amounts[0] = 2;
//         amounts[1] = 2;
//     }

//     function _downscaleUp(uint256 amount, uint256 scalingFactor) internal pure returns (uint256) {
//         return 3;
//     }

//     function _downscaleUpArray(uint256[] memory amounts) internal view {
//         amounts[0] = 3;
//         amounts[1] = 3;
//     }

//     function _queryAction() private { }
// }
