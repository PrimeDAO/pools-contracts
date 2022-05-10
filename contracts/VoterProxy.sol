// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./SampleERC.sol";
import "./MockVBAL.sol";
import "./MockRewards.sol";

import "hardhat/console.sol";

contract VoterProxy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant mintr = address(0xd061D61a4d941c39E5453435B6345Dc261C2fcE0);
    address public constant balWeth = address(0x5FbDB2315678afecb367f032d93F642f64180aa3);

    address public constant veBal = address(0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0);
    address public constant gaugeController = address(0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB);
    
    address public owner;
    address public operator;
    address public depositor;
    SampleERC public coin;
    MockVBAL public mockvBal;
    MockRewards public mockRewards;
    
    mapping (address => bool) private stashPool;
    mapping (address => bool) private protectedTokens;

    constructor() public {
        owner = msg.sender;
    }

    function setCoinAddress(SampleERC _coin) external {
        require(address(coin) == address(0x0), "WRITE_ONCE");
        coin = _coin;
    }
    function setMockVbalAddress(MockVBAL _mockVbal) external {
        require(address(mockvBal) == address(0x0), "WRITE_ONCE");
        mockvBal = _mockVbal;
    }
    function setMockRewardsAddress(MockRewards _mockRewards) external {
        require(address(mockRewards) == address(0x0), "WRITE_ONCE");
        mockRewards = _mockRewards;
    }

    function getName() external pure returns (string memory) {
        return "CurveVoterProxy";
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    function setOperator(address _operator) external {
        require(msg.sender == owner, "!auth");
        require(operator == address(0) || IDeposit(operator).isShutdown() == true, "needs shutdown");
        
        operator = _operator;
    }

    function setDepositor(address _depositor) external {
        require(msg.sender == owner, "!auth11");

        depositor = _depositor;
    }

    function setStashAccess(address _stash, bool _status) external returns(bool){
        require(msg.sender == operator, "!auth");
        if(_stash != address(0)){
            stashPool[_stash] = _status;
        }
        return true;
    }



    // new stake funds function:
    // will redirect weth bal from its own address and staks them into vbal contract
    function deposit(address _token, address _gauge) external returns(bool){
        
        
        require(msg.sender == operator, "!auth");
        if(protectedTokens[_token] == false){
            protectedTokens[_token] = true;
        }
        if(protectedTokens[_gauge] == false){
            protectedTokens[_gauge] = true;
        }
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).safeApprove(_gauge, 0);
            IERC20(_token).safeApprove(_gauge, balance);
            ICurveGauge(_gauge).deposit(balance);
        }
        return true;
    }

    //stash only function for pulling extra incentive reward tokens out
    function withdraw(IERC20 _asset) external returns (uint256 balance) {
        require(stashPool[msg.sender] == true, "!auth");

        //check protection
        if(protectedTokens[address(_asset)] == true){
            return 0;
        }

        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(msg.sender, balance);
        return balance;
    }

    // Withdraw partial funds
    function withdraw(address _token, address _gauge, uint256 _amount) public returns(bool){
        require(msg.sender == operator, "!auth");
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_gauge, _amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        IERC20(_token).safeTransfer(msg.sender, _amount);
        return true;
    }

     function withdrawAll(address _token, address _gauge) external returns(bool){
        require(msg.sender == operator, "!auth");
        uint256 amount = balanceOfPool(_gauge).add(IERC20(_token).balanceOf(address(this)));
        withdraw(_token, _gauge, amount);
        return true;
    }

    function _withdrawSome(address _gauge, uint256 _amount) internal returns (uint256) {
        ICurveGauge(_gauge).withdraw(_amount);
        return _amount;
    }

    function createLock(uint256 _value, uint256 _unlockTime) external returns(bool){
        require(msg.sender == depositor, "!auth");
        coin.approve(address(mockvBal), _value);
        mockvBal.create_lock(_value, _unlockTime);
        return true;
    }

    function increaseAmount(uint256 _value) external returns(bool){
        require(msg.sender == depositor, "!auth23");
        coin.approve(address(mockvBal), _value);
        mockvBal.increaseAmount(address(this), _value);
        return true;
    }

    

    function increaseTime(uint256 _value) external returns(bool){
        require(msg.sender == depositor, "!auth");
        mockvBal.increase_unlock_time(_value); //this is in vbal contract
        return true;
    }

    function release() external returns(bool){
        require(msg.sender == depositor, "!auth");
        mockvBal.withdraw();
        return true;
    }

    function vote(uint256 _voteId, address _votingAddress, bool _support) external returns(bool){
        require(msg.sender == operator, "!auth");
        IVoting(_votingAddress).vote(_voteId,_support,false);
        return true;
    }

    function voteGaugeWeight(address _gauge, uint256 _weight) external returns(bool){
        require(msg.sender == operator, "!auth");

        //vote
        IVoting(gaugeController).vote_for_gauge_weights(_gauge, _weight);
        return true;
    }

    function claimCrv(address _gauge) external returns (uint256){
        require(msg.sender == operator, "!auth");
        
        uint256 _balance = 0;
        try IMinter(mintr).mint(_gauge){
            _balance = coin.balanceOf(address(this));
            coin.transfer(operator, _balance);
        }catch{}

        return _balance;
    }

    function claimRewards(address _gauge) external returns(bool){
        require(msg.sender == operator, "!auth");
        ICurveGauge(_gauge).claim_rewards();
        return true;
    }

    function claimFees(address _distroContract, address _token) external returns (uint256){
        require(msg.sender == operator, "!auth");
        IFeeDistro(_distroContract).claim();
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(operator, _balance);
        return _balance;
    }    

    function balanceOfPool(address _gauge) public view returns (uint256) {
        return ICurveGauge(_gauge).balanceOf(address(this));
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == operator,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

}