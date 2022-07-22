// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "../utils/Interfaces.sol";

contract ControllerMock is IController {

    event StashCreated();

    address public lockRewards;

    bool public isShutdown;

    address public owner;

    address public baseRewardPool;

    constructor() {
        owner = msg.sender;
    }
    // solhint-disable-next-line


    function balanceOf(address _account) external view returns (uint256) {
        return 0;
    }

    function totalSupply() external view returns (uint256) {
        return 0;
    }

    function redeemWethBal() external {

    }

    function poolInfo(uint256)
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address,
            bool
        ) {
            return (address(0), address(0), address(0), baseRewardPool, address(0), false);
        }

    function withdrawTo(
        uint256,
        uint256,
        address
    ) external {}

    function claimRewards_poF(uint256, address) external {}

    function queueNewRewards(uint256 _rewards) external {
        IRewards(lockRewards).queueNewRewards(_rewards);
    }

    function createStash(address _stash) external {
        address createdStash = IStashFactory(_stash).createStash(
            1,
            address(0)
        );

        emit StashCreated();
    }

    function poolLength() external returns(uint256) { return 0; }

    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool _stake
    ) external {}

    function depositAll(uint256 _pid, bool _stake) external {}

    function withdraw(uint256 _pid, uint256 _amount) external {}

    function withdrawAll(uint256 _pid) external {}

    function withdrawUnlockedWethBal() external {}

    function earmarkFees_F4P() external {}

    function earmarkRewards_pcp(uint256 _pid) external {}

    function setRewardContracts(address _rewards) external {
        lockRewards = _rewards;
    }

    function queueNewRewardsOnVirtualBalanceRewardContract(address addr, uint256 amt) external {
        IRewards(addr).queueNewRewards(amt);
    }
    
    function callExtraRewardStashClaimRewards(address _stash, address _rewardFactory) external {
        IRewardFactory(_rewardFactory).grantRewardStashAccess(_stash);
        IStash(_stash).claimRewards_6H10();
    }
    
    function callGrantRewardStashAccess(address _stash, address _rewardFactory) external {
        IRewardFactory(_rewardFactory).grantRewardStashAccess(_stash);
    }

    function setBaseRewardPool(address pool) external {
        baseRewardPool = pool;
    }

    function callExtraRewardStashClaimRewards(address _stash) external {
        IStash(_stash).claimRewards_6H10();
    }

    function callProcessStash(address _stash) external {
        IStash(_stash).processStash_WfQ();
    }
}