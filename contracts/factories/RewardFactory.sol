// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "../utils/Interfaces.sol";
import "../BaseRewardPool.sol";
import "../VirtualBalanceRewardPool.sol";
import "../utils/MathUtil.sol";

/// @title RewardFactory contract
contract RewardFactory is IRewardFactory {
    using MathUtil for uint256;

    event StashAccessGranted(address stash);
    event BaseRewardPoolCreated(address poolAddress);
    event VirtualBalanceRewardPoolCreated(address baseRewardPool, address poolAddress, address token);

    error Unauthorized();

    address public immutable bal;
    address public immutable operator;

    mapping(address => bool) private rewardAccess;

    constructor(address _operator, address _bal) {
        operator = _operator;
        bal = _bal;
    }

    /// @notice Grants rewardAccess to stash
    /// @dev Stash contracts need access to create new Virtual balance pools for extra gauge incentives(ex. snx)
    function grantRewardStashAccess(address _stash) external {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        rewardAccess[_stash] = true;
        emit StashAccessGranted(_stash);
    }

    //Create a Managed Reward Pool to handle distribution of all bal mined in a pool
    /// @notice Creates a new Reward pool
    /// @param _pid The pid of the pool
    /// @param _depositToken address of the token
    function createBalRewards(uint256 _pid, address _depositToken) external returns (address) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }

        BaseRewardPool rewardPool = new BaseRewardPool(_pid, _depositToken, bal, msg.sender, address(this));
        emit BaseRewardPoolCreated(address(rewardPool));

        return address(rewardPool);
    }

    /// @notice Create a virtual balance reward pool that mimicks the balance of a pool's main reward contract
    /// @dev used for extra incentive tokens(ex. snx) as well as vebal fees
    /// @param _token address of the token
    /// @param _mainRewards address of the main reward pool contract
    /// @param _rewardPoolOwner address of the reward pool owner
    /// @return address of the new reward pool
    function createTokenRewards(
        address _token,
        address _mainRewards,
        address _rewardPoolOwner
    ) external returns (address) {
        if (msg.sender != operator && !rewardAccess[msg.sender]) {
            revert Unauthorized();
        }

        // create new pool, use main pool for balance lookup
        VirtualBalanceRewardPool rewardPool = new VirtualBalanceRewardPool(_mainRewards, _token, _rewardPoolOwner);
        emit VirtualBalanceRewardPoolCreated(_mainRewards, address(rewardPool), _token);

        address rAddress = address(rewardPool);
        // add the new pool to main pool's list of extra rewards, assuming this factory has "reward manager" role
        IRewards(_mainRewards).addExtraReward(rAddress);
        return rAddress;
    }
}
