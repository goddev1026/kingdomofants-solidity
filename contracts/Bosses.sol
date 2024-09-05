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
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './interfaces/IANTCoin.sol';
import './interfaces/IBasicANT.sol';
import './interfaces/IPremiumANT.sol';
import './interfaces/IRandomizer.sol';

contract Bosses is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    
    using SafeMath for uint256;
    
    // stake information for ANT
    struct StakeANT {
        uint256 tokenId; // ant token id
        address owner; // owner of staked ant
        uint256 originTimestamp; // staked timestamp
        uint256 rewardIndex; // reward Index 0 = Common, 1 = Uncommon, 2 = Rare, 3 = Ultra rare, 4 => Legendary
        uint256 stakeAmount; // ant coin staked amount
        uint256 lockPeriod; // ant lock period in the pool
    }

    // Bosses Pools Info
    struct BossesPool {
        string poolName; // Bosses Pool Name. e.g. Snail
        uint256 rewardAPY; // ANTCoin Reward APY Percentage
        uint256 drainedLevel; // ANT Drain Level after unstaking
        uint256 levelRequired; // Level Required for Pool
    }

    // Reference to randomizer
    IRandomizer public randomizer;
    // Reference to ANTCoin
    IANTCoin public antCoin;
    // Reference to PremiumANT
    IPremiumANT public premiumANT;
    // Reference to BasicANT
    IBasicANT public basicANT;

    // minters
    mapping(address => bool) private minters;
    // Bosses Pools Struct array
    BossesPool[] public bossesPools;
    // Bosses for Basic ANT
    mapping(uint256 => StakeANT) public basicANTBosses;
    // Bosses for Premium ANT
    mapping(uint256 => StakeANT) public premiumANTBosses;
    // staked token id array for Basic ANT
    mapping(address => uint256[]) public basicANTStakedNFTs;
    // staked token id array for Premium ANT
    mapping(address => uint256[]) public premiumANTStakedNFTs;
    // array indices of each token id for Basic ANT
    mapping(uint256 => uint256) public basicANTStakedNFTsIndicies;
    // array indices of each token id for Premium ANT
    mapping(uint256 => uint256) public premiumANTStakedNFTsIndicies;
    // total number of staked Basic ANTs
    uint256 public totalBasicANTStaked;
    // total number of staked Premium ANTs
    uint256 public totalPremiumANTStaked;
    // ant coin stake limit amount
    uint256 public limitANTCoinStakeAmount;
    // stake period timestamp
    uint256 public stakePeriod;
    // staked ant coin burn percentage if user unstake the ants early
    uint256 public burnRate;

    // Events
    // basic ant stake event
    event BossesStakeBasicANT(uint256 id, address owner);
    // basic ant unstake event
    event BossesUnStakeBasicANT(uint256 id, address owner);
    // premium ant stake event
    event BossesStakePremiumANT(uint256 id, address owner);
    // premium ant unstake event
    event BossesUnStakePremiumANT(uint256 id, address owner);
    
    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "Bosses: Caller is not the owner or minter");
        _;
    }

    constructor() {
    }

    function initialize(IRandomizer _randomizer, IANTCoin _antCoin, IPremiumANT _premiumANT, IBasicANT _basicANT) initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        randomizer = _randomizer;
        antCoin = _antCoin;
        premiumANT = _premiumANT;
        basicANT = _basicANT;
        minters[_msgSender()] = true;

        limitANTCoinStakeAmount = 60000 ether;
        stakePeriod = 30 days;
        burnRate = 20;
    }

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
    * @notice Return the random index of pools by ant level
    */

    function _getRandomIndexOfPoolsByLevel(uint256 _antLevel, uint256 _tokenId) internal view returns(uint256) {

        uint256 matchedCount = 0;

        for(uint256 i = 0; i < bossesPools.length; i++) {
            BossesPool memory _pool = bossesPools[i];
            if(_pool.levelRequired <= _antLevel) {
                matchedCount++;
            }
        }

        uint256 randomIndex = randomizer.randomToken(_tokenId * _antLevel) % matchedCount;
        return randomIndex;
    }

    /**
    * @notice Return ant coin earning reward based on stake amount & apy
    */

    function _calculateReward(uint256 _stakeAmount, uint256 _apy) internal pure returns(uint256) {
        return _stakeAmount.mul(_apy).div(100);
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
    * @notice Return Premium ANT Stake information
    */

    function getPremiumANTStakeInfo(uint256 _tokenId) external view returns(StakeANT memory) {
        return premiumANTBosses[_tokenId];
    }

    /**
    * @notice Return Premium ANT Stake information array
    */

    function getPremiumANTMultiStakeInfo(uint256[] calldata tokenIds) external view returns(StakeANT[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new StakeANT[](0);
        }

        StakeANT[] memory stakedInfo = new StakeANT[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            stakedInfo[i] = premiumANTBosses[tokenIds[i]];
        }

        return stakedInfo;
    }

    /**
    * @notice Return Basic ANT Stake information
    */

    function getBasicANTStakeInfo(uint256 _tokenId) external view returns(StakeANT memory) {
        return basicANTBosses[_tokenId];
    }

    /**
    * @notice Return Basic ANT Stake information array
    */

    function getBasicANTMultiStakeInfo(uint256[] calldata tokenIds) external view returns(StakeANT[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new StakeANT[](0);
        }

        StakeANT[] memory stakedInfo = new StakeANT[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            stakedInfo[i] = basicANTBosses[tokenIds[i]];
        }

        return stakedInfo;
    }

    /**
    * @notice       Return Staked Premium ANTs token ids
    * @param _owner user address to get the staked premium ant token ids
    */

    function getPremiumANTStakedByAddress(address _owner) public view returns(uint256[] memory) {
        return premiumANTStakedNFTs[_owner];
    }

    /**
    * @notice       Return Staked Basic ANTs token ids
    * @param _owner user address to get the staked basic ant token ids
    */

    function getBasicANTStakedByAddress(address _owner) public view returns(uint256[] memory) {
        return basicANTStakedNFTs[_owner];
    }

    /**
    * @notice           Return Bosses Pool Info by pool index
    * @param _poolIndex pool index
    */

    function getBossesPoolInfoByIndex(uint256 _poolIndex) external view returns(BossesPool memory) {
        require(_poolIndex < bossesPools.length, "Bosses: invalid pool index");
        return bossesPools[_poolIndex];
    }

    /**
    * @notice               Return Bosses Pool Info array by pool indexs
    * @param poolIndexArray pool index array
    */

    function getBossesPoolMultiInfoByIndex(uint256[] calldata poolIndexArray) external view returns(BossesPool[] memory) {
        uint256 poolIndexLengh = poolIndexArray.length;
        if (poolIndexLengh == 0) {
            return new BossesPool[](0);
        }

        BossesPool[] memory bossesPoolInfos = new BossesPool[](poolIndexLengh);
        for(uint256 i = 0; i < poolIndexLengh; i++) {
            require(poolIndexArray[i] < bossesPools.length, "Bosses: invalid pool index");
            bossesPoolInfos[i] = bossesPools[poolIndexArray[i]];
        }
        return bossesPoolInfos;
    }

    /**
    * @notice           Return Bosses tokens earning reward amount array
    * @param tokenIds   premium ant token ids array
    */

    function pendingRewardMultiPremiumANT(uint256[] calldata tokenIds) external view returns(uint256[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory pendingRewards = new uint256[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            StakeANT memory _stakeANTInfo = premiumANTBosses[tokenIds[i]];
            BossesPool memory _bossesPool = bossesPools[_stakeANTInfo.rewardIndex];
            uint256 stakeAmount = _stakeANTInfo.stakeAmount;
            uint256 earningReward = _calculateReward(stakeAmount, _bossesPool.rewardAPY);
            pendingRewards[i] = earningReward;
        }

        return pendingRewards;
    }

    /**
    * @notice           Return Bosses tokens earning reward amount array
    * @param tokenIds   basic ant token ids array
    */

    function pendingRewardMultiBasicANT(uint256[] calldata tokenIds) external view returns(uint256[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory pendingRewards = new uint256[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            StakeANT memory _stakeANTInfo = basicANTBosses[tokenIds[i]];
            BossesPool memory _bossesPool = bossesPools[_stakeANTInfo.rewardIndex];
            uint256 stakeAmount = _stakeANTInfo.stakeAmount;
            uint256 earningReward = _calculateReward(stakeAmount, _bossesPool.rewardAPY);
            pendingRewards[i] = earningReward;
        }

        return pendingRewards;
    }

    /**
    * @notice           Stake PremiumANT into Bosses Pool with ANTCoin Stake Amount
    * @param _tokenId   premium ant token id for stake
    */

    function stakePremiumANT(uint256 _tokenId, uint256 _antCAmount) external whenNotPaused nonReentrant {
        require(premiumANT.ownerOf(_tokenId) == _msgSender(), 'Bosses: you are not owner of this token');
        require(_antCAmount > 0, "Bosses: stake amount should be >= 0");
        require(_antCAmount <= limitANTCoinStakeAmount, 'Bosses: ant coin stake amount exceed the limit amount');
        require(antCoin.balanceOf(_msgSender()) >= _antCAmount, 'Bosses: insufficient ant coin balance');
        require(bossesPools.length > 0, "Bosses: bosses pools info has not been set yet");
        IPremiumANT.ANTInfo memory _premiumANTInfo = premiumANT.getANTInfo(_tokenId);
        require(_premiumANTInfo.level >= bossesPools[0].levelRequired, "Bosses: ant level must be greater than the minimum required pool level");

        uint256 _randomRewardIndex = _getRandomIndexOfPoolsByLevel(_premiumANTInfo.level, _tokenId);
        premiumANTBosses[_tokenId] = StakeANT({
            tokenId: _tokenId,
            owner: _msgSender(),
            originTimestamp: block.timestamp,
            rewardIndex: _randomRewardIndex,
            stakeAmount: _antCAmount,
            lockPeriod: stakePeriod
        });

        premiumANTStakedNFTs[_msgSender()].push(_tokenId);
        premiumANTStakedNFTsIndicies[_tokenId] = premiumANTStakedNFTs[_msgSender()].length - 1;
        totalPremiumANTStaked++;
        premiumANT.transferFrom(_msgSender(), address(this), _tokenId);
        antCoin.transferFrom(_msgSender(), address(this), _antCAmount);

        emit BossesStakePremiumANT(_tokenId, _msgSender());
    }

    /**
    * @notice           Stake BasicANT into Bosses Pool with ANTCoin stake amount
    * @param _tokenId   basic ant token id for stake
    */

    function stakeBasicANT(uint256 _tokenId, uint256 _antCAmount) external whenNotPaused nonReentrant {
        require(basicANT.ownerOf(_tokenId) == _msgSender(), 'Bosses: you are not owner of this token');
        require(_antCAmount > 0, "Bosses: stake amount should be >= 0");
        require(_antCAmount <= limitANTCoinStakeAmount, 'Bosses: ant coin stake amount exceed the limit amount');
        require(antCoin.balanceOf(_msgSender()) >= _antCAmount, 'Bosses: insufficient ant coin balance');
        require(bossesPools.length > 0, "Bosses: bosses pools info has not been set yet");
        IBasicANT.ANTInfo memory _basicANTInfo = basicANT.getANTInfo(_tokenId);
        require(_basicANTInfo.level >= bossesPools[0].levelRequired, "Bosses: ant level must be greater than the minimum required pool level");

        uint256 _randomRewardIndex = _getRandomIndexOfPoolsByLevel(_basicANTInfo.level, _tokenId);
        basicANTBosses[_tokenId] = StakeANT({
            tokenId: _tokenId,
            owner: _msgSender(),
            originTimestamp: block.timestamp,
            rewardIndex: _randomRewardIndex,
            stakeAmount: _antCAmount,
            lockPeriod: stakePeriod
        });
        
        basicANTStakedNFTs[_msgSender()].push(_tokenId);
        basicANTStakedNFTsIndicies[_tokenId] = basicANTStakedNFTs[_msgSender()].length - 1;
        totalBasicANTStaked++;
        basicANT.transferFrom(_msgSender(), address(this), _tokenId);
        antCoin.transferFrom(_msgSender(), address(this), _antCAmount);
        
        emit BossesStakeBasicANT(_tokenId, _msgSender());
    }

    /**
    * @notice           UnStake PremiumANT from Bosses Pool with earning rewards
    *                   if you unstake ant early, you will lose 20% of ant coin staked amount
    * @param _tokenId   premium ant token id for unStake
    */

    function unStakePremiumANT(uint256 _tokenId) external whenNotPaused nonReentrant {
        StakeANT memory _stakeANTInfo = premiumANTBosses[_tokenId];
        uint256 _stakedPeriod = block.timestamp - _stakeANTInfo.originTimestamp;
        require(_stakeANTInfo.owner == _msgSender(), 'Bosses: you are not owner of this premium ant');

        if(_stakedPeriod < _stakeANTInfo.lockPeriod) {
            // early unStake
            uint256 burnAmount = _stakeANTInfo.stakeAmount * burnRate / 100;
            antCoin.burn(address(this), burnAmount);
            antCoin.transfer(_stakeANTInfo.owner, _stakeANTInfo.stakeAmount - burnAmount);
        } else {
            BossesPool memory _bossesPool = bossesPools[_stakeANTInfo.rewardIndex];
            uint256 stakeAmount = _stakeANTInfo.stakeAmount;
            uint256 earningReward = _calculateReward(stakeAmount, _bossesPool.rewardAPY);
            antCoin.transfer(_stakeANTInfo.owner, stakeAmount);
            antCoin.mint(_stakeANTInfo.owner, earningReward);
            premiumANT.setLevel(_tokenId, _bossesPool.drainedLevel);
        }

        premiumANT.transferFrom(address(this), _msgSender(), _tokenId);
        uint256 lastStakedNFTs = premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTs[_msgSender()].length - 1];
        premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTsIndicies[_tokenId]] = lastStakedNFTs;
        premiumANTStakedNFTsIndicies[premiumANTStakedNFTs[_msgSender()][premiumANTStakedNFTs[_msgSender()].length - 1]] = premiumANTStakedNFTsIndicies[_tokenId];
        premiumANTStakedNFTs[_msgSender()].pop();
        totalPremiumANTStaked--;
        
        delete premiumANTStakedNFTsIndicies[_tokenId];
        delete premiumANTBosses[_tokenId];

        emit BossesUnStakePremiumANT(_tokenId, _msgSender());
    }

    /**
    * @notice           UnStake baisc ant from Bosses Pool with earning rewards
    *                   if you unstake ant early, you will lose 20% of ant coin staked amount
    * @param _tokenId   basic ant token id for unStake
    */

    function unStakeBasicANT(uint256 _tokenId) external whenNotPaused nonReentrant {
        StakeANT memory _stakeANTInfo = basicANTBosses[_tokenId];
        uint256 _stakedPeriod = block.timestamp - _stakeANTInfo.originTimestamp;
        require(_stakeANTInfo.owner == _msgSender(), 'Bosses: you are not owner of this basic ant');

        if(_stakedPeriod < _stakeANTInfo.lockPeriod) {
            // early unStake
            uint256 burnAmount = _stakeANTInfo.stakeAmount * burnRate / 100;
            antCoin.burn(address(this), burnAmount);
            antCoin.transfer(_stakeANTInfo.owner, _stakeANTInfo.stakeAmount - burnAmount);
        } else {
            BossesPool memory _bossesPool = bossesPools[_stakeANTInfo.rewardIndex];
            uint256 stakeAmount = _stakeANTInfo.stakeAmount;
            uint256 earningReward = _calculateReward(stakeAmount, _bossesPool.rewardAPY);
            antCoin.transfer(_stakeANTInfo.owner, stakeAmount);
            antCoin.mint(_stakeANTInfo.owner, earningReward);
            basicANT.setLevel(_tokenId, _bossesPool.drainedLevel);
        }

        basicANT.transferFrom(address(this), _msgSender(), _tokenId);
        uint256 lastStakedNFTs = basicANTStakedNFTs[_msgSender()][basicANTStakedNFTs[_msgSender()].length - 1];
        basicANTStakedNFTs[_msgSender()][basicANTStakedNFTsIndicies[_tokenId]] = lastStakedNFTs;
        basicANTStakedNFTsIndicies[basicANTStakedNFTs[_msgSender()][basicANTStakedNFTs[_msgSender()].length - 1]] = basicANTStakedNFTsIndicies[_tokenId];
        basicANTStakedNFTs[_msgSender()].pop();
        totalBasicANTStaked--;
        
        delete basicANTStakedNFTsIndicies[_tokenId];
        delete basicANTBosses[_tokenId];

        emit BossesUnStakeBasicANT(_tokenId, _msgSender());
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
    * @notice               Function to add bosses pools info
    * @dev                  This function can only be called by the owner
    * @param _poolNames     array of pool names
    * @param _rewardAPYs    array of reward apy
    * @param _drainedLevels array of ant drain levels
    * @param _levelRequired array of required levels
    */

    function setBossesPoolsInfo(string[] memory _poolNames, uint256[] memory _rewardAPYs, uint256[] memory _drainedLevels, uint256[] memory _levelRequired) external onlyMinterOrOwner {
        delete bossesPools; // initialize bosses pools info
        require((_poolNames.length == _rewardAPYs.length) && (_rewardAPYs.length == _drainedLevels.length) && (_drainedLevels.length == _levelRequired.length), "Bosses: invalid bosses pools info");
        for(uint256 i = 0; i < _poolNames.length; i++) {
            bossesPools.push(BossesPool({
                poolName: _poolNames[i],
                rewardAPY: _rewardAPYs[i],
                drainedLevel: _drainedLevels[i],
                levelRequired: _levelRequired[i]
            }));
        }
    }

    /**
    * @notice                           Function to set the ant coin stake limit amount
    * @dev                              This function can only be called by the owner
    * @param _limitANTCoinStakeAmount   ant coin stake limit amount for each ants & pools
    */

    function setLimitANTCoinStakeAmount(uint256 _limitANTCoinStakeAmount) external onlyMinterOrOwner {
        limitANTCoinStakeAmount = _limitANTCoinStakeAmount;
    }

    /**
    * @notice           Function to set the burn rate if user unstake the ant early than stake period
    * @dev              This function can only be called by the owner
    * @param _burnRate  burn rate
    */

    function setBurnRate(uint256 _burnRate) external onlyMinterOrOwner {
        burnRate = _burnRate;
    }

    /**
    * @notice          Function to grant mint role
    * @dev             This function can only be called by the owner
    * @param _address  address to get minter role
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
    * @notice               Function to set pool stake period timestamp
    * @dev                  This function can only be called by the owner
    * @param _stakePeriod   stake period timestamp
    */

    function setStakePeriod(uint256 _stakePeriod) external onlyMinterOrOwner {
        stakePeriod = _stakePeriod;        
    }

    /**
    * @notice               Set Randomizer contract address
    * @dev                  This function can only be called by the owner
    * @param _randomizer    Randomizer contract address
    */

    function setRandomizerContract(IRandomizer _randomizer) external onlyMinterOrOwner {
        randomizer = _randomizer;
    }

    /**
    * @notice           Set ANTCoin contract address
    * @dev              This function can only be called by the owner
    * @param _antCoin   ANTCoin contract address
    */

    function setANTCoinContract(IANTCoin _antCoin) external onlyMinterOrOwner {
        antCoin = _antCoin;
    }

    /**
    * @notice               Set premium ant contract address
    * @dev                  This function can only be called by the owner
    * @param _premiumANT    Premium ANT contract address
    */

    function setPremiumANTContract(IPremiumANT _premiumANT) external onlyMinterOrOwner {
        premiumANT = _premiumANT;
    }

    /**
    * @notice           Set basic ant contract address
    * @dev              This function can only be called by the owner
    * @param _basicANT  Basic ANT contract address
    */

    function setBasicANTContract(IBasicANT _basicANT) external onlyMinterOrOwner {
        basicANT = _basicANT;
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
    * @param _tokenContract     Address for the token
    * @param to                 Address for token to be send to
    * @param amount             Amount of token to send
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