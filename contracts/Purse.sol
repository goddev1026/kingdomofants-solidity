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
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './interfaces/IRandomizer.sol';
import './interfaces/IANTShop.sol';
import './interfaces/IPurse.sol';
import './interfaces/IANTLottery.sol';
import 'hardhat/console.sol';

contract Purse is Initializable, ERC721AQueryableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable, IPurse {

    using SafeMath for uint256;

    // Reference to ANTShop
    IANTShop public antShop;
    // Reference to Randomizer
    IRandomizer public randomizer;
    // Reference to ANTLottery
    IANTLottery public antLottery;
    // array of Purse Category 0 => Common, 1 => UnCommon, 2 => Rare, 3 => Ultra Rare, 4 => Lengendary
    PurseCategory[] public purseCategories;

    // minters
    mapping(address => bool) private minters;
    // tokenId => category id
    mapping(uint256 => uint256) public purseInfo;
    // reward earning info for each tokens
    mapping(uint256 => PurseTokenRewardInfo) public purseTokenRewardInfos;
    // used purse token ids by address
    mapping(address => uint256[]) public usedPurseTokenIds;
    // array indices of each token id for Purse Token
    mapping(uint256 => uint256) public usedPurseTokenIdsIndicies;

    // ANTFood token id of ANTShop
    uint256 public antFoodTokenId;
    // Leveling Potion token id of ANTShop
    uint256 public levelingPotionTokenId;
    // total number of minted Premium ANT
    uint256 public minted;

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "Purse: Caller is not the owner or minter");
        _;
    }

    // Mint event
    event Mint(address owner, uint256 quantity);
    // Purse category event
    event UsePurseToken(address owner, uint256 tokenId, string categoryName, string rewardType, uint256 rewardTypeId, uint256 quantity);

     function initialize(IRandomizer _randomizer, IANTShop _antShop, IANTLottery _antLottery) initializerERC721A initializer public {
        __ERC721A_init('Premium ANT', 'ANTP');
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        randomizer = _randomizer;
        antShop = _antShop;
        antLottery = _antLottery;
        minters[_msgSender()] =  true;

        antFoodTokenId = 0;
        levelingPotionTokenId = 1;
        minted = 0;
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
    * @notice           Transfer ETH and return the success status.
    * @dev              This function only forwards 30,000 gas to the callee.
    * @param to         Address for ETH to be send to
    * @param value      Amount of ETH to send
    */
    function _safeTransferETH(address to, uint256 value) internal returns (bool) {
        (bool success, ) = to.call{ value: value, gas: 30_000 }(new bytes(0));
        return success;
    }

    /**
    * @notice Override `_startTokenId` function of ERC721A contract to set start token id to `1`
    */

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    /**
    * @notice       Return sum value of arr array
    * @param arr    uint256 array to calculate the sum value
    */

    function getSumValue(uint256[] memory arr) internal pure returns (uint256) {
        uint256 total = 0;
        uint256 len = arr.length;
        assembly {
            let p := add(arr, 0x20)
            for {
                let i := 0
            } lt(i, len) {
                i := add(i, 1)
                p := add(p, 0x20)
            } {
                total := add(total, mload(p))
            }
        }
        return total;
    }

    /**
    * @notice           Return randomness pruse category id
    * @param _tokenId   purse token id to get random category item
    */

    function getPurseCategoryRarity(uint256 _tokenId) internal view returns(uint256 categoryType) {
        require(purseCategories.length > 0, "Purse: purse categories have not set been yet");

        uint256 random = randomizer.randomToken(_tokenId).mod(100);

        uint256 raritySum = 0;
        for (uint256 i = 0; i < purseCategories.length; i++) {
            raritySum += purseCategories[i].rarity;

            if (random < raritySum) {
                categoryType = i;
                break;
            }
        }
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
    * @notice           Return category name of token Id
    * @param tokenId    purse token id to get category data
    */

    function getPurseCategoryInfoOfToken(uint256 tokenId) public view returns(string memory) {
        require(tokenId <= minted, "Purse: token doesn't exist");
        PurseCategory memory _purseCategory = purseCategories[purseInfo[tokenId]];
        return _purseCategory.categoryName;
    }

    /**
    * @notice       Return token ids array which is used for earning reward
    * @param _owner user address to get token ids
    */

    function getUsedPurseTokenIdsByAddress(address _owner) public view returns(uint256[] memory) {
        return usedPurseTokenIds[_owner];
    }

    /**
    * @notice           Return purse token earning reward info array
    * @param _tokenIds  purse token ids array to get the earning info
    */

    function getPurseMultiTokenRewardInfo(uint256[] calldata _tokenIds) public view returns(PurseTokenRewardInfo[] memory) {
        uint256 _tokenIdsLength = _tokenIds.length;
        if (_tokenIdsLength == 0) {
            return new PurseTokenRewardInfo[](0);
        }

        PurseTokenRewardInfo[] memory _tokenRewardInfos = new PurseTokenRewardInfo[](_tokenIdsLength);
        for(uint256 i = 0; i < _tokenIdsLength; i++) {
            PurseTokenRewardInfo memory _rewardInfo = purseTokenRewardInfos[_tokenIds[i]];
            _tokenRewardInfos[i] = _rewardInfo;
        }

        return _tokenRewardInfos;
    }

    /**
    * @notice              Return category names of token Id array
    * @param _tokenIds     purse token id array to get category data
    */

    function getPurseCategoryInfoOfMultiToken(uint256[] calldata _tokenIds) public view returns(string[] memory) {
        uint256 _tokenIdsLength = _tokenIds.length;
        if (_tokenIdsLength == 0) {
            return new string[](0);
        }

        string[] memory _tokenInfos = new string[](_tokenIdsLength);
        for(uint256 i = 0; i < _tokenIdsLength; i++) {
            require(_tokenIds[i] <= minted, "Purse: token doesn't exist");
             PurseCategory memory _purseCategory = purseCategories[purseInfo[_tokenIds[i]]];
            _tokenInfos[i] = _purseCategory.categoryName;
        }

        return _tokenInfos;
    }

    /**
    * @notice           Return purse category information
    * @param _infoId    purse info id to get category data
    */

    function getPurseCategoryInfo(uint256 _infoId) public view returns(PurseCategory memory) {
        require(_infoId < purseCategories.length, "Purse: category info doesn't exist");
        return purseCategories[_infoId];
    }

    /**
    * @notice           Return purse category information array
    * @param _infoIds   purse info id array to get category data
    */

    function getPurseCategoryMultiInfo(uint256[] calldata _infoIds) public view returns(PurseCategory[] memory) {
        uint256 _infoIdsLength = _infoIds.length;
        if (_infoIdsLength == 0) {
            return new PurseCategory[](0);
        }

        PurseCategory[] memory purseCategoryInfo = new PurseCategory[](_infoIdsLength);
        for(uint256 i = 0; i < _infoIdsLength; i++) {
            require(_infoIds[i] < purseCategories.length, "Purse: category info doesn't exist");
            purseCategoryInfo[i] = purseCategories[_infoIds[i]];
        }

        return purseCategoryInfo;
    }

    /**
    * @notice           Use purse  token to get reward with randomness
    * @param tokenId    purse token id to get reward
    */

    function usePurseToken(uint256 tokenId) external whenNotPaused nonReentrant {
        require(ownerOf(tokenId) == _msgSender(), "Purse: you are not owner of this token");

        PurseCategory storage purseCategory = purseCategories[purseInfo[tokenId]];
        uint256 random = randomizer.randomToken(tokenId).mod(100);
        uint256 rewardTypeId;
        uint256 quantity;
        string memory rewardType = "";
        
        if (random < purseCategory.antFoodRarity) {
            quantity = purseCategory.antFoodRewardAmount;
            rewardType = "ANTFood";
            rewardTypeId = antFoodTokenId;
            antShop.mint(antFoodTokenId, quantity, _msgSender());
        } else if (random < purseCategory.antFoodRarity + purseCategory.levelingPotionRarity) {
            quantity = purseCategory.levelingPotionRewardAmount;
            rewardType = "LevelingPotion";
            rewardTypeId = levelingPotionTokenId;
            antShop.mint(levelingPotionTokenId, quantity, _msgSender());
        } else {
            quantity = purseCategory.lotteryTicketRewardAmount;
            antLottery.buyTickets(_msgSender(), quantity);
            rewardType = "LotteryTicket";
        }

        purseTokenRewardInfos[tokenId] = PurseTokenRewardInfo({
            owner: _msgSender(),
            tokenId: tokenId,
            purseCategoryId: purseInfo[tokenId],
            rewardType: rewardType,
            quantity: quantity,
            isUsed: true
        });

        usedPurseTokenIds[_msgSender()].push(tokenId);
        usedPurseTokenIdsIndicies[tokenId] = usedPurseTokenIds[_msgSender()].length - 1;

        _burn(tokenId);

        emit UsePurseToken(_msgSender(), tokenId, purseCategory.categoryName, rewardType, rewardTypeId, quantity); // rewardTypeId will only exist when the earning reward token is ant shop token
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
    * @notice           Mint the purse tokens
    * @dev              This function can only be called by the minter
    * @param recipient  recipient wallet address to mint the purse tokens
    * @param quantity   purse token qunatity to mint
    */

    function mint(address recipient, uint256 quantity) external override onlyMinterOrOwner {
        for(uint256 i = 1; i <= quantity; i ++) {
            uint256 tokenId = minted + i;
            purseInfo[tokenId] = getPurseCategoryRarity(tokenId);
            purseCategories[purseInfo[tokenId]].minted += 1;
        }
        minted += quantity;
        _safeMint(recipient, quantity, '');
        emit Mint(recipient, quantity);
    }

    /**
    * @notice                           Set Multiple Purse Category struct data
    * @dev                              This function can only be called by the owner
    * @param _names                     array of category names
    * @param _rarities                  array of rarities. total value should be 100
    * @param _antFoodRarities           array of rarities. total value should be 100
    * @param _levelingPotionsRarities   array of rarities. total value should be 100
    * @param _lotteryTicketRarities     array of rarities. total value should be 100
    * @param _antFoodRewardAmounts      array of ant food reward amounts
    * @param _levelingPotionAmounts     array of leveling potions amounts
    * @param _lotteryTicketAmounts      array of lottery ticket amounts
    * @param _minted                    array of minted token amounts
    */

    function addMultiPurseCategories(string[] memory _names, uint256[] memory _rarities, uint256[] memory _antFoodRarities, uint256[] memory _levelingPotionsRarities, uint256[] memory _lotteryTicketRarities, uint256[] memory _antFoodRewardAmounts, uint256[] memory _levelingPotionAmounts, uint256[] memory _lotteryTicketAmounts, uint256[] memory _minted) external onlyMinterOrOwner {
        require(_names.length == _rarities.length && _rarities.length == _antFoodRarities.length && _antFoodRarities.length == _levelingPotionsRarities.length && _levelingPotionsRarities.length == _lotteryTicketRarities.length && _lotteryTicketRarities.length == _antFoodRewardAmounts.length && _antFoodRewardAmounts.length == _levelingPotionAmounts.length && _levelingPotionAmounts.length == _lotteryTicketAmounts.length, "Purse: invalid purse category data");
        require(getSumValue(_rarities) == 100, "Purse: invalid purse category data");
        delete purseCategories;
        for(uint256 i = 0; i < _rarities.length; i ++) {
            require(_antFoodRarities[i] + _levelingPotionsRarities[i] + _lotteryTicketRarities[i] == 100, "Purse: invalid purse category data");

            purseCategories.push(PurseCategory({
                categoryName: _names[i], rarity: _rarities[i], antFoodRarity: _antFoodRarities[i], 
                levelingPotionRarity: _levelingPotionsRarities[i], lotteryTicketRarity: _lotteryTicketRarities[i], 
                antFoodRewardAmount: _antFoodRewardAmounts[i], levelingPotionRewardAmount: _levelingPotionAmounts[i], 
                lotteryTicketRewardAmount: _lotteryTicketAmounts[i], minted: _minted[i]
            }));
        }
    }

    /**
    * @notice                           Update Purse Category struct data
    * @dev                              This function can only be called by the owner
    * @param _names                     array of category names
    * @param _rarities                  array of rarities. total value should be 100
    * @param _antFoodRarities           array of rarities. total value should be 100
    * @param _levelingPotionsRarities   array of rarities. total value should be 100
    * @param _lotteryTicketRarities     array of rarities. total value should be 100
    * @param _antFoodRewardAmounts      array of 
    * @param _levelingPotionAmounts     array of leveling potions amounts
    * @param _lotteryTicketAmounts      array of lottery ticket amounts
    */

    function updatePurseCategories(string[] memory _names, uint256[] memory _rarities, uint256[] memory _antFoodRarities, uint256[] memory _levelingPotionsRarities, uint256[] memory _lotteryTicketRarities, uint256[] memory _antFoodRewardAmounts, uint256[] memory _levelingPotionAmounts, uint256[] memory _lotteryTicketAmounts) external onlyMinterOrOwner {
        require(_names.length == _rarities.length && _rarities.length == _antFoodRarities.length && _antFoodRarities.length == _levelingPotionsRarities.length && _levelingPotionsRarities.length == _lotteryTicketRarities.length && _lotteryTicketRarities.length == _antFoodRewardAmounts.length && _antFoodRewardAmounts.length == _levelingPotionAmounts.length && _levelingPotionAmounts.length == _lotteryTicketAmounts.length, "Purse: invalid purse category data");
        require(_names.length == purseCategories.length, "Purse: length doesn't match with purseCategory");
        require(getSumValue(_rarities) == 100, "Purse: invalid purse category data");
        for(uint256 i = 0; i < _rarities.length; i ++) {
            require(_antFoodRarities[i] + _levelingPotionsRarities[i] + _lotteryTicketRarities[i] == 100, "Purse: invalid purse category data");
            purseCategories[i] = PurseCategory({
                categoryName: _names[i], rarity: _rarities[i], antFoodRarity: _antFoodRarities[i], 
                levelingPotionRarity: _levelingPotionsRarities[i], lotteryTicketRarity: _lotteryTicketRarities[i], 
                antFoodRewardAmount: _antFoodRewardAmounts[i], levelingPotionRewardAmount: _levelingPotionAmounts[i], 
                lotteryTicketRewardAmount: _lotteryTicketAmounts[i], minted: purseCategories[i].minted
            });
        }
    }

    /**
    * @notice                   Function to set the ANT Food token id of ANTShop
    * @dev                      This function can only be called by the owner
    * @param _antFoodTokenId    the ANT Food token id of ANTShop
    */

    function setAntFoodTokenId(uint256 _antFoodTokenId) external onlyMinterOrOwner {
        antFoodTokenId = _antFoodTokenId;
    }

    /**
    * @notice                           Function to set the leveling potion token id of ANTShop
    * @dev                              This function can only be called by the owner
    * @param _levelingPotionTokenId     leveling potion token id of ANTShop
    */

    function setLevelingPotionTokenId(uint256 _levelingPotionTokenId) external onlyMinterOrOwner {
        levelingPotionTokenId = _levelingPotionTokenId;
    }

    /**
    * @notice               Set randomizer contract address
    * @dev                  This function can only be called by the owner
    * @param _randomizer    Randomizer contract address
    */

    function setRandomizerContract(IRandomizer _randomizer) external onlyMinterOrOwner {
        randomizer = _randomizer;
    }

    /**
    * @notice           Set a new ANTShop smart contract address
    * @dev              This function can only be called by the owner
    * @param _antShop   Reference to ANTShop
    */

    function setANTShopContract(IANTShop _antShop) external onlyMinterOrOwner {
        require(address(_antShop) != address(0x0), "Purse: ANTShop address can't be null address");
        antShop = _antShop;
    }

    /**
    * @notice               Set a new ANTLottery smart contract address
    * @dev                  This function can only be called by the owner
    * @param _antLottery    Reference to ANTLottery
    */

    function setANTLotteryContract(IANTLottery _antLottery) external onlyMinterOrOwner {
        require(address(_antLottery) != address(0x0), "Purse: ANTLottery address can't be null address");
        antLottery = _antLottery;
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