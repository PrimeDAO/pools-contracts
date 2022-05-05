
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MockD2DBal.sol";
//this is a mock weth/bal token contract


contract MockRewards is ERC20 {
    uint256 public constant initialSupply = 20000000000000000000000;
    MockD2DBal public mockD2DBal;

    constructor() ERC20("Rewards", "RWD") {}

    function setMockD2DBalAddress(MockD2DBal _mockD2DBal) external {
        require(address(mockD2DBal) == address(0x0), "WRITE_ONCE");
        mockD2DBal = _mockD2DBal;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function stakeFor(address _for, uint256 _amount) public {
        require(_amount > 0, "RewardPool : Cannot stake 0");
        mockD2DBal.transferFrom(_for, address(this), _amount);
      //  emit Staked(msg.sender, _amount);
    }
}