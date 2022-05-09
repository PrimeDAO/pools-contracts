pragma solidity ^0.8.0;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract BaseRewardPool {

    IERC20 public rewardToken;
    IERC20 public stakingToken;
    uint256 public constant DURATION = 7 days;

    address public operator;
    address public rewardManager;

    uint256 public pid;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public queuedRewards = 0;
    uint256 public currentRewards = 0;
    uint256 public historicalRewards = 0;
    uint256 public constant newRewardRatio = 830;
    uint256 private _totalSupply;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) private _balances;

    address[] public extraRewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(
        uint256 pid_,
        address stakingToken_,
        address rewardToken_,
        address operator_,
        address rewardManager_
    ) public {
        pid = pid_;
        stakingToken = IERC20(stakingToken_); //Staking token is d2dBal.
        rewardToken = IERC20(rewardToken_); // Rewards token is Bal.
        operator = operator_;
        rewardManager = rewardManager_;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function extraRewardsLength() external view returns (uint256) {
        return extraRewards.length;
    }

    function addExtraReward(address _reward) external returns (bool) {
        require(msg.sender == rewardManager, "!authorized");
        require(_reward != address(0), "!reward setting");

        extraRewards.push(_reward);
        return true;
    }

    function clearExtraRewards() external {
        require(msg.sender == rewardManager, "!authorized");
        delete extraRewards;
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

    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUtil.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) *
                rewardRate *
                1e18) / totalSupply());
    }

    function earned(address account) public view returns (uint256) {
        return
            (balanceOf(account) *
                (rewardPerToken() - userRewardPerTokenPaid[account])) /
            1e18 +
            rewards[account];
    }

    function stake(uint256 _amount)
        public
        updateReward(msg.sender)
        returns (bool)
    {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        //also stake to linked rewards
        for (uint256 i = 0; i < extraRewards.length; i++) {
            IRewards(extraRewards[i]).stake(msg.sender, _amount);
        }

        _totalSupply = _totalSupply + (_amount);
        _balances[msg.sender] = _balances[msg.sender] + (_amount);

        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);

        return true;
    }

    function stakeAll() external returns (bool) {
        uint256 balance = stakingToken.balanceOf(msg.sender);
        stake(balance);
        return true;
    }

    //here we are locking tokens
    function stakeFor(address _for, uint256 _amount)
        public
        updateReward(_for)
        returns (bool)
    {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        //also stake to linked rewards
        for (uint256 i = 0; i < extraRewards.length; i++) {
            IRewards(extraRewards[i]).stake(_for, _amount);
        }

        //give to _for
        _totalSupply = _totalSupply + (_amount);
        _balances[_for] = _balances[_for] + (_amount);

        //take away from sender
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(_for, _amount);

        return true;
    }

    function withdraw(uint256 amount, bool claim)
        public
        updateReward(msg.sender)
        returns (bool)
    {
        require(amount > 0, "RewardPool : Cannot withdraw 0");

        //also withdraw from linked rewards
        for (uint256 i = 0; i < extraRewards.length; i++) {
            IRewards(extraRewards[i]).withdraw(msg.sender, amount);
        }

        _totalSupply = _totalSupply - (amount);
        _balances[msg.sender] = _balances[msg.sender] - (amount); //(_balances created with mapping)

        stakingToken.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);

        if (claim) {
            getReward(msg.sender, true);
        }

        return true;
    }

    //It is possible to withdraw the whole amount of d2dBal.
    function withdrawAll() external {
        bool claim = true;
        withdraw(_balances[msg.sender], claim);
    }

    function withdrawAndUnwrap(uint256 amount, bool claim)
        public
        updateReward(msg.sender)
        returns (bool)
    {
        //also withdraw from linked rewards
        for (uint256 i = 0; i < extraRewards.length; i++) {
            IRewards(extraRewards[i]).withdraw(msg.sender, amount);
        }

        _totalSupply = _totalSupply - (amount);
        _balances[msg.sender] = _balances[msg.sender] - (amount);

        //tell operator to withdraw from here directly to user
        IDeposit(operator).withdrawTo(pid, amount, msg.sender);
        emit Withdrawn(msg.sender, amount);

        //get rewards too
        if (claim) {
            getReward(msg.sender, true);
        }
        return true;
    }

    function withdrawAllAndUnwrap(bool claim) external {
        withdrawAndUnwrap(_balances[msg.sender], claim);
    }

    function getReward(address _account, bool _claimExtras)
        public
        updateReward(_account)
        returns (bool)
    {
        uint256 reward = earned(_account);
        if (reward > 0) {
            rewards[_account] = 0;
            rewardToken.transfer(_account, reward);
            IDeposit(operator).rewardClaimed(pid, _account, reward);
            emit RewardPaid(_account, reward);
        }

        //also get rewards from linked rewards
        if (_claimExtras) {
            for (uint256 i = 0; i < extraRewards.length; i++) {
                IRewards(extraRewards[i]).getReward(_account);
            }
        }
        return true;
    }

    function getReward() external returns (bool) {
        getReward(msg.sender, true);
        return true;
    }

    function donate(uint256 _amount) external returns (bool) {
        IERC20(rewardToken).transferFrom(msg.sender, address(this), _amount);
        queuedRewards = queuedRewards + _amount;
    }

    function queueNewRewards(uint256 _rewards) external returns (bool) {
        require(msg.sender == operator, "!authorized");

        _rewards = _rewards + queuedRewards;

        if (block.timestamp >= periodFinish) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
            return true;
        }

        //et = now - (finish-DURATION)
        uint256 elapsedTime = block.timestamp - (periodFinish - DURATION);
        //current at now: rewardRate * elapsedTime
        uint256 currentAtNow = rewardRate * elapsedTime;
        uint256 queuedRatio = (currentAtNow * 1000) / _rewards;

        //uint256 queuedRatio = currentRewards.mul(1000).div(_rewards);
        if (queuedRatio < newRewardRatio) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
        } else {
            queuedRewards = _rewards;
        }
        return true;
    }

    function notifyRewardAmount(uint256 reward)
        internal
        updateReward(address(0))
    {
        historicalRewards = historicalRewards + reward;
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / DURATION;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            reward = reward + leftover;
            rewardRate = reward / DURATION;
        }
        currentRewards = reward;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + DURATION;
        emit RewardAdded(reward);
    }
}
