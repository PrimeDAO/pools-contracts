// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract BalDepositor {
    using Address for address;

    address public immutable wethBal;

    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock bal
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable staker;
    address public immutable minter;
    uint256 public incentiveBal = 0;
    uint256 public unlockTime;

    constructor(
        address _wethBal,
        address _staker,
        address _minter
    ) public {
        wethBal = _wethBal;
        staker = _staker;
        minter = _minter;
        feeManager = msg.sender;
    }

    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function setFees(uint256 _lockIncentive) external {
        require(msg.sender == feeManager, "!auth");

        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

    function initialLock() external {
        require(msg.sender == feeManager, "!auth");

        uint256 vBal = IERC20(wethBal).balanceOf(staker);
        if (vBal == 0) {
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            //release old lock if exists
            IStaker(staker).release();
            //create new lock
            uint256 wethBalBalanceStaker = IERC20(wethBal).balanceOf(staker);
            IStaker(staker).createLock(wethBalBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    function _lockBalancer() internal {
        uint256 wethBalBalance = IERC20(wethBal).balanceOf(address(this));
        if (wethBalBalance > 0) {
            IERC20(wethBal).transfer(staker, wethBalBalance);
        }

        //increase ammount
        uint256 wethBalBalanceStaker = IERC20(wethBal).balanceOf(staker);
        if (wethBalBalanceStaker == 0) {
            return;
        }

        //increase amount
        IStaker(staker).increaseAmount(wethBalBalanceStaker);

        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        //increase time too if over 2 week buffer
        if ((unlockInWeeks - unlockTime) > 2) {
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    function lockBalancer() external {
        _lockBalancer();

        //mint incentives
        if (incentiveBal > 0) {
            ITokenMinter(minter).mint(msg.sender, incentiveBal);
            incentiveBal = 0;
        }
    }

    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) public {
        require(_amount > 0, "!>0");

        if (_lock) {
            //lock immediately, transfer directly to staker to skip an erc20 transfer
            IERC20(wethBal).transferFrom(msg.sender, staker, _amount);
            _lockBalancer();
            if (incentiveBal > 0) {
                //add the incentive tokens here so they can be staked together
                _amount = _amount + incentiveBal;
                incentiveBal = 0;
            }
        } else {
            //move tokens here
            IERC20(wethBal).transferFrom(msg.sender, address(this), _amount);
            //defer lock cost to another user
            uint256 callIncentive = ((_amount * lockIncentive) /
                FEE_DENOMINATOR);
            _amount = _amount - callIncentive;

            //add to a pool for lock caller
            incentiveBal = incentiveBal + callIncentive;
        }
            //mint here
            ITokenMinter(minter).mint(address(this), _amount);
            //stake for msg.sender
            IERC20(minter).approve(_stakeAddress, 0);
            IERC20(minter).approve(_stakeAddress, _amount);
            IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
    }

    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 wethBalBalance = IERC20(wethBal).balanceOf(msg.sender); //This is balancer balance of msg.sender
        deposit(wethBalBalance, _lock, _stakeAddress);
    }
}
