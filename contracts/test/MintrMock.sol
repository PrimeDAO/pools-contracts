// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../utils/Interfaces.sol";
import "../utils/MathUtil.sol";

/// @title Token Minter
/// @dev Original code https://etherscan.io/address/0xd061d61a4d941c39e5453435b6345dc261c2fce0#code
///      Based on Curve's Minter smart contract
///      Every mint function 100 BAL tokens
contract MintrMock is IMinter, ReentrancyGuard {
    using MathUtil for uint256;

    event Minted(address indexed recipient, address gauge, uint256 minted);

    address public immutable token;
    address public immutable controller;

    constructor(address _token, address _controller) {
        token = _token;
        controller = _controller;
    }

    /// @notice Mint tokens for `_for`
    /// @dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
    /// @param _gauge `LiquidityGauge` address to get mintable amount from
    /// @param _for Address to mint to
    function mint_for(address _gauge, address _for) external nonReentrant {
        _mint_for(_gauge, _for);
    }

    /// @notice Mint everything which belongs to `msg.sender` across multiple gauges
    /// @param _gauges List of `LiquidityGauge` addresses
    function mint_many(address[8] calldata _gauges) external nonReentrant {
        for (uint256 i = 0; i < 8; i = i.unsafeInc()) {
            if (_gauges[i] == address(0)) {
                break;
            }
            _mint_for(_gauges[i], msg.sender);
        }
    }
 
    /// @notice Mint everything which belongs to `msg.sender` and send to them
    /// @param _gauge `LiquidityGauge` address to get mintable amount from
    function mint(address _gauge) external nonReentrant {
        _mint_for(_gauge, msg.sender);
    }

    /// @notice allow `_minting_user` to mint for `msg.sender`
    /// @param _minting_user Address to toggle permission for
    function toggle_approve_mint(address _minting_user) external {}

    /// @dev Mints 100 * 1e18 BAL tokens for `_for`
    /// it does not have any authorization checks
    function _mint_for(address _gauge, address _for) internal {
        uint256 toMint = 100 ether;
        ITokenMinter(token).mint(_for, toMint);
        emit Minted(_for, _gauge, toMint);
    }
}
