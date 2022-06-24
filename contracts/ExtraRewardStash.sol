// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./utils/Interfaces.sol";

/// @title ExtraRewardStash
contract ExtraRewardStash is IStash {
    error Unauthorized();
    error AlreadyInitialized();

    event RewardHookSet(address newRewardHook);

    uint256 private constant MAX_REWARDS = 8;
    address public immutable bal;

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

    constructor(address _bal) {
        bal = _bal;
    }

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

    /// @notice Returns the length of the tokenList
    function tokenCount() external view returns (uint256) {
        return tokenList.length;
    }

    /// @notice Claims registered reward tokens
    function claimRewards() external {
        if (msg.sender != operator) {
            revert Unauthorized();
        }
        // this is updateable from v2 gauges now so must check each time.
        checkForNewRewardTokens();

        // make sure we're redirected
        if (!hasRedirected) {
            IController(operator).setGaugeRedirect(pid);
            hasRedirected = true;
        }

        if (hasBalRewards) {
            // claim rewards on gauge for staker
            // using reward_receiver so all rewards will be moved to this stash
            IController(operator).claimRewards(pid, gauge);
        }

        // hook for reward pulls
        if (rewardHook != address(0)) {
            // solhint-disable-next-line
            try IRewardHook(rewardHook).onRewardClaim() {} catch {}
        }
    }

    /// @notice Checks if the gauge rewards have changed
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

    /// @notice Registers an extra reward token to be handled
    /// @param _token The reward token address
    /// @dev Used for any new incentive that is not directly on curve gauges
    function setExtraReward(address _token) external {
        // owner of booster can set extra rewards
        if (msg.sender != IController(operator).owner()) {
            revert Unauthorized();
        }
        setToken(_token);
    }

    /// @notice Sets the reward hook address
    /// @param _hook The address of the reward hook
    function setRewardHook(address _hook) external {
        // owner of booster can set reward hook
        if (msg.sender != IController(operator).owner()) {
            revert Unauthorized();
        }
        rewardHook = _hook;
        emit RewardHookSet(_hook);
    }

    /// @notice Replaces a token on the token list
    /// @param _token The address of the token
    function setToken(address _token) internal {
        TokenInfo storage t = tokenInfo[_token];

        if (t.token == address(0)) {
            //set token address
            t.token = _token;

            //check if BAL
            if (_token != bal) {
                //create new reward contract (for NON-BAL tokens only)
                (, , , address mainRewardContract, , ) = IController(operator).poolInfo(pid);
                address rewardContract = IRewardFactory(rewardFactory).createTokenRewards(
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

    /// @notice Sends all of the extra rewards to the reward contracts
    function processStash() external {
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
                if (token == bal) {
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
    }
}
