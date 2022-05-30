// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./utils/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BalDepositor contract
/// @dev Deposit contract for Prime Pools is based on the convex contract
contract BalDepositor {
    event FeeManagerChanged(address newFeeManager);
    event LockIncentiveChanged(uint256 newLockIncentive);

    error Unauthorized();
    error InvalidAmount();

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 private constant MAXTIME = 364 days;
    uint256 private constant WEEK = 7 days;

    address public immutable wethBal; // 80/20 BAL/WETH Balancer Pool Token
    address public immutable escrow; // veBAL
    address public immutable staker; // VoterProxy smart contract
    address public immutable d2dBal; // d2dBal

    uint256 public lockIncentive = 10; // incentive to users who spend gas to lock bal
    uint256 public incentiveBal;
    uint256 public unlockTime;
    address public feeManager;

    constructor(
        address _wethBal,
        address _staker,
        address _d2dBal,
        address _escrow
    ) {
        wethBal = _wethBal;
        staker = _staker;
        d2dBal = _d2dBal;
        escrow = _escrow;
        feeManager = msg.sender;
    }

    /// @notice Mints & stakes `_amount` of rewards tokens for caller in Rewards contract
    /// @param _amount The amount of Weth/Bal we are staking
    /// @param _lock boolean whether depositor wants to lock funds immediately
    function deposit(uint256 _amount, bool _lock) external {
        deposit(_amount, _lock, address(0));
    }

    /// @notice Deposits entire Weth/Bal balance of caller. Stakes same amount in Rewards contract
    /// @param _stakeAddress The Reward contract address
    /// @param _lock boolean whether depositor wants to lock funds immediately
    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 wethBalBalance = IERC20(wethBal).balanceOf(msg.sender);
        deposit(wethBalBalance, _lock, _stakeAddress);
    }

    /// @notice Sets the contracts feeManager variable
    /// @param _feeManager The address of the fee manager
    function setFeeManager(address _feeManager) external {
        if (msg.sender != feeManager) {
            revert Unauthorized();
        }
        feeManager = _feeManager;
        emit FeeManagerChanged(_feeManager);
    }

    /// @notice Sets the lock incentive variable
    /// @param _lockIncentive Time to lock tokens
    function setFees(uint256 _lockIncentive) external {
        if (msg.sender != feeManager) {
            revert Unauthorized();
        }
        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
            emit LockIncentiveChanged(_lockIncentive);
        }
    }

    /// @notice Locks initial Weth/Bal in veBal escrow
    function initialLock() external {
        if (msg.sender != feeManager) {
            revert Unauthorized();
        }

        uint256 vBal = IERC20(escrow).balanceOf(staker);
        if (vBal == 0) {
            // solhint-disable-next-line
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            // release old lock if exists
            IStaker(staker).release();
            // create new lock
            uint256 wethBalBalanceStaker = IERC20(wethBal).balanceOf(staker);
            IStaker(staker).createLock(wethBalBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    /// @notice Locks tokens in vBal contract and mints reward tokens to sender
    /// @dev Needed in order to lockFunds on behalf of someone else
    function lockBalancer() external {
        _lockBalancer();

        // mint incentives
        if (incentiveBal > 0) {
            ITokenMinter(d2dBal).mint(msg.sender, incentiveBal);
            incentiveBal = 0;
        }
    }

    /// @notice Locks initial balance of Weth/Bal in Voter Proxy. Then stakes `_amount` of Weth/Bal tokens to veBal contract
    /// Mints & stakes d2dBal in Rewards contract on behalf of caller
    /// @dev VoterProxy `staker` is responsible for sending Weth/Bal tokens to veBal contract via _locktoken()
    /// All of the minted d2dBal will be automatically staked to the Rewards contract
    /// @param _amount The amount of tokens user wants to stake
    /// @param _lock boolean whether depositor wants to lock funds immediately
    /// @param _stakeAddress The Reward contract address
    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) public {
        if (_amount < 1) {
            revert InvalidAmount();
        }

        if (_lock) {
            // lock immediately, transfer directly to staker to skip an erc20 transfer
            IERC20(wethBal).transferFrom(msg.sender, staker, _amount);
            _lockBalancer();
            if (incentiveBal > 0) {
                // add the incentive tokens here so they can be staked together
                _amount = _amount + incentiveBal;
                incentiveBal = 0;
            }
        } else {
            // move tokens here
            IERC20(wethBal).transferFrom(msg.sender, address(this), _amount);
            // defer lock cost to another user
            uint256 callIncentive = ((_amount * lockIncentive) /
                FEE_DENOMINATOR);
            _amount = _amount - callIncentive;

            // add to a pool for lock caller
            incentiveBal = incentiveBal + callIncentive;
        }

        bool depositOnly = _stakeAddress == address(0);
        if (depositOnly) {
            // mint for msg.sender
            ITokenMinter(d2dBal).mint(msg.sender, _amount);
        } else {
            // mint here
            ITokenMinter(d2dBal).mint(address(this), _amount);
            // stake for msg.sender
            IERC20(d2dBal).approve(_stakeAddress, _amount);
            IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
        }
    }

    /// @notice Transfers Weth/Bal from VoterProxy `staker` to veBal contract
    /// @dev VoterProxy `staker` is responsible for transferring Weth/Bal tokens to veBal contract via increaseAmount()
    function _lockBalancer() internal {
        uint256 wethBalBalance = IERC20(wethBal).balanceOf(address(this));
        if (wethBalBalance > 0) {
            IERC20(wethBal).transfer(staker, wethBalBalance);
        }

        // increase ammount
        uint256 wethBalBalanceStaker = IERC20(wethBal).balanceOf(staker);
        if (wethBalBalanceStaker == 0) {
            return;
        }

        // increase amount
        IStaker(staker).increaseAmount(wethBalBalanceStaker);

        // solhint-disable-next-line
        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        // increase time too if over 2 week buffer
        if ((unlockInWeeks - unlockTime) > 2) {
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }
}
