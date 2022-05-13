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

    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);
    event AddType(string name, int128 type_id);
    event NewTypeWeight(int128 type_id, uint256 time, uint256 weight, uint256 total_weight);
    event NewGaugeWeight(address gauge_address, uint256 time, uint256 weight, uint256 total_weight);
    event VoteForGauge(uint256 time, address user, address gauge_addr, uint256 weight);
    event NewGauge(address addr, int128 gauge_type, uint256 weight);

    uint256 constant MULTIPLIER = 10 ** 18;

    address public admin;
    address public future_admin;
    address public token;
    address public voting_escrow;

    // Gauge parameters
    // All numbers are "fixed point" on the basis of 1e18
    int128 public n_gauge_types;
    int128 public n_gauges;
    mapping(string => int128) public gauge_type_names;
    // Needed for enumeration
    address[1000000000] public gauges;
    // we increment values by 1 prior to storing them here so we can rely on a value
    // of zero as meaning the gauge has not been set
    mapping(address => int128) public gauge_types_;
    mapping(address => mapping(address => VotedSlope)) public vote_user_slopes; // user -> gauge_addr -> VotedSlope
    mapping(address => uint256) public vote_user_power; // Total vote power used by user
    mapping(string => mapping(address => uint256)) public last_user_vote; // Last user vote's timestamp for each gauge address

    // Past and scheduled points for gauge weight, sum of weights per type, total weight
    // Point is for bias+slope
    // changes_* are for changes in slope
    // time_* are for the last change timestamp
    // timestamps are rounded to whole weeks

    mapping(address => mapping(address => Point)) public points_weight; // gauge_addr -> time -> Point
    mapping(address => mapping(uint256 => uint256)) public changes_weight; // gauge_addr -> time -> slope
    mapping(address => uint256) public time_weight; // gauge_addr -> last scheduled time (next week)
    mapping(int128 => mapping(uint256 => Point)) public points_sum; // type_id -> time -> Point
    mapping(int128 => mapping(uint256 => uint256)) public changes_sum; // type_id -> time -> slope
    uint256[1000000000] public time_sum; // type_id -> last scheduled time (next week)
    mapping(uint256 => uint256) public points_total; // time -> total weight
    uint256 public time_total; //last scheduled time
    mapping(int128 => mapping(uint256 => uint256)) public points_type_weight; // type_id -> time -> type weight
    uint256[1000000000] public time_type_weight; // type_id -> last scheduled time (next week)







}