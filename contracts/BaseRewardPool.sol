// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Base Reward Pool contract
/// @dev Rewards contract for Prime Pools is based on the convex contract
contract BaseRewardPool is IBaseRewardsPool {
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    error Unauthorized();
    error InvalidAmount();

    uint256 public constant DURATION = 7 days;
    uint256 public constant NEW_REWARD_RATIO = 830;

    // Rewards token is Bal
    IERC20 public immutable rewardToken;
    IERC20 public immutable stakingToken;

    // Operator is Controller smart contract
    address public immutable operator;
    address public immutable rewardManager;

    uint256 public pid;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public queuedRewards;
    uint256 public currentRewards;
    uint256 public historicalRewards;
    uint256 private _totalSupply;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) private _balances;

    address[] public extraRewards;

    constructor(
        uint256 pid_,
        address stakingToken_,
        address rewardToken_,
        address operator_,
        address rewardManager_
    ) {
        pid = pid_;
        stakingToken = IERC20(stakingToken_);
        rewardToken = IERC20(rewardToken_);
        operator = operator_;
        rewardManager = rewardManager_;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyAddress(address authorizedAddress) {
        if (msg.sender != authorizedAddress) {
            revert Unauthorized();
        }
        _;
    }

    /// @notice Returns total supply
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /// @notice Get the specified address' balance
    /// @param account The address of the token holder
    /// @return The `account`'s balance
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    /// @notice Returns number of extra rewards
    function extraRewardsLength() external view returns (uint256) {
        return extraRewards.length;
    }

    /// @notice Adds an extra reward
    /// @dev only `rewardManager` can add extra rewards
    /// @param _reward token address of the reward
    function addExtraReward(address _reward) external onlyAddress(rewardManager) {
        require(_reward != address(0), "!reward setting");
        extraRewards.push(_reward);
    }

    /// @notice Returns last time reward applicable
    /// @return The lower value of current block.timestamp or last time reward applicable
    function lastTimeRewardApplicable() public view returns (uint256) {
        // solhint-disable-next-line
        return MathUtil.min(block.timestamp, periodFinish);
    }

    /// @notice Returns rewards per token staked
    /// @return The rewards per token staked
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalSupply());
    }

    /// @notice Returns the `account`'s earned rewards
    /// @param account The address of the token holder
    /// @return The `account`'s earned rewards
    function earned(address account) public view returns (uint256) {
        return (balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    /// @notice Stakes all BAL tokens
    function stakeAll() external {
        uint256 balance = stakingToken.balanceOf(msg.sender);
        stake(balance);
    }

    /// @notice Stakes `amount` tokens for `_for`
    /// @param _for Who are we staking for
    /// @param _amount The amount of tokens user wants to stake
    function stakeFor(address _for, uint256 _amount) public updateReward(_for) {
        if (_amount < 1) {
            revert InvalidAmount();
        }

        stakeToExtraRewards(_for, _amount);

        _totalSupply = _totalSupply + (_amount);
        // update _for balances
        _balances[_for] = _balances[_for] + (_amount);
        // take away from sender
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(_for, _amount);
    }

    /// @notice Stakes `amount` tokens
    /// @param _amount The amount of tokens user wants to stake
    function stake(uint256 _amount) public {
        stakeFor(msg.sender, _amount);
    }

    /// @notice Unstakes `amount` tokens
    /// @param _amount The amount of tokens that the user wants to withdraw
    /// @param _claim Whether or not the user wants to claim their rewards
    function withdraw(uint256 _amount, bool _claim) public updateReward(msg.sender) {
        if (_amount < 1) {
            revert InvalidAmount();
        }

        // withdraw from linked rewards
        withdrawExtraRewards(msg.sender, _amount);

        _totalSupply = _totalSupply - (_amount);
        _balances[msg.sender] = _balances[msg.sender] - (_amount);

        // return staked tokens to sender
        stakingToken.transfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);

        // claim staking rewards
        if (_claim) {
            getReward(msg.sender, true);
        }
    }

    /// @notice Withdraw all tokens
    function withdrawAll(bool _claim) external {
        withdraw(_balances[msg.sender], _claim);
    }

    /// @notice Withdraw `amount` tokens and unwrap
    /// @param _amount The amount of tokens that the user wants to withdraw
    /// @param _claim Whether or not the user wants to claim their rewards
    function withdrawAndUnwrap(uint256 _amount, bool _claim) public updateReward(msg.sender) {
        if (_amount < 1) {
            revert InvalidAmount();
        }

        withdrawExtraRewards(msg.sender, _amount);

        _totalSupply = _totalSupply - (_amount);
        _balances[msg.sender] = _balances[msg.sender] - (_amount);

        // tell operator to withdraw from here directly to user
        IController(operator).withdrawTo(pid, _amount, msg.sender);
        emit Withdrawn(msg.sender, _amount);

        //get rewards too
        if (_claim) {
            getReward(msg.sender, true);
        }
    }

    /// @notice Withdraw all tokens and unwrap
    /// @param _claim Whether or not the user wants to claim their rewards
    function withdrawAllAndUnwrap(bool _claim) external {
        withdrawAndUnwrap(_balances[msg.sender], _claim);
    }

    /// @notice Claims Rewards for `_account`
    /// @param _account The account to claim rewards for
    /// @param _claimExtras Whether or not the user wants to claim extra rewards
    function getReward(address _account, bool _claimExtras) public updateReward(_account) {
        uint256 reward = earned(_account);
        if (reward > 0) {
            rewards[_account] = 0;
            rewardToken.transfer(_account, reward);
            emit RewardPaid(_account, reward);
        }

        // also get rewards from linked rewards
        if (_claimExtras) {
            address[] memory extraRewardsMemory = extraRewards;
            for (uint256 i = 0; i < extraRewardsMemory.length; i = unsafeInc(i)) {
                IRewards(extraRewardsMemory[i]).getReward(_account);
            }
        }
    }

    /// @notice Claims Reward for signer
    function getReward() external {
        getReward(msg.sender, true);
    }

    /// @notice Donates reward token to this contract
    /// @param _amount The amount of tokens to donate
    function donate(uint256 _amount) external {
        IERC20(rewardToken).transferFrom(msg.sender, address(this), _amount);
        queuedRewards = queuedRewards + _amount;
    }

    /// @notice Queue new rewards
    /// @dev Only the operator can queue new rewards
    /// @param _rewards The amount of tokens to queue
    function queueNewRewards(uint256 _rewards) external onlyAddress(operator) {
        _rewards = _rewards + queuedRewards;

        // solhint-disable-next-line
        if (block.timestamp >= periodFinish) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
            return;
        }

        // solhint-disable-next-line
        uint256 elapsedTime = block.timestamp - (periodFinish - DURATION);
        uint256 currentAtNow = rewardRate * elapsedTime;
        uint256 queuedRatio = (currentAtNow * 1000) / _rewards;

        if (queuedRatio < NEW_REWARD_RATIO) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
        } else {
            queuedRewards = _rewards;
        }
    }

    /// @dev Gas optimization for loops that iterate over extra rewards
    /// We know that this can't overflow because we can't interate over big arrays
    function unsafeInc(uint256 x) internal pure returns (uint256) {
        unchecked {
            return x + 1;
        }
    }

    /// @dev Stakes `amount` tokens for address `for` to extra rewards tokens
    /// RewardManager `rewardManager` is responsible for adding reward tokens
    /// @param _for Who are we staking for
    /// @param _amount The amount of tokens user wants to stake
    function stakeToExtraRewards(address _for, uint256 _amount) internal {
        address[] memory extraRewardsMemory = extraRewards;
        for (uint256 i = 0; i < extraRewardsMemory.length; i = unsafeInc(i)) {
            IRewards(extraRewardsMemory[i]).stake(_for, _amount);
        }
    }

    /// @dev Stakes `amount` tokens for address `for` to extra rewards tokens
    /// RewardManager `rewardManager` is responsible for adding reward tokens
    /// @param _for Who are we staking for
    /// @param _amount The amount of tokens user wants to stake
    function withdrawExtraRewards(address _for, uint256 _amount) internal {
        address[] memory extraRewardsMemory = extraRewards;
        for (uint256 i = 0; i < extraRewardsMemory.length; i = unsafeInc(i)) {
            IRewards(extraRewardsMemory[i]).withdraw(_for, _amount);
        }
    }

    function notifyRewardAmount(uint256 reward) internal updateReward(address(0)) {
        historicalRewards = historicalRewards + reward;
        // solhint-disable-next-line
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / DURATION;
        } else {
            // solhint-disable-next-line
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            reward = reward + leftover;
            rewardRate = reward / DURATION;
        }
        currentRewards = reward;
        // solhint-disable-next-line
        lastUpdateTime = block.timestamp;
        // solhint-disable-next-line
        periodFinish = block.timestamp + DURATION;
        emit RewardAdded(reward);
    }
}
