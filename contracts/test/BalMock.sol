//mock of bal contract from mainnet
//by address 0xC128a9954e6c874eA3d62ce62B468bA073093F25

// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BalMock is ERC20 {
    struct Point{
        int128 bias;
        int128 slope; // - dweight / dt
        uint256 ts;
        uint256 blk; // block
    }
    // We cannot really do block numbers per se b/c slope is per time, not per block
    // and per block could be fairly bad b/c Ethereum changes blocktimes.
    // What we can do is to extrapolate ***At functions

    struct LockedBalance{
        int128 amount; 
        uint256 end;
    }  

    // interface ERC20(){
    //     function view decimals() returns ;
    //     function view name() -> String[64]: view
    //     function view symbol() -> String[32]: view
    //     function nonpayable transfer(to: address, amount: uint256) -> bool: nonpayable
    //     function nonpayable transferFrom(spender: address, to: address, amount: uint256) -> bool: nonpayable
    // }

    // Interface for checking whether address belongs to a whitelisted
    // type of a smart wallet.
    // When new types are added - the whole contract is changed
    // The check() method is modifying to be able to use caching
    // for individual wallet addresses
    interface SmartWalletChecker(){
        function check(address addr) returns (bool);//-> bool: nonpayable
    }    

    int128 constant DEPOSIT_FOR_TYPE = 0;
    int128 constant CREATE_LOCK_TYPE = 1;
    int128 constant INCREASE_LOCK_AMOUNT = 2;
    int128 constant INCREASE_UNLOCK_TIME = 3;

    event Deposit(address provider, uint256 value, uint256 locktime, int128 type, uint256 ts);
    event Withdraw(address provider, uint256 value, uint256 ts);
    event Supply(uint256 prevSupply, uint256 supply);

    uint256 constant WEEK = 7 * 86400; //all future times are rounded by week
    uint256 constant MAXTIME = 365 * 86400;  // 1 year
    uint256 constant MULTIPLIER = 10 ** 18;


    address immutable TOKEN; 
    address immutable AUTHORIZER_ADAPTOR; //Authorizer Adaptor

    string immutable NAME;
    string immutable SYMBOL;
    uint256 immutable DECIMALS;

    uint256 public supply;

    locked: public(HashMap[address, LockedBalance])

    uint256 public epoch;
    point_history: public(Point[100000000000000000000000000000])  # epoch -> unsigned point
    user_point_history: public(HashMap[address, Point[1000000000]])  # user -> Point[user_epoch]
    user_point_epoch: public(HashMap[address, uint256])
    slope_changes: public(HashMap[uint256, int128])  # time -> signed slope change

    // Checker for whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    address public future_smart_wallet_checker
    address public smart_wallet_checker;


    //__init__
    constructor(
        address token_addr,
        string memory _name,
        string memory  _symbol,
        address _authorizer_adaptor
    ) ERC20(_name, _symbol)
    public {

    }


function token() external view returns (address){
    return TOKEN;
}
function name() external view returns (string){
    return NAME;
}
function symbol() external view returns (string){
    return SYMBOL;
}
function decimals() external view returns (uint256){
    return DECIMALS;
}
function admin() external view returns (address){
    return AUTHORIZER_ADAPTOR;
}
function commit_smart_wallet_checker(address addr) external {};
function apply_smart_wallet_checker() external {};
function assert_not_contract() internal {};
function get_last_user_slope() external view {};
function user_point_history__ts() external view {};
function locked__end(address _addr) external view {};
function _checkpoint() internal {};
function _deposit_for(address _addr, uint256 _value, uint256 unlock_time, LockedBalance locked_balance, int128 type) internal {};
function checkpoint() external {};
function deposit_for(address _addr, uint256 _value) external {};
function create_lock(uint256) external {};
function increase_amount(uint256) external {};
function increase_unlock_time(uint256 _unlock_time) external {};
function withdraw() external {};

// The following ERC20/minime-compatible methods are not real balanceOf and supply!
// They measure the weights for the purpose of voting, so they don't represent
// real coins.

function
function
function

}


