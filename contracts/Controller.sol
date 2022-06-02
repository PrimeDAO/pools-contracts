// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/// @title Controller contract
/// @dev Controller contract for Prime Pools is based on the convex Booster.sol contract
contract Controller {
    using Address for address;

    address public immutable bal;
    address public immutable wethBal;
    address public constant registry =
        address(0x0000000022D53366457F9d5E68Ec105046FC4383); //Note: Did not change this
    uint256 public constant distributionAddressId = 4;
    address public constant voteOwnership =
        address(0xE478de485ad2fe566d49342Cbd03E49ed7DB3356); //Note: Did not change this
    address public constant voteParameter =
        address(0xBCfF8B0b9419b9A88c44546519b1e909cF330399); //Note: Did not change this

    uint256 public profitFees = 250; //2.5% // FEE_DENOMINATOR/100*2.5
    uint256 public platformFees = 1000; //10% //possible fee to build treasury
    uint256 public constant MaxFees = 2000;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant lockTime = 365 days; // 1 year is the time for the new deposided tokens to be locked until they can be withdrawn

    address public owner;
    address public feeManager;
    address public poolManager;
    address public immutable staker;
    address public rewardFactory;
    address public stashFactory;
    address public tokenFactory;
    address public rewardArbitrator;
    address public voteDelegate;
    address public treasury;
    address public stakerRewards; //bal rewards
    address public lockRewards;
    address public lockFees;
    address public feeDistro;
    address public feeToken;

    bool public isShutdown;

    struct PoolInfo {
        address lptoken;
        address token;
        address gauge;
        address balRewards;
        address stash;
        bool shutdown;
    }

    //index(pid) -> pool
    PoolInfo[] public poolInfo;
    mapping(address => bool) public gaugeMap;

    event Deposited(
        address indexed user,
        uint256 indexed poolid,
        uint256 amount
    );

    event Withdrawn(
        address indexed user,
        uint256 indexed poolid,
        uint256 amount
    );

    constructor(
        address _staker,
        address _feeManager,
        address _wethBal,
        address _bal
    ) public {
        isShutdown = false;
        wethBal = _wethBal;
        bal = _bal;
        staker = _staker;
        owner = msg.sender;
        voteDelegate = msg.sender;
        feeManager = _feeManager;
        poolManager = msg.sender;
        feeDistro = address(0);
        feeToken = address(0);
        treasury = address(0);
    }

    /// SETTER SECTION ///

    /// @notice sets the owner variable
    /// @param _owner The address of the owner of the contract
    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    /// @notice sets the feeManager variable
    /// @param _feeM The address of the fee manager
    function setFeeManager(address _feeM) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeM;
    }

    /// @notice sets the poolManager variable
    /// @param _poolM The address of the pool manager
    function setPoolManager(address _poolM) external {
        require(msg.sender == poolManager, "!auth");
        poolManager = _poolM;
    }

    /// @notice sets the reward, token, and stash factory addresses
    /// @param _rfactory The address of the reward factory
    /// @param _sfactory The address of the stash factory
    /// @param _tfactory The address of the token factory
    function setFactories(
        address _rfactory,
        address _sfactory,
        address _tfactory
    ) external {
        require(msg.sender == owner, "!auth");

        //reward factory only allow this to be called once even if owner
        //removes ability to inject malicious staking contracts
        //token factory can also be immutable
        if (rewardFactory == address(0)) {
            rewardFactory = _rfactory;
            tokenFactory = _tfactory;
        }

        //stash factory should be considered more safe to change
        //updating may be required to handle new types of gauges
        stashFactory = _sfactory;
    }

    /// @notice sets the rewardArbitrator variable
    /// @param _arb The address of the reward arbitrator
    function setArbitrator(address _arb) external {
        require(msg.sender == owner, "!auth");
        rewardArbitrator = _arb;
    }

    /// @notice sets the voteDelegate variable
    /// @param _voteDelegate The address of whom votes will be delegated to
    function setVoteDelegate(address _voteDelegate) external {
        require(msg.sender == voteDelegate, "!auth");
        voteDelegate = _voteDelegate;
    }

    /// @notice sets the lockRewards and stakerRewards variables
    /// @param _rewards The address of the rewards contract
    /// @param _stakerRewards The address of the staker rewards contract
    function setRewardContracts(address _rewards, address _stakerRewards)
        external
    {
        require(msg.sender == owner, "!auth");

        //reward contracts are immutable or else the owner
        //has a means to redeploy and mint bal via rewardClaimed()
        if (lockRewards == address(0)) {
            lockRewards = _rewards;
            stakerRewards = _stakerRewards;
        }
    }

    /// @notice sets the address of the feeToken
    // Set reward token and claim contract, get from Curve's registry
    function setFeeInfo() external {
        require(msg.sender == feeManager, "!auth");

        feeDistro = IRegistry(registry).get_address(distributionAddressId);
        address _feeToken = IFeeDistro(feeDistro).token();
        if (feeToken != _feeToken) {
            //create a new reward contract for the new token
            lockFees = IRewardFactory(rewardFactory).createTokenRewards(
                _feeToken,
                lockRewards,
                address(this)
            );
            feeToken = _feeToken;
        }
    }

    /// @notice sets the lock, staker, caller, platform fees and profit fees
    /// @param _profitFee The amount to set for the profit fees
    /// @param _platformFee The amount to set for the platform fees
    function setFees(uint256 _platformFee, uint256 _profitFee) external {
        require(msg.sender == feeManager, "!auth");

        uint256 total = _profitFee + _platformFee;

        require(total <= MaxFees, ">MaxFees");

        //values must be within certain ranges
        if (
            _platformFee >= 500 && //5%
            _platformFee <= 2000 && //20%
            _profitFee >= 100 &&
            _profitFee <= 500
        ) {
            platformFees = _platformFee;
            profitFees = _profitFee;
        }
    }

    /// @notice sets the contracts treasury variables
    /// @param _treasury The address of the treasury contract
    function setTreasury(address _treasury) external {
        require(msg.sender == feeManager, "!auth");
        treasury = _treasury;
    }

    /// END SETTER SECTION ///

    /// @notice returns the length of the pool
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /// @notice creates a new pool
    /// @param _lptoken The address of the lp token
    /// @param _gauge The address of the gauge controller
    function addPool(address _lptoken, address _gauge) external returns (bool) {
        require(msg.sender == poolManager && !isShutdown, "!add");
        require(_gauge != address(0) && _lptoken != address(0), "!param");

        //the next pool's pid
        uint256 pid = poolInfo.length;
        //create a tokenized deposit
        address token = ITokenFactory(tokenFactory).CreateDepositToken(
            _lptoken
        );
        //create a reward contract for bal rewards
        address newRewardPool = IRewardFactory(rewardFactory).createBalRewards(
            pid,
            token
        );
        //create a stash to handle extra incentives
        address stash = IStashFactory(stashFactory).createStash(
            pid,
            _gauge,
            staker
        );
        //add the new pool
        poolInfo.push(
            PoolInfo({
                lptoken: _lptoken,
                token: token,
                gauge: _gauge,
                balRewards: newRewardPool,
                stash: stash,
                shutdown: false
            })
        );
        gaugeMap[_gauge] = true;
        //give stashes access to rewardfactory and voteproxy
        //   voteproxy so it can grab the incentive tokens off the contract after claiming rewards
        //   reward factory so that stashes can make new extra reward contracts if a new incentive is added to the gauge
        if (stash != address(0)) {
            poolInfo[pid].stash = stash;
            IStaker(staker).setStashAccess(stash, true);
            IRewardFactory(rewardFactory).setAccess(stash, true);
        }
        return true;
    }

    /// @notice shuts down a currently active pool
    /// @param _pid The id of the pool to shutdown
    function shutdownPool(uint256 _pid) external returns (bool) {
        require(msg.sender == poolManager, "!auth");
        PoolInfo storage pool = poolInfo[_pid];

        //withdraw from gauge
        try IStaker(staker).withdrawAll(pool.lptoken, pool.gauge) {} catch {}

        pool.shutdown = true;
        gaugeMap[pool.gauge] = false;
        return true;
    }

    /// @notice shuts down all pools
    /// @dev This shuts down the contract, unstakes and withdraws all LP tokens
    function shutdownSystem() external {
        require(msg.sender == owner, "!auth");
        isShutdown = true;

        for (uint256 i = 0; i < poolInfo.length; i++) {
            PoolInfo storage pool = poolInfo[i];
            if (pool.shutdown) continue;

            address token = pool.lptoken;
            address gauge = pool.gauge;

            //withdraw from gauge
            try IStaker(staker).withdrawAll(token, gauge) {
                pool.shutdown = true;
            } catch {}
        }
    }

    /// @notice deposits an amount into a specific pool, mints reward tokens and stakes them into the reward contract
    /// @param _pid The pool id to deposit lp tokens into
    /// @param _amount The amount of lp tokens to be deposited
    /// @param _stake bool for wheather the tokens should be staked
    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool _stake
    ) public returns (bool) {
        require(!isShutdown, "shutdown");
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        //send to proxy to stake
        address lptoken = pool.lptoken;
        IERC20(lptoken).transferFrom(msg.sender, staker, _amount);

        //stake
        address gauge = pool.gauge;
        require(gauge != address(0), "!gauge setting");
        IStaker(staker).deposit(lptoken, gauge); //VoterProxy

        //some gauges claim rewards when depositing, stash them in a seperate contract until next claim
        address stash = pool.stash;
        if (stash != address(0)) {
            IStash(stash).stashRewards();
        }

        address token = pool.token; //D2DPool token
        if (_stake) {
            //mint here and send to rewards on user behalf
            ITokenMinter(token).mint(address(this), _amount);
            address rewardContract = pool.balRewards;
            IERC20(token).approve(rewardContract, 0);
            IERC20(token).approve(rewardContract, _amount);
            IRewards(rewardContract).stakeFor(msg.sender, _amount);
        } else {
            //add user balance directly
            ITokenMinter(token).mint(msg.sender, _amount);
        }

        emit Deposited(msg.sender, _pid, _amount);
        return true;
    }

    /// @notice deposits and stakes all LP tokens
    /// @param _pid The pool id to deposit lp tokens into
    /// @param _stake bool for wheather the tokens should be staked
    function depositAll(uint256 _pid, bool _stake) external returns (bool) {
        address lptoken = poolInfo[_pid].lptoken;
        uint256 balance = IERC20(lptoken).balanceOf(msg.sender);
        deposit(_pid, balance, _stake);
        return true;
    }

    /// @notice internal function that withdraws lp tokens from the pool
    /// @param _pid The pool id to withdraw the tokens from
    /// @param _amount amount of LP tokens to withdraw
    /// @param _from address of where the lp tokens will be withdrawn from
    /// @param _to address of where the lp tokens will be sent to
    function _withdraw(
        uint256 _pid,
        uint256 _amount,
        address _from,
        address _to
    ) internal {
        PoolInfo storage pool = poolInfo[_pid];
        address lptoken = pool.lptoken;
        address gauge = pool.gauge;

        //remove lp balance
        address token = pool.token;
        ITokenMinter(token).burn(_from, _amount);

        //pull from gauge if not shutdown
        // if shutdown tokens will be in this contract
        if (!pool.shutdown) {
            IStaker(staker).withdraw(lptoken, gauge, _amount);
        }

        //some gauges claim rewards when withdrawing, stash them in a seperate contract until next claim
        //do not call if shutdown since stashes wont have access
        address stash = pool.stash;
        if (stash != address(0) && !isShutdown && !pool.shutdown) {
            IStash(stash).stashRewards();
        }

        //return lp tokens
        IERC20(lptoken).transfer(_to, _amount);

        emit Withdrawn(_to, _pid, _amount);
    }

    /// @notice withdraws lp tokens from the pool
    /// @param _pid The pool id to withdraw lp tokens from
    /// @param _amount amount of LP tokens to withdraw
    function withdraw(uint256 _pid, uint256 _amount) public returns (bool) {
        _withdraw(_pid, _amount, msg.sender, msg.sender);
        return true;
    }

    /// @notice withdraws all of the lp tokens in the pool
    /// @param _pid The pool id to withdraw lp tokens from
    function withdrawAll(uint256 _pid) public returns (bool) {
        address token = poolInfo[_pid].token;
        uint256 userBal = IERC20(token).balanceOf(msg.sender);
        withdraw(_pid, userBal);
        return true;
    }

    /// @notice withdraws LP tokens and sends rewards to a specified address
    /// @param _pid The pool id to deposit lp tokens into
    /// @param _amount amount of LP tokens to withdraw
    function withdrawTo(
        uint256 _pid,
        uint256 _amount,
        address _to
    ) external returns (bool) {
        address rewardContract = poolInfo[_pid].balRewards;
        require(msg.sender == rewardContract, "!auth");

        _withdraw(_pid, _amount, msg.sender, _to);
        return true;
    }

    //withdraw WethBal, which was unlocked after a year of usage
    function withdrawUnlockedWethBal(uint256 _pid, uint256 _amount)
        public
        returns (bool)
    {
        PoolInfo storage pool = poolInfo[_pid];
        address gauge = pool.gauge;

        //pull from gauge if not shutdown
        // if shutdown tokens will be in this contract
        if (!pool.shutdown) {
            IStaker(staker).withdrawWethBal(treasury, gauge, _amount);
        }

        return true;
    }

    // restake wethBAL, which was unlocked after a year of usage
    function restake(uint256 _pid) public returns (bool) {
        require(!isShutdown, "shutdown");
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        //some gauges claim rewards when depositing, stash them in a seperate contract until next claim
        address stash = pool.stash;

        if (stash != address(0)) {
            IStash(stash).stashRewards();
        }

        address token = pool.token;

        uint256 _amount = IERC20(token).balanceOf(msg.sender); //need to get current balance; user could withdraw some amount earlier
        IStaker(staker).increaseTime(lockTime);

        emit Deposited(msg.sender, _pid, _amount);
        return true;
    }

    /// @notice submits votes for proposals
    /// @param _voteId the id of the vote
    /// @param _votingAddress the address placing the vote
    /// @param _support boolean for the vote support
    function vote(
        uint256 _voteId,
        address _votingAddress,
        bool _support
    ) external returns (bool) {
        require(msg.sender == voteDelegate, "!auth");
        require(
            _votingAddress == voteOwnership || _votingAddress == voteParameter,
            "!voteAddr"
        );

        IStaker(staker).vote(_voteId, _votingAddress, _support);
        return true;
    }

    /// @notice sets the voteGaugeWeight
    /// @param _gauge array of gauge addresses
    /// @param _weight array of vote weights
    function voteGaugeWeight(
        address[] calldata _gauge,
        uint256[] calldata _weight
    ) external returns (bool) {
        require(msg.sender == voteDelegate, "!auth");

        for (uint256 i = 0; i < _gauge.length; i++) {
            IStaker(staker).voteGaugeWeight(_gauge[i], _weight[i]);
        }
        return true;
    }

    /// @notice claims rewards from a specific pool
    /// @param _pid the id of the pool
    /// @param _gauge address of the gauge
    function claimRewards(uint256 _pid, address _gauge)
        external
        returns (bool)
    {
        address stash = poolInfo[_pid].stash;
        require(msg.sender == stash, "!auth");

        IStaker(staker).claimRewards(_gauge);
        return true;
    }

    /// @notice sets the gauge redirect address
    /// @param _pid the id of the pool
    function setGaugeRedirect(uint256 _pid) external returns (bool) {
        address stash = poolInfo[_pid].stash;
        require(msg.sender == stash, "!auth");
        address gauge = poolInfo[_pid].gauge;
        bytes memory data = abi.encodeWithSelector(
            bytes4(keccak256("set_rewards_receiver(address)")),
            stash
        );
        IStaker(staker).execute(gauge, uint256(0), data);
        return true;
    }

    /// @notice internal function that claims rewards from a pool and disperses them to the rewards contract
    /// @param _pid the id of the pool where lp tokens are held
    function _earmarkRewards(uint256 _pid) internal {
        require(poolInfo.length != 0, "Controller: pool is not exists");
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        address gauge = pool.gauge;

        //claim bal
        IStaker(staker).claimBal(gauge);

        //check if there are extra rewards
        address stash = pool.stash;
        if (stash != address(0)) {
            //claim extra rewards
            IStash(stash).claimRewards();
            //process extra rewards
            IStash(stash).processStash();
        }

        //bal initial balance
        uint256 balInitialBal = IERC20(bal).balanceOf(address(this));
        //bal balance
        uint256 balBal = balInitialBal;
        
        if (balBal > 0) {
            //Profit fees are taken on the rewards together with platform fees.
            uint256 _profit = (balInitialBal * profitFees) / FEE_DENOMINATOR;
            balBal = balBal - _profit;
            //profit fees are distributed to the gnosisSafe, which owned by Prime; which is here feeManager
            IERC20(bal).transfer(feeManager, _profit);

            //send treasury
            if (
                treasury != address(0) &&
                treasury != address(this) &&
                platformFees > 0
            ) {
                //only subtract after address condition check
                uint256 _platform = (balInitialBal * platformFees) / FEE_DENOMINATOR;
                balBal = balBal - _platform;
                IERC20(bal).transfer(treasury, _platform);
            }
            //send bal to lp provider reward contract
            address rewardContract = pool.balRewards;
            IERC20(bal).transfer(rewardContract, balBal);
            IRewards(rewardContract).queueNewRewards(balBal);
        }
    }

    /// @notice external function that claims rewards from a pool and disperses them to the rewards contract
    /// @param _pid the id of the pool where lp tokens are held
    function earmarkRewards(uint256 _pid) external returns (bool) {
        require(!isShutdown, "shutdown");
        _earmarkRewards(_pid);
        return true;
    }

    /// @notice claims fees from the feeDistro contract, transfers the lockfees into the rewards contract
    function earmarkFees() external returns (bool) {
        //claim fee rewards
        IStaker(staker).claimFees(feeDistro, feeToken);
        //send fee rewards to reward contract
        uint256 _balance = IERC20(feeToken).balanceOf(address(this));
        IERC20(feeToken).transfer(lockFees, _balance);
        IRewards(lockFees).queueNewRewards(_balance);
        return true;
    }

    /// @notice  callback function that gets called when a reward is claimed and recieved
    /// @param _pid the id of the pool
    /// @param _address address of who claimed the reward
    /// @param _amount amount of rewards that were claimed
    function rewardClaimed(
        uint256 _pid,
        address _address,
        uint256 _amount
    ) external returns (bool) {
        address rewardContract = poolInfo[_pid].balRewards;
        require(
            msg.sender == rewardContract || msg.sender == lockRewards,
            "!auth"
        );
        return true;
    }
}
