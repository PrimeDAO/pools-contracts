pragma solidity ^0.8.0;

import "./utils/Interfaces.sol";
import "./utils/MathUtil.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./MockVBAL.sol";
import "./MockD2DBal.sol";
import "./ERC20Mock.sol";
import "./VoterProxy.sol";
import "./SampleERC.sol";
import "./MockVoteProxy.sol";
import "./MockRewards.sol";

import "hardhat/console.sol";

contract BalDepositor {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;

    address public immutable balWeth =
        address(0xba100000625a3754423978a60c9317c58a424e3D);
    address public immutable veBal;
    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock bal
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable staker;
    address public immutable minter;
    uint256 public incentiveBal = 0;
    uint256 public unlockTime;
    MockVBAL public mockvBal;
    MockD2DBal public mockD2DBal;
    ERC20Mock public mocktoken;
    VoterProxy public voter;
    SampleERC public coin;
    MockVoteProxy public voteProxy;
    MockRewards public mockRewards;

    constructor(
        address _staker,
        address _minter,
        address _veBal
    ) public {
        staker = _staker;
        minter = _minter;
        feeManager = msg.sender;
        veBal = _veBal;
    }

    function setCoinAddress(SampleERC _coin) external {
        require(address(coin) == address(0x0), "WRITE_ONCE");
        coin = _coin;
    }
    
    function setVoterAddress(VoterProxy _voteProxy) external {
        require(address(voter) == address(0x0), "WRITE_ONCE");
        voter = _voteProxy;
    }
    function setMockVbalAddress(MockVBAL _mockVbal) external {
        require(address(mockvBal) == address(0x0), "WRITE_ONCE");
        mockvBal = _mockVbal;
    }
    function setMockRewardsAddress(MockRewards _mockRewards) external {
        require(address(mockRewards) == address(0x0), "WRITE_ONCE");
        mockRewards = _mockRewards;
    }

    function setMockD2DBalAddress(MockD2DBal _mockD2DBal) external {
        require(address(mockD2DBal) == address(0x0), "WRITE_ONCE");
        mockD2DBal = _mockD2DBal;
    }
    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function setFees(uint256 _lockIncentive) external {
       // require(msg.sender == feeManager, "!auth");

        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

 //Istaker === voter poxy
    //will be same for 
    function initialLock() external {
        require(msg.sender == feeManager, "!auth");

        uint256 vBal = IERC20(veBal).balanceOf(staker);
        if (vBal == 0) {
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            //release old lock if exists
            //voter poxy has 
            IStaker(staker).release(); //release calls withdraw bal/weth going back to voter proxy
            //create new lock
            uint256 balBalanceStaker = IERC20(balWeth).balanceOf(staker); //checking the amount bal/weth staked (voter proxy) in the vbal contract
            //this is from balancer contract titled create_lock
            //voter proxy will be calling the createLock function on the vbal contract
            IStaker(staker).createLock(balBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
        require(vBal == 0,"vBal locked already");
    }

    function _lockToken() internal {
        uint balBalance = coin.balanceOf(address(this));
        
        // uint256 balBalance = IERC20(balWeth).balanceOf(address(this));
        if (balBalance > 0) {
            mockvBal.deposit_for(address(staker), balBalance);
        }

        //increase ammount
        uint256 balBalanceOfStaker = coin.balanceOf(staker);

        // uint256 balBalanceStaker = mocktoken.balanceOf(staker);
        if (balBalanceOfStaker == 0) {
            return;
        }

    }

    function lockToken() external {
        _lockToken();

        //mint incentives
        if (incentiveBal > 0) {
            ITokenMinter(minter).mint(msg.sender, incentiveBal);
            incentiveBal = 0;
        }
    }

//we shoudl call vbal contract and lock tokens in vbal contract
    function deposit(uint256 _amount) external {
        //current flow:
        // user deposits weth/bal
        //transfer from user to Baldepositor address
        //call lock tokens
        // transfer funds from baldepositor address to staker (aka voter proxy)
        // lockTokens calls vbal contratc depositFor 
        //this transfer tokens from staker/aka vProxy to 
        // ll last step is minting d2dbal and putting them into rewards contract
        require(_amount > 0, "!>0");
        coin.approve(address(this), _amount);
        coin.transferFrom(msg.sender, address(this), _amount);
        coin.increaseAllowance(address(mockvBal), _amount);
        _lockToken();
        
        //mockD2DBal.initialSupply();
        //mockD2DBal.mint(address(this), _amount);
        //I think i need to approvwe mock rewards
       // mockRewards.stakeFor(msg.sender, _amount);
      
    }

    function _deposit(uint256 _amount, bool _lock) external {
        //deposit(_amount, _lock, address(0));
    }

    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 balBal = IERC20(balWeth).balanceOf(msg.sender); //This is bal/weth balance of msg.sender
        //deposit(balBal, _lock, _stakeAddress);
    }
}
