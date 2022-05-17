// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";



/// @title BalDepositor contract
/// @dev Deposit contract for Prime Pools is based on the convex contract
contract BalDepositor {
    using Address for address;

    IERC20 public immutable balWeth;

    uint256 private constant MAX_TIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock bal
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable staker;
    address public immutable minter;
    uint256 public incentiveBal;
    uint256 public unlockTime;

    constructor(
        address _staker,
        address _minter,
        address _balWeth
    ) public {
        staker = _staker;
        minter = _minter;
        feeManager = msg.sender;
        balWeth = IERC20(_balWeth);
    }

    /// @notice Sets the contracts feeManager variable
    /// @param _feeManager The address of the fee manager
    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    /// @notice Sets the lock incentive variable
    /// @param _lockIncentive Time to lock tokens
    function setFees(uint256 _lockIncentive) external {
        require(msg.sender == feeManager, "!auth");
        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

    /// @notice Locks initial balance of Weth/Bal in Voter Proxy
    function initialLock() external {
        require(msg.sender == feeManager, "!auth");
        uint256 balBalance = IERC20(balWeth).balanceOf(staker);
        if (balBalance == 0) {
            uint256 unlockAt = block.timestamp + MAX_TIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            //release old lock if exists
            IStaker(staker).release();
            //create new lock
            uint256 balBalanceStaker = IERC20(balWeth).balanceOf(staker);
            IStaker(staker).createLock(balBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    /// @notice Transfers Weth/Bal from VoterProxy `staker` to veBal contract
    /// @dev VoterProxy `staker` is responsible for transferring Weth/Bal tokens to veBal contract via increaseAmount()
    function _lockToken() internal {
        uint256 balBalance = IERC20(balWeth).balanceOf(address(this));
        if (balBalance > 0) {
            IERC20(balWeth).transfer(staker, balBalance);
        }

        //increase ammount
        uint256 balBalanceStaker = IERC20(balWeth).balanceOf(staker);
        if (balBalanceStaker == 0) {
            return;
        }

        //increase amount
        IStaker(staker).increaseAmount(balBalanceStaker);

        uint256 unlockAt = block.timestamp + MAX_TIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        //increase time too if over 2 week buffer
        if ((unlockInWeeks - unlockTime) > 2) {
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    /// @notice Locks tokens in vBal contract and mints reward tokens to sender
    function lockToken() external {
        _lockToken();
        //mint incentives
        if (incentiveBal > 0) {
            ITokenMinter(minter).mint(msg.sender, incentiveBal);
            incentiveBal = 0;
        }
    }

    /// @notice Locks initial balance of Weth/Bal in Voter Proxy. Then stakes `_amount` of Weth/Bal tokens to veBal contract
    /// Mints & stakes d2dBal in Rewards contract on behalf of caller
    /// @dev VoterProxy `staker` is responsible for sending Weth/Bal tokens to veBal contract via _locktoken()
    /// All of the minted d2dBal will be automatically staked to the Rewards contract
    /// @param _amount The amount of tokens user wants to stake
    /// @param _stakeAddress The Reward contract address
    function deposit(uint256 _amount, bool _lock, address _stakeAddress) public {
        require(_amount > 0, "!>0");

        if (_lock) {
            //lock immediately, transfer directly to staker to skip an erc20 transfer
            IERC20(balWeth).transferFrom(msg.sender, staker, _amount);
            _lockToken();
            if (incentiveBal > 0) {
                //add the incentive tokens here so they can be staked together
                _amount = _amount + incentiveBal;
                incentiveBal = 0;
            }
        } else {
            //move tokens here
            IERC20(balWeth).transferFrom(msg.sender, address(this), _amount);
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

    /// @notice Mints & stakes `_amount` of rewards tokens for caller in Rewards contract
    /// @dev Does not stake `_amount` in Rewards contract, just mints d2dbal to caller
    /// @param _amount The amount of Weth/Bal we are staking
    function _deposit(uint256 _amount, bool _lock) external {
        deposit(_amount,_lock,address(0));
    }

    /// @notice Deposits entire Weth/Bal balance of caller. Stakes same amount in Rewards contract
    /// @param _stakeAddress The Reward contract address
    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 balBal = IERC20(balWeth).balanceOf(msg.sender);
        deposit(balBal,_lock,_stakeAddress);
    }
}