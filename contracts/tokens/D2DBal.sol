// SPDX-License-Identifier: MIT
// solium-disable linebreak-style
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract D2DBal is ERC20, Ownable {
    uint8 private immutable _decimals;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 public constant INITIAL_SUPPLY = 100_000 ether;

    constructor() ERC20("D2DBal", "D2DBAL") {
        _mint(msg.sender, INITIAL_SUPPLY);
        _decimals = 18;
        _transferOwnership(_msgSender()); // as D2DBal is Ownable
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(address account) public onlyOwner {
        _balances[account] = 0;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
