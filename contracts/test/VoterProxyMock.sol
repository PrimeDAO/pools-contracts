// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "../utils/Interfaces.sol";
import "../utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract VoterProxyMock {
    using Address for address;

    address public immutable mintr;
    address public immutable bal;

    address public immutable veBal;
    address public immutable gaugeController;

    address public owner;
    address public operator;
    address public depositor;

    mapping(address => bool) private stashPool;
    mapping(address => bool) private protectedTokens;

    constructor(
        address mintr_,
        address bal_,
        address veBal_,
        address gaugeController_
    ) {
        owner = msg.sender;

        mintr = mintr_;
        bal = bal_;
        veBal = veBal_;
        gaugeController = gaugeController_;
    }

    function getName() external pure returns (string memory) {
        return "BalVoterProxy";
    }

    function setOwner(address _owner) external {

    }

    function setOperator(address _operator) external {

    }

    function setDepositor(address _depositor) external {

    }

    function setStashAccess(address _stash, bool _status)
        external
        returns (bool)
    {

        return true;
    }

    function deposit(address _token, address _gauge) external returns (bool) {
        
        return true;
    }

    //stash only function for pulling extra incentive reward tokens out
    function withdraw(IERC20 _asset) external returns (uint256 balance) {

        return 1;
    }

    // Withdraw partial funds
    function withdraw(
        address _token,
        address _gauge,
        uint256 _amount
    ) public returns (bool) {

        return true;
    }

    function withdrawAll(address _token, address _gauge)
        external
        returns (bool)
    {

        return true;
    }

    function _withdrawSome(address _gauge, uint256 _amount)
        internal
        returns (uint256)
    {

        return _amount;
    }

    function createLock(uint256 _value, uint256 _unlockTime)
        external
        returns (bool)
    {

        return true;
    }

    function increaseAmount(uint256 _value) external returns (bool) {

        return true;
    }

    function increaseTime(uint256 _value) external returns (bool) {

        return true;
    }

    // Withdraw partial funds
    function withdrawWethBal(
        address _to, //treasury
        address _gauge,
        uint256 _amount
    ) public returns (uint256) {

        return 1;
    }


    function vote(
        uint256 _voteId,
        address _votingAddress,
        bool _support
    ) external returns (bool) {
        IVoting(_votingAddress).vote(_voteId, _support, false);
        return true;
    }

    function voteGaugeWeight(address _gauge, uint256 _weight)
        external
        returns (bool)
    {
        return true;
    }

    function claimBal(address _gauge) external returns (uint256) {

        return 1;
    }

    function claimRewards(address _gauge) external returns (bool) {

        return true;
    }

    function claimFees(address _distroContract, IERC20 _token)
        external
        returns (uint256)
    {

        return 1;
    }

    function balanceOfPool(address _gauge) public view returns (uint256) {
        return 1;
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        // solhint-disable-next-line
        (bool success, bytes memory result) = _to.call{value: _value}(_data);

        return (success, result);
    }
}
