// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./utils/Interfaces.sol";

/// @title ExtraRewardStash
contract ExtraRewardStash {
    error Unauthorized();
    error AlreadyInitialized();

    uint256 private constant MAX_REWARDS = 8;
    address public constant BAL =
        address(0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7);

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;
    address public rewardHook; // address to call for reward pulls
    bool public hasRedirected;
    bool public hasBalRewards;

    mapping(address => uint256) public historicalRewards;

    struct TokenInfo {
        address token;
        address rewardAddress;
    }

    // use mapping + array so that we dont have to loop check each time setToken is called
    mapping(address => TokenInfo) public tokenInfo;
    address[] public tokenList;

    // solhint-disable-next-line no-empty-blocks
    constructor() public {}

    function initialize(
        uint256 _pid,
        address _operator,
        address _staker,
        address _gauge,
        address _rFactory
    ) external {
        if (gauge != address(0)) {
            revert AlreadyInitialized();
        }
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }

    function tokenCount() external view returns (uint256) {
        return tokenList.length;
    }

    // try claiming if there are reward tokens registered
    function claimRewards() external returns (bool) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        // this is updateable from v2 gauges now so must check each time.
        checkForNewRewardTokens();

        // make sure we're redirected
        if (!hasRedirected) {
            IDeposit(operator).setGaugeRedirect(pid);
            hasRedirected = true;
        }

        if (hasBalRewards) {
            // claim rewards on gauge for staker
            // using reward_receiver so all rewards will be moved to this stash
            IDeposit(operator).claimRewards(pid, gauge);
        }

        // hook for reward pulls
        if (rewardHook != address(0)) {
            // solhint-disable-next-line
            try IRewardHook(rewardHook).onRewardClaim() {} catch {}
        }
        return true;
    }

    // check if gauge rewards have changed
    function checkForNewRewardTokens() internal {
        for (uint256 i = 0; i < MAX_REWARDS; i++) {
            address token = IBalGauge(gauge).reward_tokens(i);
            if (token == address(0)) {
                break;
            }
            if (!hasBalRewards) {
                hasBalRewards = true;
            }
            setToken(token);
        }
    }

    // register an extra reward token to be handled
    // (any new incentive that is not directly on curve gauges)
    function setExtraReward(address _token) external {
        // owner of booster can set extra rewards
        if (msg.sender != IDeposit(operator).owner()) {
            revert Unauthorized();
        }
        setToken(_token);
    }

    function setRewardHook(address _hook) external {
        // owner of booster can set reward hook
        if (msg.sender != IDeposit(operator).owner()) {
            revert Unauthorized();
        }
        rewardHook = _hook;
    }

    // replace a token on token list
    function setToken(address _token) internal {
        TokenInfo storage t = tokenInfo[_token];

        if (t.token == address(0)) {
            //set token address
            t.token = _token;

            //check if BAL
            if (_token != BAL) {
                //create new reward contract (for NON-BAL tokens only)
                (, , , address mainRewardContract, , ) = IDeposit(operator)
                    .poolInfo(pid);
                address rewardContract = IRewardFactory(rewardFactory)
                    .createTokenRewards(
                        _token,
                        mainRewardContract,
                        address(this)
                    );

                t.rewardAddress = rewardContract;
            }
            //add token to list of known rewards
            tokenList.push(_token);
        }
    }

    // pull assigned tokens from staker to stash
    function stashRewards() external pure returns (bool) {
        //after depositing/withdrawing, extra incentive tokens are claimed
        //but from v3 this is default to off, and this stash is the reward receiver too.
        return true;
    }

    // send all extra rewards to their reward contracts
    function processStash() external returns (bool) {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        uint256 tCount = tokenList.length;
        for (uint256 i = 0; i < tCount; i++) {
            TokenInfo storage t = tokenInfo[tokenList[i]];
            address token = t.token;
            if (token == address(0)) continue;

            uint256 amount = IERC20(token).balanceOf(address(this));
            if (amount > 0) {
                historicalRewards[token] = historicalRewards[token] + amount;
                if (token == BAL) {
                    //if BAL, send back to booster to distribute
                    IERC20(token).transfer(operator, amount);
                    continue;
                }
                //add to reward contract
                address rewards = t.rewardAddress;
                if (rewards == address(0)) continue;
                IERC20(token).transfer(rewards, amount);
                IRewards(rewards).queueNewRewards(amount);
            }
        }
        return true;
    }
}