// TODO Mock a contract without removing any of it's functionality
//by address 0x2f50d538606fa9edd2b11e2446beb18c9d5846bb

// solium-disable linebreak-style
pragma solidity 0.8.13;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
interface VotingEscrow {
    function get_last_user_slope(address addr) external view returns (int128);
    function locked__end(address addr) external view returns (uint256);

}   

contract GaugeControllerMock {
    struct Point{
        uint256 bias;
        uint256 slope;
    }

    struct LockedBalance{
        uint256 slope; 
        uint256 power;
        uint256 end;
    }  

}