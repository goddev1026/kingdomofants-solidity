// SPDX-License-Identifier: MIT OR Apache-2.0

/*
W: https://kingdomofants.io 

                ▒▒██            ██▒▒                
                    ██        ██                    
                    ██  ████  ██                    
                    ████▒▒▒▒████                    
████              ██▒▒▒▒▒▒▒▒▒▒▒▒██              ████
██▒▒██            ██▒▒██▒▒▒▒██▒▒██            ██▒▒██
██▒▒██            ██▒▒██▒▒▒▒██▒▒██            ██▒▒██
  ██              ██▒▒▒▒▒▒▒▒▒▒▒▒██              ██  
    ██            ██▒▒██▒▒▒▒██▒▒██            ██    
      ██          ▓▓▒▒▒▒████▒▒▒▒██          ██      
        ██          ████████████          ██        
          ██          ██▒▒▒▒██          ██          
            ██████████▒▒▒▒▒▒▒▒██████████            
                    ██▒▒▒▒▒▒▒▒██                    
          ████████████▒▒▒▒▒▒▒▒████████████          
        ██          ██▒▒▒▒▒▒▒▒██          ██        
      ██            ██▒▒▒▒▒▒▒▒██            ██      
    ██            ████▒▒▒▒▒▒▒▒████            ██    
  ██            ██    ████████    ██            ██  
██▒▒██        ██    ██▒▒▒▒▒▒▒▒██    ██        ██▒▒██
██▒▒██      ██      ██▒▒▒▒▒▒▒▒██      ██      ██▒▒██
████      ██        ██▒▒▒▒▒▒▒▒██        ██      ████
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██          ██▒▒▒▒▒▒▒▒██          ██        
        ██            ██▒▒▒▒██            ██        
      ████            ██▒▒▒▒██            ████      
    ██▒▒██              ████              ██▒▒██    
    ██████                                ██████    

* Howdy folks! Thanks for glancing over our contracts
* Y'all have a nice day! Enjoy the game
*/

pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './interfaces/IANTCoin.sol';
import './interfaces/IANTShop.sol';

contract FoodGathering is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    using SafeMath for uint256;

    struct StakeInfo{
        uint256 stakedAmount; // how many staked tokens the uer has provided
        uint256 stakedTimestamp; // deposit timestamp
        uint256 rewardDebt; // Reward Debt 
    }

    // Reference to ANTCoin
    IANTCoin public antCoin;
    // Reference to ANTFood
    IANTShop public antShop;
    // minters
    mapping(address => bool) private minters;
    // staked information for each user
    mapping (address => StakeInfo) public stakedInfo;
    
    uint256 public PRECISION;
    // ant food token id
    uint256 public antFoodTokenId;
    // ant coin stake fee amount
    uint256 public stakeFeeAmount;
    // max amount to stake
    uint256 public maxAmountForStake;
    // one cycle stake amount
    uint256 public cycleStakedAmount;
    // one cycle time stamp
    uint256 public cycleTimestamp;

    constructor() {
    }

     function initialize(IANTCoin _antCoin, IANTShop _antShop) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        antCoin = _antCoin;
        antShop = _antShop;

        PRECISION = 1000;
        antFoodTokenId = 0;
        stakeFeeAmount = 1000 * 10**18; // 1k ANT Coin
        maxAmountForStake = 900000 * 10**18; // 900k ANT Coin
        cycleStakedAmount = 30000 * 10**18; // 30k ANT Coin
        cycleTimestamp = 24 hours;
    }

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "FoodGathering: Caller is not the owner or minter");
        _;
    }

    // food fathering stake event
    event FoodGatheringStaked(address _staker, uint256 _antCStakeAmount);
    // food fathering unStake event
    event FoodGatheringUnStaked(address _staker, uint256 _antCStakeAmount, uint256 _rewardANTFoodAmount);

    /**
    * ██ ███    ██ ████████
    * ██ ████   ██    ██
    * ██ ██ ██  ██    ██
    * ██ ██  ██ ██    ██
    * ██ ██   ████    ██
    * This section has internal only functions
    */

    /**
    * @notice       Transfer ETH and return the success status.
    * @dev          This function only forwards 30,000 gas to the callee.
    * @param to     Address for ETH to be send to
    * @param value  Amount of ETH to send
    */
    function _safeTransferETH(address to, uint256 value) internal returns (bool) {
        (bool success, ) = to.call{ value: value, gas: 30_000 }(new bytes(0));
        return success;
    }

    /**
    * ███████ ██   ██ ████████
    * ██       ██ ██     ██
    * █████     ███      ██
    * ██       ██ ██     ██
    * ███████ ██   ██    ██
    * This section has external functions
    */

    /**
    * @notice Check address has minterRole
    */

    function getMinterRole(address _address) public view returns(bool) {
        return minters[_address];
    }

    /**
    * @notice Return staked information of staker including antc staked amount, stake timestamp, etc
    */

    function getStakedInfo(address _staker) external view returns(StakeInfo memory) {
        return stakedInfo[_staker];
    }

    /**
    * @notice Return ant food reward amount 1,000 = 1 ANT Food
    */

    function pendingRewardByAddress(address _staker) public view returns(uint256) {
        uint256 stakedPeriod = block.timestamp - stakedInfo[_staker].stakedTimestamp;
        return stakedPeriod * stakedInfo[_staker].stakedAmount * PRECISION / (cycleTimestamp * cycleStakedAmount) + stakedInfo[_staker].rewardDebt;
    }

    /**
    * @notice               Function to stake ant coin amount for getting ant food reward
    * @dev                  need to pay ant coin stake fee amount
    * @param _antCAmount    ant coin stake amount
    */

    function stake(uint256 _antCAmount) external whenNotPaused nonReentrant {
        StakeInfo storage staked = stakedInfo[_msgSender()];
        uint256 senderBalance = antCoin.balanceOf(_msgSender());
        require(senderBalance >= _antCAmount + stakeFeeAmount, "FoodGathering: you don't have enough ant coin balance for staking");
        require(staked.stakedAmount + _antCAmount <= maxAmountForStake, "FoodGathering: your staking amount exceeds the maximum staking amount limit.");

        uint256 pendingReward = staked.stakedAmount > 0 ? pendingRewardByAddress(_msgSender()) : 0;
        uint256 totalStaked = staked.stakedAmount + _antCAmount;

        staked.rewardDebt += pendingReward;
        staked.stakedAmount = totalStaked;
        staked.stakedTimestamp = block.timestamp;

        antCoin.transferFrom(_msgSender(), address(this), _antCAmount);
        antCoin.burn(_msgSender(), stakeFeeAmount);

        emit FoodGatheringStaked(_msgSender(), totalStaked);
    }

    /**
    * @notice Function to unStake staked tokens for ant food rewards
    */

    function unStake() external whenNotPaused nonReentrant {
        StakeInfo storage staked = stakedInfo[_msgSender()];
        uint256 stakedAmount = staked.stakedAmount;
        require(stakedAmount > 0, "FoodGathering: You didn't stake any amount of ant coins");
        
        uint256 rewardAmount = pendingRewardByAddress(_msgSender());
        
        delete stakedInfo[_msgSender()];

        if (rewardAmount > 0) {
            antShop.mint(antFoodTokenId, rewardAmount.div(PRECISION), _msgSender());
        }

        if (stakedAmount > 0) {
            antCoin.transfer(_msgSender(), stakedAmount);
        }
        
        emit FoodGatheringUnStaked(_msgSender(), stakedAmount, rewardAmount.div(PRECISION));
    }

    /**
    *   ██████  ██     ██ ███    ██ ███████ ██████
    *  ██    ██ ██     ██ ████   ██ ██      ██   ██
    *  ██    ██ ██  █  ██ ██ ██  ██ █████   ██████
    *  ██    ██ ██ ███ ██ ██  ██ ██ ██      ██   ██
    *   ██████   ███ ███  ██   ████ ███████ ██   ██
    * This section will have all the internals set to onlyOwner
    */

    /**
    * @notice                   Function to set staking fee amount.
    * @dev                      This function can only be called by the owner
    * @param _stakeFeeAmount    staking fee amount
    */
    function setStakeFeeAmount(uint256 _stakeFeeAmount) external onlyMinterOrOwner {
        stakeFeeAmount = _stakeFeeAmount;
    }

    /**
    * @notice                       Function to set max staking amount.
    * @dev                          This function can only be called by the owner
    * @param _maxAmountForStake     max staking amount
    */
    function setMaxAmountForStake(uint256 _maxAmountForStake) external onlyMinterOrOwner {
        maxAmountForStake = _maxAmountForStake;
    }

    /**
    * @notice                       Function to set one cycle amount for reward
    * @dev                          This function can only be called by the owner
    * @param _cycleStakedAmount     one cycle staked amount
    */
    function setCycleStakedAmount(uint256 _cycleStakedAmount) external onlyMinterOrOwner {
        cycleStakedAmount = _cycleStakedAmount;
    }

    /**
    * @notice                   Function to set one cycle duration for reward
    * @dev                      This function can only be called by the owner
    * @param _cycleTimestamp    one cycle staked duration
    */
    function setCycleTimestamp(uint256 _cycleTimestamp) external onlyMinterOrOwner {
        cycleTimestamp = _cycleTimestamp;
    }

    /**
    * @notice                   Function to set ant food token id
    * @dev                      This function can only be called by the owner
    * @param _antFoodTokenId    ant food token id
    */

    function setANTFoodTokenId(uint256 _antFoodTokenId) external onlyMinterOrOwner {
        antFoodTokenId = _antFoodTokenId;
    }

    /**
    * @notice           Function to set ant coin contract address
    * @dev              This function can only be called by the owner
    * @param _antCoin   ant coin contract address
    */
    function setANTCoinContract(IANTCoin _antCoin) external onlyMinterOrOwner {
        antCoin = _antCoin;
    }

    /**
    * @notice           Function to set ant shop contract address
    * @dev              This function can only be called by the owner
    * @param _antShop   ant shop contract address
    */
    function setANTShopContract(IANTShop _antShop) external onlyMinterOrOwner {
        antShop = _antShop;
    }

    /**
    * @notice           Function to grant mint role
    * @dev              This function can only be called by the owner
    * @param _address   address to get minter role
    */
    function addMinterRole(address _address) external onlyOwner {
        minters[_address] = true;
    }

    /**
    * @notice           Function to revoke mint role
    * @dev              This function can only be called by the owner
    * @param _address   address to revoke minter role
    */
    function revokeMinterRole(address _address) external onlyOwner {
        minters[_address] = false;
    }

    /**
    * enables owner to pause / unpause contract
    */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /**
    * @notice           Allows owner to withdraw ETH funds to an address
    * @dev              wraps _user in payable to fix address -> address payable
    * @param to         Address for ETH to be send to
    * @param amount     Amount of ETH to send
    */
    function withdraw(address payable to, uint256 amount) public onlyOwner {
        require(_safeTransferETH(to, amount));
    }

    /**
    * @notice                   Allows ownder to withdraw any accident tokens transferred to contract
    * @param _tokenContract     token smart contract address for withraw
    * @param to                 wallet address for token to be send to
    * @param amount             withdraw token amount
    */
    function withdrawToken(
        address _tokenContract,
        address to,
        uint256 amount
    ) public onlyOwner {
        IERC20 tokenContract = IERC20(_tokenContract);
        tokenContract.transfer(to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}