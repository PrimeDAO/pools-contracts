// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../utils/Interfaces.sol";

contract DistroMock is IFeeDistro {

    // solhint-disable-next-line no-empty-blocks
    function claim() external {}
    
    function token() external view returns(address) {
        return address(0);
    }
}