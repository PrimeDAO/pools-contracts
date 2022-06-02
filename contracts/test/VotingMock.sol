// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "../utils/Interfaces.sol";

contract VotingMock is IVoting {
    function vote(
        uint256 _voteId,
        bool _support,
        bool executeIfDecided
    // solhint-disable-next-line no-empty-blocks
    ) external {}

    function getVote(uint256)
        external
        view
        returns (
            bool,
            bool,
            uint64,
            uint64,
            uint64,
            uint64,
            uint256,
            uint256,
            uint256,
            bytes memory
    // solhint-disable-next-line no-empty-blocks
        ) {}

    // solhint-disable-next-line no-empty-blocks
    function vote_for_gauge_weights(address, uint256) external {}
}