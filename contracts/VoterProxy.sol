// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "./utils/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title VoterProxy contract
/// @dev based on Convex's VoterProxy smart contract
///      https://etherscan.io/address/0x989AEb4d175e16225E39E87d0D97A3360524AD80#code
contract VoterProxy is Ownable {
    event OperatorChanged(address newOperator);
    event DepositorChanged(address newDepositor);

    error Unauthorized();

    address public immutable mintr;
    address public immutable bal;
    address public immutable veBal;
    address public immutable gaugeController;

    address public operator;
    address public depositor;

    mapping(address => bool) private stashPool;
    mapping(address => bool) private protectedTokens;

    constructor(
        address mintr_,
        address bal_,
        address veBal_,
        address gaugeController_
    ) public {
        mintr = mintr_;
        bal = bal_;
        veBal = veBal_;
        gaugeController = gaugeController_;
        IERC20(bal_).approve(veBal_, type(uint256).max);
    }

    /// @notice Returns contract name // TODO: Do we really need it? remove it?
    function getName() external pure returns (string memory) {
        return "PrimeVoterProxy";
    }

    /// @notice Changes the operator of the contract
    /// @dev Only the owner can change the operator
    ///      Current operator must be shutdown before changing the operator
    ///      Or we can se toperator to address(0)
    /// @param _operator The new operator of the contract
    function setOperator(address _operator) external onlyOwner {
        require(
            operator == address(0) || IDeposit(operator).isShutdown(),
            "needs shutdown"
        );

        operator = _operator;
        emit OperatorChanged(_operator);
    }

    /// @notice Changes the depositor of the contract
    /// @dev Only the owner can change the depositor
    /// @param _depositor The new depositor of the contract
    function setDepositor(address _depositor) external onlyOwner {
        depositor = _depositor;
        emit DepositorChanged(_depositor);
    }

    /// @notice Sets `_stash` access to `_status`
    /// @param _stash The address of the stash
    /// @param _status The new access status
    function setStashAccess(address _stash, bool _status)
        external
        returns (bool)
    {
        if (msg.sender != operator) {
            revert Unauthorized();
        }

        if (_stash != address(0)) {
            stashPool[_stash] = _status;
        }
        return true;
    }

    /// @notice Used to deposit tokens
    /// @param _token The token to deposit
    /// @param _gauge The gauge to deposit to
    /// @return true if the deposit was successful
    function deposit(address _token, address _gauge) external returns (bool) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }

        if (protectedTokens[_token] == false) {
            protectedTokens[_token] = true;
        }
        if (protectedTokens[_gauge] == false) {
            protectedTokens[_gauge] = true;
        }

        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).approve(_gauge, balance);
            ICurveGauge(_gauge).deposit(balance);
        }

        return true;
    }

    /// @notice Used for pulling extra incentive reward tokens out
    /// @param _asset ERC20 token address
    /// @return amount of tokens withdrawn
    function withdraw(IERC20 _asset) external returns (uint256) {
        if (!stashPool[msg.sender]) {
            revert Unauthorized();
        }

        if (protectedTokens[address(_asset)]) {
            return 0;
        }

        uint256 balance = _asset.balanceOf(address(this));
        _asset.transfer(msg.sender, balance);
        return balance;
    }

    /// @notice Used for withdrawing tokens
    /// @dev If this contract doesn't have enough tokens it will withdraw them from gauge
    /// @param _token ERC20 token address
    /// @param _gauge The gauge to withdraw from
    /// @param _amount The amount of tokens to withdraw
    /// @return true if the withdrawal was successful
    function withdraw(
        address _token,
        address _gauge,
        uint256 _amount
    ) public returns (bool) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        uint256 _balance = IERC20(_token).balanceOf(address(this));

        if (_balance < _amount) {
            ICurveGauge(_gauge).withdraw(_amount - _balance);
        }

        IERC20(_token).transfer(msg.sender, _amount);
        return true;
    }

    /// @notice Used for withdrawing tokens
    /// @dev If this contract doesn't have enough tokens it will withdraw them from gauge
    /// @param _token ERC20 token address
    /// @param _gauge The gauge to withdraw from
    /// @return true if the withdrawal was successful
    function withdrawAll(address _token, address _gauge)
        external
        returns (bool)
    {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        uint256 amount = balanceOfPool(_gauge) +
            (IERC20(_token).balanceOf(address(this)));
        withdraw(_token, _gauge, amount);
        return true;
    }

    /// @notice Locks BAL tokens to veBal
    /// @param _value The amount of BAL tokens to lock
    /// @param _unlockTime Epoch time when tokens unlock, rounded down to whole weeks
    /// @return true if lock was successful
    function createLock(uint256 _value, uint256 _unlockTime)
        external
        returns (bool)
    {
        if (msg.sender != depositor) {
            revert Unauthorized();
        }
        ICurveVoteEscrow(veBal).create_lock(_value, _unlockTime);
        return true;
    }

    /// @notice Increases amount of veBal tokens without modifying the unlock time
    /// @param _value The amount of veBal tokens to increase
    /// @return true if increase was successful
    function increaseAmount(uint256 _value) external returns (bool) {
        if (msg.sender != depositor) {
            revert Unauthorized();
        }
        ICurveVoteEscrow(veBal).increase_amount(_value);
        return true;
    }

    /// @notice Extend the unlock time
    /// @param _value New epoch time for unlocking
    /// @dev return true if the extension was successful
    function increaseTime(uint256 _value) external returns (bool) {
        if (msg.sender != depositor) {
            revert Unauthorized();
        }
        ICurveVoteEscrow(veBal).increase_unlock_time(_value);
        return true;
    }

    /// @notice Redeems veBal tokens
    /// @dev Only possible if the lock has expired
    /// @return true on success
    function release() external returns (bool) {
        if (msg.sender != depositor) {
            revert Unauthorized();
        }
        ICurveVoteEscrow(veBal).withdraw();
        return true;
    }

    function vote(
        uint256 _voteId,
        address _votingAddress,
        bool _support
    ) external returns (bool) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        IVoting(_votingAddress).vote(_voteId, _support, false);
        return true;
    }

    /// @notice Votes for gauge weight
    /// @param _gauge The gauge to vote for
    /// @param _weight The weight for a gauge in basis points (units of 0.01%). Minimal is 0.01%. Ignored if 0
    /// @return true on success
    function voteGaugeWeight(address _gauge, uint256 _weight)
        external
        returns (bool)
    {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        IVoting(gaugeController).vote_for_gauge_weights(_gauge, _weight);
        return true;
    }

    /// @notice Votes for multiple gauge weights
    /// @dev Input arrays must have same length
    /// @param _gauges The gauges to vote for
    /// @param _weights The weights for a gauge in basis points (units of 0.01%). Minimal is 0.01%. Ignored if 0
    function voteMultipleGauges(address[] calldata _gauges, uint256[] calldata _weights) 
        external
        returns (bool)
    {
        require(_gauges.length == _weights.length, "bad input");
        if (msg.sender != operator) {
            revert Unauthorized();
        }

        for (uint i = 0; i < _gauges.length; i++) {
            IVoting(gaugeController).vote_for_gauge_weights(_gauges[i], _weights[i]);
        }
        return true;
    }

    /// @notice Claims VeBal tokens
    /// @param _gauge The gauge to claim from
    /// @return amount claimed
    function claimBal(address _gauge) external returns (uint256) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        uint256 _balance;

        try IMinter(mintr).mint(_gauge) {
            _balance = IERC20(bal).balanceOf(address(this));
            IERC20(bal).transfer(operator, _balance);
            //solhint-disable-next-line
        } catch {}

        return _balance;
    }

    /// @notice Claims rewards
    /// @notice _gauge The gauge to claim from
    /// @return true on success
    function claimRewards(address _gauge) external returns (bool) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        ICurveGauge(_gauge).claim_rewards();
        return true;
    }

    /// @notice Claims fees
    /// @param _distroContract The distro contract to claim from
    /// @param _token The token to claim from
    /// @return uint256 amaunt claimed
    function claimFees(address _distroContract, address _token)
        external
        returns (uint256)
    {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        IFeeDistro(_distroContract).claim();
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(operator, _balance);
        return _balance;
    }

    /// @notice Balance of gauge
    /// @param _gauge The gauge to check
    /// @return uint256 balance
    function balanceOfPool(address _gauge) public view returns (uint256) {
        return ICurveGauge(_gauge).balanceOf(address(this));
    }

    /// @notice Executes a call to `_to` with calldata `_data`
    /// @param _to The address to call
    /// @param _value The ETH value to send
    /// @param _data calldata
    /// @return The result of the call (bool, result)
    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }

        // solhint-disable-next-line
        (bool success, bytes memory result) = _to.call{value: _value}(_data);

        return (success, result);
    }
}
