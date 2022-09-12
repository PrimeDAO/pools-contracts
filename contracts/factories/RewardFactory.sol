// SPDX-License-Identifier: MIT

/*
 * MIT License
 *
 * Copyright (c) 2021 convex-eth
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

pragma solidity 0.8.16;

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
