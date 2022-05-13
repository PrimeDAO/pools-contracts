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

    struct VotedSlope{
        uint256 slope; 
        uint256 power;
        uint256 end;
    }  

    // 7 * 86400 seconds - all future times are rounded by week
    uint256 constant WEEK = 604800;
    // Cannot change weight votes more often than once in 10 days
    uint256 constant WEIGHT_VOTE_DELAY = 10 * 86400;
    uint256 constant MULTIPLIER = 10 ** 18;
    address constant ZERO_ADDRESS = address(0x0000000000000000000000000000000000000000);

    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);
    event AddType(string name, int128 type_id);
    event NewTypeWeight(int128 type_id, uint256 time, uint256 weight, uint256 total_weight);
    event NewGaugeWeight(address gauge_address, uint256 time, uint256 weight, uint256 total_weight);
    event VoteForGauge(uint256 time, address user, address gauge_addr, uint256 weight);
    event NewGauge(address addr, int128 gauge_type, uint256 weight);

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


    //__init__
    constructor(
        address _token,
        address _voting_escrow
    ) public {
        /**
        @notice Contract constructor
        @param _token `ERC20CRV` contract address
        @param _voting_escrow `VotingEscrow` contract address
        */
        require(_token != ZERO_ADDRESS, "GaugeControllerMock: _token == ZERO_ADDRESS");
        require(_voting_escrow != ZERO_ADDRESS, "GaugeControllerMock: _voting_escrow == ZERO_ADDRESS");

        admin = msg.sender;
        token = _token;
        voting_escrow = _voting_escrow;
        time_total = block.timestamp / WEEK * WEEK;
    }

    function commit_transfer_ownership(address addr) external {
        /**
        @notice Transfer ownership of GaugeController to `addr`
        @param addr Address to have ownership transferred to
        */
        require(msg.sender == admin, "GaugeControllerMock: admin only"); //dev: admin only
        future_admin = addr;
        emit CommitOwnership(addr);
    }
    function apply_transfer_ownership() external {
        /**
        @notice Apply pending ownership transfer
        */
        require(msg.sender == admin, "GaugeControllerMock: admin only"); //dev: admin only
        address _admin = future_admin;
        require(_admin != ZERO_ADDRESS, "GaugeControllerMock: _admin != ZERO_ADDRESS"); //dev: admin only
        admin = _admin;
        emit ApplyOwnership(_admin);
    }
    function gauge_types(address _addr) external view returns (int128) {
        /**
        @notice Get gauge type for address
        @param _addr Gauge address
        @return Gauge type id
        */
        int128 gauge_type = gauge_types_[_addr];
        require(gauge_type != 0, "GaugeControllerMock: gauge_type != 0");

        return gauge_type - 1;
    }
    function _get_type_weight(int128 gauge_type) internal returns (uint256) {
        /**
        @notice Fill historic type weights week-over-week for missed checkins
                and return the type weight for the future week
        @param gauge_type Gauge type id
        @return Type weight
        */
        uint256 t = time_type_weight[gauge_type];
        if (t > 0) {
            uint256 w = points_type_weight[gauge_type][t];
            for (uint256 i = 0; i < 500; i++){
                if (t > block.timestamp){
                    break;
                }
                t += WEEK;
                points_type_weight[gauge_type][t] = w;
                if (t > block.timestamp){
                    time_type_weight[gauge_type] = t;
                }
            }
            return w;
        } else{
            return 0;
        }
    }
    function _get_sum(int128 gauge_type) internal returns (uint256) {
        /**
        @notice Fill sum of gauge weights for the same type week-over-week for
                missed checkins and return the sum for the future week
        @param gauge_type Gauge type id
        @return Sum of weights
        */
        uint256 t = time_sum[gauge_type];
        if (t > 0) {
            Point pt = points_sum[gauge_type][t];
            for (uint256 i = 0; i < 500; i++){
                if (t > block.timestamp) {
                    break;
                }
                t += WEEK;
                uint256 d_bias = pt.slope * WEEK;
                if (pt.bias > d_bias) {
                    pt.bias -= d_bias;
                    uint256 d_slope = self.changes_sum[gauge_type][t];
                    pt.slope -= d_slope;
                } else {
                    pt.bias = 0;
                    pt.slope = 0;
                }
                points_sum[gauge_type][t] = pt;
                if (t > block.timestamp) {
                    time_sum[gauge_type] = t;
                }
            }
            return pt.bias;
        } else {
            return 0;
        }
    }
    function _get_total() internal returns (uint256) {
        /**
        @notice Fill historic total weights week-over-week for missed checkins
                and return the total for the future week
        @return Total weight
        */
        uint256 t = time_total;
        int128 _n_gauge_types = n_gauge_types;

        if (t > block.timestamp) {
            // If we have already checkpointed - still need to change the value
            t -= WEEK;            
        }
        uint256 pt = points_total[t];

        for (uint256 gauge_type = 0; gauge_type < 100; gauge_type++){
            if (gauge_type == _n_gauge_types) {
                break;
            }
            _get_sum(gauge_type);
            _get_type_weight(gauge_type);
        }

        for (uint256 i = 0; i < 500; i++){
            if (t > block.timestamp) {
                break;
            }
            t += WEEK;
            pt = 0;
            // Scales as n_types * n_unchecked_weeks (hopefully 1 at most)
            for (uint256 gauge_type = 0; gauge_type < 100; gauge_type++){
                if (gauge_type == _n_gauge_types) {
                    break;
                }
                uint256 type_sum = points_sum[gauge_type][t].bias;
                uint256 type_weight = points_type_weight[gauge_type][t];
                pt += type_sum * type_weight;
            }
            points_total[t] = pt;

            if (t > block.timestamp) {
                time_total = t;
            }
        }
        return pt;
    }
    function _get_weight(address gauge_addr) internal returns (uint256) {
        /**
        @notice Fill historic gauge weights week-over-week for missed checkins
                and return the total for the future week
        @param gauge_addr Address of the gauge
        @return Gauge weight
        */
        uint256 t = time_weight[gauge_addr];

        if (t > 0) {
            Point pt = points_weight[gauge_addr][t];
            for (uint256 i = 0; i < 500; i++){
                if (t > block.timestamp) {
                    break;
                }
                t += WEEK;
                uint256 d_bias = pt.slope * WEEK;
                // Scales as n_types * n_unchecked_weeks (hopefully 1 at most)
                if (pt.bias > d_bias) {
                    pt.bias -= d_bias;
                    uint256 d_slope = changes_weight[gauge_addr][t];
                    pt.slope -= d_slope;
                } else {
                    pt.bias = 0;
                    pt.slope = 0;
                }
                points_weight[gauge_addr][t] = pt;
                if (t > block.timestamp) {
                    time_weight[gauge_addr] = t;
                }
            }
            return pt.bias;
        } else {
            return 0;
        }
    }

    // in original code uint256 weight = 0 by default
    // but Solidity does not support default parameters
    function add_gauge(address addr, int256 gauge_type, uint256 weight) external {
        /**
        @notice Add gauge `addr` of type `gauge_type` with weight `weight`
        @param addr Gauge address
        @param gauge_type Gauge type
        @param weight Gauge weight
        */
        require(msg.sender == admin, "GaugeControllerMock: msg.sender == admin,");
        require((gauge_type >= 0) && (gauge_type < n_gauge_types), "GaugeControllerMock: (gauge_type >= 0) && (gauge_type < n_gauge_types)");
        require(gauge_types_[addr] == 0, "GaugeControllerMock: gauge_types_[addr] == 0"); //dev: cannot add the same gauge twice

        int128 n = n_gauges;
        n_gauges = n + 1;
        gauges[n] = addr;

        gauge_types_[addr] = gauge_type + 1;
        uint256 next_time = (block.timestamp + WEEK) / WEEK * WEEK;

        if (weight > 0) {
            uint256 _type_weight = _get_type_weight(gauge_type);
            uint256 _old_sum = _get_sum(gauge_type);
            uint256 _old_total = _get_total();

            points_sum[gauge_type][next_time].bias = weight + _old_sum;
            time_sum[gauge_type] = next_time;
            points_total[next_time] = _old_total + _type_weight * weight;
            time_total = next_time;

            points_weight[addr][next_time].bias = weight;
        }

        if (time_sum[gauge_type] == 0) {
            time_sum[gauge_type] = next_time;
        }
        time_weight[addr] = next_time;

        emit NewGauge(addr, gauge_type, weight);
    }
    function checkpoint() external {
        /**
        @notice Checkpoint to fill data common for all gauges
        */
        _get_total();
    }
    function checkpoint_gauge(address addr) external {
        /**
        @notice Checkpoint to fill data for both a specific gauge and common for all gauges
        @param addr Gauge address
        */
        _get_weight(addr);
        _get_total();
    }
    function _gauge_relative_weight(address addr, uint256 time) internal view {
        /**
        @notice Get Gauge relative weight (not more than 1.0) normalized to 1e18
            (e.g. 1.0 == 1e18). Inflation which will be received by it is
            inflation_rate * relative_weight / 1e18
        @param addr Gauge address
        @param time Relative weight at the specified timestamp in the past or present
        @return Value of relative weight normalized to 1e18
        */
        uint256 t = time / WEEK * WEEK;
        uint256 _total_weight = points_total[t];

        if (_total_weight > 0) {
            int128 gauge_type = gauge_types_[addr] - 1;
            uint256 _type_weight = points_type_weight[gauge_type][t];
            uint256 _gauge_weight = points_weight[addr][t].bias;
            return MULTIPLIER * _type_weight * _gauge_weight / _total_weight;
        } else {
            return 0;
        }
    }

    //in original code uint256 time = block.timestamp by default
    function gauge_relative_weight(address addr, uint256 time) external view returns (uint256) {
        /**
        @notice Get Gauge relative weight (not more than 1.0) normalized to 1e18
                (e.g. 1.0 == 1e18). Inflation which will be received by it is
                inflation_rate * relative_weight / 1e18
        @param addr Gauge address
        @param time Relative weight at the specified timestamp in the past or present
        @return Value of relative weight normalized to 1e18
        */
        return _gauge_relative_weight(addr, time);
    }

    //in original code uint256 time = block.timestamp by default
    function gauge_relative_weight_write(address addr, uint256 time) external returns (uint256) {
        /**
        @notice Get gauge weight normalized to 1e18 and also fill all the unfilled
                values for type and gauge records
        @dev Any address can call, however nothing is recorded if the values are filled already
        @param addr Gauge address
        @param time Relative weight at the specified timestamp in the past or present
        @return Value of relative weight normalized to 1e18
        */
        _get_weight(addr);
        _get_total();  // Also calculates get_sum
        return _gauge_relative_weight(addr, time);
    }
    function _change_type_weight(int256 type_id, uint256 weight) internal {
        /**
         @notice Change type weight
        @param type_id Type id
        @param weight New type weight
        */
        uint256 old_weight = _get_type_weight(type_id);
        uint256 old_sum = _get_sum(type_id);
        uint256 _total_weight = _get_total();
        uint256 next_time = (block.timestamp + WEEK) / WEEK * WEEK;

        _total_weight = _total_weight + old_sum * weight - old_sum * old_weight;
        points_total[next_time] = _total_weight;
        points_type_weight[type_id][next_time] = weight;
        time_total = next_time;
        time_type_weight[type_id] = next_time;

        emit NewTypeWeight(type_id, next_time, weight, _total_weight);
    }
    function add_type(string _name, uint256 weight) external {
        /**
        @notice Add gauge type with name `_name` and weight `weight`
        @param _name Name of gauge type
        @param weight Weight of gauge type
        */
        require(msg.sender == admin, "GaugeControllerMock: msg.sender == admin,");
        int128 type_id = n_gauge_types;
        gauge_type_names[type_id] = _name;
        n_gauge_types = type_id + 1;
        if (weight != 0) {
            _change_type_weight(type_id, weight);
            emit AddType(_name, type_id);
        }
    }
    function change_type_weight(int256 type_id, uint256 weight) external {
        /**
        @notice Change gauge type `type_id` weight to `weight`
        @param type_id Gauge type id
        @param weight New Gauge weight
        */
        require(msg.sender == admin, "GaugeControllerMock: msg.sender == admin,");
        _change_type_weight(type_id, weight);
    }

}