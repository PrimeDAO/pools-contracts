//mock of vebal contract from mainnet
//by address 0xC128a9954e6c874eA3d62ce62B468bA073093F25

// solium-disable linebreak-style
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface BAL_ERC20 { //was just ERC20 in their Vyper contract
    function decimals_() external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function transfer(address to, uint256 amount) external returns (bool); //nonpayable
    function transferFrom(address spender, address to, uint256 amount) external returns (bool); //nonpayable
}
// Interface for checking whether address belongs to a whitelisted
// type of a smart wallet.
// When new types are added - the whole contract is changed
// The check() method is modifying to be able to use caching
// for individual wallet addresses 
interface SmartWalletChecker {
    function check(address addr) external returns (bool);//nonpayable
}   

contract VeBalMock is ERC20, ReentrancyGuard {

    struct Point{
        uint256 bias;
        uint256 slope; // - dweight / dt
        uint256 ts;
        uint256 blk; // block
    }
    // We cannot really do block numbers per se b/c slope is per time, not per block
    // and per block could be fairly bad b/c Ethereum changes blocktimes.
    // What we can do is to extrapolate ***At functions

    struct LockedBalance{
        uint256 amount; 
        uint256 end;
    }  

    address constant ZERO_ADDRESS = address(0x0000000000000000000000000000000000000000);

    uint256 constant DEPOSIT_FOR_TYPE = 0;
    uint256 constant CREATE_LOCK_TYPE = 1;
    uint256 constant INCREASE_LOCK_AMOUNT = 2;
    uint256 constant INCREASE_UNLOCK_TIME = 3;

    event Deposit(address indexed provider, uint256 value, uint256 indexed locktime, uint256 type_, uint256 ts); //if just type without _ --> was highlited as error
    event Withdraw(address indexed provider, uint256 value, uint256 ts);
    event Supply(uint256 prevSupply, uint256 supply);

    uint256 constant WEEK = 7 * 86400; //all future times are rounded by week
    uint256 constant MAXTIME = 365 * 86400;  // 1 year
    uint256 constant MULTIPLIER = 10 ** 18;


    address immutable TOKEN; 
    address immutable AUTHORIZER_ADAPTOR; //Authorizer Adaptor

    //string is not succorted to be immutable in solidity
    string public NAME; //immutable NAME;
    string public SYMBOL; //immutable SYMBOL; 
    uint256 immutable DECIMALS;

    // uint256 public supply;
    mapping(address => uint256) supply;
    uint256 private _totalSupply;

    mapping(address => LockedBalance) public locked;

    uint256 public epoch;

    Point[100000000000000000000000000000] public point_history; //epoch -> unsigned point
    mapping(address => Point[1000000000]) private user_point_history; //user -> Point[user_epoch]
    mapping(address => uint256) public user_point_epoch;
    mapping(uint256 => int128) public slope_changes; //time -> signed slope change

    // Checker for whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    address public future_smart_wallet_checker;
    address public smart_wallet_checker;


    //__init__
    constructor(
        address token_addr,
        string memory _name,
        string memory  _symbol,
        address _authorizer_adaptor
    ) ERC20(_name, _symbol)
    public {
        /**
        @notice Contract constructor
        @param token_addr 80/20 BAL-WETH BPT token address
        @param _name Token name
        @param _symbol Token symbol
        @param _authorizer_adaptor `AuthorizerAdaptor` contract address
        */
        require(_authorizer_adaptor != ZERO_ADDRESS, "BalMock: _authorizer_adaptor == ZERO_ADDRESS");

        TOKEN = token_addr;
        AUTHORIZER_ADAPTOR = _authorizer_adaptor;
        point_history[0].blk = block.number;
        point_history[0].ts = block.timestamp;

        uint256 _decimals = ERC20(token_addr).decimals();
        require(_decimals <= 255, "BalMock: _decimals > 255");

        NAME = _name;
        SYMBOL = _symbol;
        DECIMALS = _decimals;
    }


    function decimals_() public view virtual returns (uint256){
        return DECIMALS;
    }
    function admin() external view returns (address){
        return AUTHORIZER_ADAPTOR;
    }

    function NbalanceOf(address addr) external view returns (uint256){
        /**
        @notice Get the current voting power for `msg.sender`
        @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
        @param addr User wallet address
        @param _t Epoch time to return voting power at
        @return User voting power
        */
        // if (t !=0 ) {
            uint256 _t = block.timestamp;
        // }
        uint256 _epoch = 0;
        if (_t == block.timestamp) {
            // No need to do binary search, will always live in current epoch
            _epoch = user_point_epoch[addr];
        } else {
            _epoch = find_timestamp_user_epoch(addr, _t, user_point_epoch[addr]);
        }
        
        if (_epoch == 0) {
            return 0;
        } else {
            Point memory last_point = user_point_history[addr][_epoch];
            last_point.bias -= last_point.slope * uint256(_t - last_point.ts);
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
            return uint256(last_point.bias);
        }

        // //some code and actual rerurn is not 1
        // return 1;
    }

    // function balanceOf(address addr, uint256 _t) external view returns (uint256){
    //     /**
    //     @notice Get the current voting power for `msg.sender`
    //     @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
    //     @param addr User wallet address
    //     @param _t Epoch time to return voting power at
    //     @return User voting power
    //     */
    //     uint256 _t = block.timestamp;

    //     //some code and actual rerurn is not 1
    //     return 1;
    // }

    function commit_smart_wallet_checker(address addr) external {}
    function apply_smart_wallet_checker() external {}
    function assert_not_contract(address addr) internal {}    
    function get_last_user_slope(address addr) external view returns (uint256){
        /**
        @notice Get the most recently recorded rate of voting power decrease for `addr`
        @param addr Address of the user wallet
        @return Value of the slope
        */
        uint256 uepoch = user_point_epoch[addr];
        return user_point_history[addr][uepoch].slope;
    }
    function user_point_history__ts(address _addr, uint256 _idx) external view returns (uint256){
        /**
        @notice Get the timestamp for checkpoint `_idx` for `_addr`
        @param _addr User wallet address
        @param _idx User epoch number
        @return Epoch time of the checkpoint
    */
        return user_point_history[_addr][_idx].ts;
    }
    function locked__end(address _addr) external view returns (uint256){
        /**
        @notice Get timestamp when `_addr`'s lock finishes
        @param _addr User wallet
        @return Epoch time of the lock end
        */
        return locked[_addr].end;
    }

    function _checkpoint(address addr, LockedBalance memory old_locked, LockedBalance memory new_locked) internal {}
    function _deposit_for(address _addr, uint256 _value, uint256 unlock_time, LockedBalance memory locked_balance, int128 type_) internal {}
    function checkpoint() external {}
    function deposit_for(address _addr, uint256 _value) external nonReentrant {
        _mint(_addr, _value);
    }

    function create_lock(uint256 tokens) external nonReentrant {
        _mint(msg.sender, tokens);
        // BAL_ERC20(TOKEN).transferFrom(msg.sender, tokens);
    }

    function increase_amount(uint256) external nonReentrant {}
    function increase_unlock_time(uint256 _unlock_time) external nonReentrant {}
    function withdraw() external nonReentrant {}

    // The following ERC20/minime-compatible methods are not real balanceOf and supply!
    // They measure the weights for the purpose of voting, so they don't represent
    // real coins.

    function find_block_epoch(uint256 _block, uint256 max_epoch) internal view returns (uint256){
        /**
        @notice Binary search to find epoch containing block number
        @param _block Block to find
        @param max_epoch Don't go beyond this epoch
        @return Epoch which contains _block
        */

        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        //some code

        return _min;
    }
    function find_timestamp_epoch(uint256 _timestamp, uint256 max_epoch) internal view returns (uint256){
        /**
        @notice Binary search to find epoch for timestamp
        @param _timestamp timestamp to find
        @param max_epoch Don't go beyond this epoch
        @return Epoch which contains _timestamp
        */

        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        //some code
        
        return _min;
    }
    function find_block_user_epoch(address addr, uint256 _block, uint256 max_epoch) internal view returns (uint256){
        /**
        @notice Binary search to find epoch for block number
        @param _addr User for which to find user epoch for
        @param _block Block to find
        @param max_epoch Don't go beyond this epoch
        @return Epoch which contains _block
        */

        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        //some code
        
        return _min;
    }
    function find_timestamp_user_epoch(address addr, uint256 _timestamp, uint256 max_epoch) internal view returns (uint256){
        /**
        @notice Binary search to find user epoch for timestamp
        @param _addr User for which to find user epoch for
        @param _timestamp timestamp to find
        @param max_epoch Don't go beyond this epoch
        @return Epoch which contains _timestamp
        */

        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        //some code
        
        return _min;
    }
    function balanceOf(address addr, uint256 _t) external view returns (uint256){
        /**
        @notice Get the current voting power for `msg.sender`
        @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
        @param addr User wallet address
        @param _t Epoch time to return voting power at
        @return User voting power
        */
        uint256 _t = block.timestamp;

        //some code and actual rerurn is not 1
        return 1;
    }
    function balanceOfAt(address addr, uint256 _block) external view returns (uint256){
        //some code and actual rerurn is not 1
        return 1;
    }
    function supply_at(Point memory p, uint256 t) internal view returns (uint256){
        //some code and actual rerurn is not 1
        return 1;    
    }
    function totalSupply(uint256 t) external view returns (uint256){
        uint256 t = block.timestamp;
        //some code and actual rerurn is not 1
        return 1;    
    }
    function totalSupplyAt(uint256 _block) external view returns (uint256){
        /**
        @notice Calculate total voting power at some point in the past
        @param _block Block to calculate the total voting power at
        @return Total voting power at `_block`
        */

        require(_block <= block.number, "_block > block.number");
        uint256 _epoch = epoch;
        uint256 target_epoch = find_block_epoch(_block, _epoch);

        Point memory point = point_history[target_epoch];
        uint256 dt = 0;
        if (target_epoch < _epoch){
            Point memory point_next = point_history[target_epoch + 1];
            if (point.blk != point_next.blk){
                dt = (_block - point.blk) * (point_next.ts - point.ts) / (point_next.blk - point.blk);
            }
        }else{
            if (point.blk != block.number){
                dt = (_block - point.blk) * (block.timestamp - point.ts) / (block.number - point.blk);
            }
        }
        // Now dt contains info on how far are we beyond point

        return supply_at(point, point.ts + dt);

        //some code and actual return is not 1
        // return 1; 
    }

}


