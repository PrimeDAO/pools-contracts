// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoolContract is ERC20, Ownable {
    uint8 private immutable _decimals;

    //d2dPool tokens are staked in the Rewards contract for specific pool on the name of user, without the possibility to unstake them.
    mapping(address => uint256) private _balances;
    uint256 public constant initialSupply = 20000000000000000000000;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals_
    ) ERC20(_name, _symbol) {
        // _mint(msg.sender, initialSupply);
        _decimals = decimals_;
        _transferOwnership(_msgSender()); // as PoolContract is Ownable
    }

    function mint(uint256 amount, address staker) public onlyOwner {
        _mint(msg.sender, amount);
    }

    function burn(address account) public onlyOwner {
        _balances[account] = 0;
    }   

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
}