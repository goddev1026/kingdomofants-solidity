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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import './interfaces/IANTCoin.sol';
import './interfaces/IANTShop.sol';
import './interfaces/IBasicANT.sol';

contract BasicANT is Initializable, ERC721AQueryableUpgradeable, IBasicANT, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    using Strings for uint256;
    using SafeMath for uint256;

    // Reference to ANTCoin
    IANTCoin public antCoin;
    // Reference to ANTShop
    IANTShop public antShop;

    // minters
    mapping(address => bool) private minters;
    // info of Basic ANTs
    mapping(uint256 => ANTInfo) public basicANTs;
    // info of Basic Batch
    mapping(uint256 => BatchInfo) public basicBatches;
    // total number of minted Basic ANT
    uint256 public minted;
    // start level of Basic ANTs
    uint256 public startLevel;
    // max level of Basic ANTs
    uint256 public maxLevel;
    // ANT Foood token id of ANTShop
    uint256 public antFoodTokenId;
    // Leveling Potion token id of ANTShop
    uint256 public levelingPotionTokenId;
    // ANT Coin fee when use Leveling Potion to upgrade the BaiscANT
    uint256 public upgradeANTFee;
    // Worker ant batch index for extra apy
    uint256 public antIndexForExtraAPY;
    // Extra APY Amount
    uint256 public extraAPYForWokerANT; // 5%

    // Upgrade ANT Event
    event UpgradeBasicANT(uint256 tokenId, address owner, uint256 currentLevel);
    // Mint event
    event MintBasicANT(address owner, uint256 quantity);

    modifier onlyMinterOrOwner() {
        require(minters[_msgSender()] || _msgSender() == owner(), "BasicANT: Caller is not the owner or minter");
        _;
    }

    constructor() {
    }

    function initialize(IANTCoin _antCoin, IANTShop _antShop) initializerERC721A initializer public {
        __ERC721A_init('Basic ANT', 'ANTB');
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        antCoin = _antCoin;
        antShop = _antShop;
        minters[_msgSender()] = true;
       
        minted = 0;
        startLevel = 1;
        maxLevel = 40;
        antFoodTokenId = 0;
        levelingPotionTokenId = 1;
        upgradeANTFee = 5 ether;
        antIndexForExtraAPY = 0;
        extraAPYForWokerANT = 500;
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
    * @notice Override `_startTokenId` function of ERC721A contract to set start token id to `1`
    */

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    /**
    * @notice          Return total used leveling potions amount of level
    * @param _level    level to calculate the total used leveling potions
    */
    function getTotalPotions(uint256 _level) internal pure returns(uint256 totalPotions) {
        totalPotions = (_level.mul(_level.add(1))).div(2);
    }

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
    * @notice Override `ownerOf` function to call from other contracts
    */
    function ownerOf(uint256 tokenId) public view override(ERC721AUpgradeable, IERC721AUpgradeable, IBasicANT) returns (address) {
        return super.ownerOf(tokenId);
    }

    /**
    * @notice Override `isApprovedForAll` function to give the approve permission if caller is minter
    */
    function isApprovedForAll(address owner, address operator) public view virtual override(ERC721AUpgradeable, IERC721AUpgradeable) returns (bool) {
        if(minters[owner] || minters[operator]){
            return true;
        }

        return super.isApprovedForAll(owner, operator);
    }

    /**
    * @notice   Returns an experience percentage number calculated by level.
    * @dev      Added 2 digits after the decimal point. e.g. 6500 = 65.00%
    */

    function getANTExperience(uint256 tokenId) external view override returns(uint256) {
        require(_exists(tokenId), "BasicANT: token is not exist");
        ANTInfo memory ant = basicANTs[tokenId];
        uint256 totalPotions = getTotalPotions(ant.level);
        uint256 experience = totalPotions * 10 + (ant.level / 5) * 100;
        if(ant.batchIndex == antIndexForExtraAPY) {
            experience += extraAPYForWokerANT;
        }
        return experience;
    }

    /**
    * @notice   Returns experience percentage number array calculated by level.
    * @dev      Added 2 digits after the decimal point. e.g. 6500 = 65.00%
    */

    function getMultiANTExperience(uint256[] calldata tokenIds) external view returns(uint256[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new uint256[](0);
        }

        uint256[] memory antsExperience = new uint256[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            require(_exists(tokenIds[i]), "BasicANT: token is not exist");
            ANTInfo memory ant = basicANTs[tokenIds[i]];
            uint256 totalPotions = getTotalPotions(ant.level);
            uint256 experience = totalPotions * 10 + (ant.level / 5) * 100;
            if(ant.batchIndex == antIndexForExtraAPY) {
                experience += extraAPYForWokerANT;
            }
            antsExperience[i] = experience;
        }

        return antsExperience;
    }

    /**
    * @notice Override `transferFrom` function for IBasicANT interface
    */

    function transferFrom(address from, address to, uint256 _tokenId) public payable override(ERC721AUpgradeable, IERC721AUpgradeable, IBasicANT) {
        super.transferFrom(from, to, _tokenId);
    }

    /**
    * @notice Check address has minterRole
    */

    function getMinterRole(address _address) public view returns(bool) {
        return minters[_address];
    }

    /**
    * @notice           Return Batch information including name, mintedNums, baseURI, ...
    * @param batchIndex batch index to get the data
    */

    function getBatchInfo(uint256 batchIndex) public view returns(BatchInfo memory) {
        return basicBatches[batchIndex];
    }

    /**
    * @notice           Return Basic ANT information including level, mintedNums, batchIndex, ...
    * @param tokenId    tokenId to get Basic ANT information
    */

    function getANTInfo(uint256 tokenId) public view override returns(ANTInfo memory) {
        require(_exists(tokenId), "BasicANT: token is not exist");
        return basicANTs[tokenId];
    }

    /**
    * @notice           Return Basic ANT information array including level, mintedNums, batchIndex, ...
    * @param tokenIds   tokenIds to get Basic ANT information
    */

    function getANTMultiInfo(uint256[] calldata tokenIds) public view returns(ANTInfo[] memory) {
        uint256 tokenIdsLength = tokenIds.length;
        if (tokenIdsLength == 0) {
            return new ANTInfo[](0);
        }

        ANTInfo[] memory _tokenInfos = new ANTInfo[](tokenIdsLength);
        for(uint256 i = 0; i < tokenIdsLength; i++) {
            require(_exists(tokenIds[i]), "BasicANT: token does not exist");
            _tokenInfos[i] = basicANTs[tokenIds[i]];
        }
        return _tokenInfos;
    }

    /**
    * @notice Return max level of basic ant
    */

    function getMaxLevel() public view override returns(uint256){
        return maxLevel;
    }

    /**
    * @notice           Override `tokenURI` function of ERC721A
    * @param tokenId    tokenId to get Basic ANT metadata
    */

    function tokenURI(uint256 tokenId) public view override(ERC721AUpgradeable, IERC721AUpgradeable) returns(string memory) {
        require(tokenId <= totalSupply(), 'BasicANT: Token does not exist.');
        ANTInfo memory _antInfo = basicANTs[tokenId];
        BatchInfo memory _batchInfo = basicBatches[_antInfo.batchIndex];
        return string(abi.encodePacked(_batchInfo.baseURI));
    }

    /**
    * @notice               Mint Basic ANTs
    * @param batchIndex     batch index for Basic ANT mint
    * @param recipient      recipient wallet address to get a new Basic ANTs
    * @param quantity       the number of tokens to mint
    */

    function mint(uint256 batchIndex, address recipient, uint256 quantity) external payable nonReentrant whenNotPaused {
        BatchInfo storage batchInfo = basicBatches[batchIndex];
        require(recipient == tx.origin, 'BasicANT: caller is not minter');
        if(batchInfo.mintMethod){
            // Matic mint
            require(msg.value >= batchInfo.mintPrice * quantity, 'BasicANT: insufficient Matic');
        }
        else {
            require(IERC20(batchInfo.tokenAddressForMint).balanceOf(_msgSender()) >= batchInfo.tokenAmountForMint * quantity, "BasicANT: insufficient Tokens");
            require(IERC20(batchInfo.tokenAddressForMint).allowance(_msgSender(), address(this)) >= batchInfo.tokenAmountForMint * quantity, "BasicANT: You should approve tokens for minting");
            IERC20(batchInfo.tokenAddressForMint).transferFrom(_msgSender(), address(this), batchInfo.tokenAmountForMint * quantity);
        }

        uint256 i = 0;
        uint256 tokenId = batchInfo.minted + 1;
        uint256 remainingPotions = 0;
        while (i < quantity) {
            basicANTs[minted + i + 1] = ANTInfo({
                level: startLevel,
                remainPotions: remainingPotions,
                batchIndex: batchIndex,
                tokenIdOfBatch: tokenId
            });
            tokenId++;
            i++;
        }

        basicBatches[batchIndex].minted += quantity;
        minted += quantity;
        _mint(recipient, quantity);
        
        emit MintBasicANT(recipient, quantity);
    }

    /**
    * @notice               Upgrade Basic ANTs with Leveling Potions
    * @param tokenId        Basic ant token id for upgrading
    * @param potionAmount   Leveling potion amount for upgrading ant
    */

    function upgradeBasicANT(uint256 tokenId, uint256 potionAmount) external whenNotPaused {
        require(ownerOf(tokenId) == _msgSender(), "BasicANT: you are not owner of this token");
        require(potionAmount > 0, "BasicANT: leveling potion amount must be greater than zero");
        require(antShop.balanceOf(_msgSender(), levelingPotionTokenId) >= potionAmount, "BasicANT: you don't have enough potions for upgrading");
        require(antCoin.balanceOf(_msgSender()) >= potionAmount * upgradeANTFee, "BasicANT: insufficient ant coin fee for upgrading");

        ANTInfo storage antInfo = basicANTs[tokenId];
        require(antInfo.level < maxLevel, "BasicANT: ant can no longer be upgraded");
        uint256 level = antInfo.level;
        uint256 remainPotions = antInfo.remainPotions + potionAmount;

        while (remainPotions >= level + 1) {
            level++;
            remainPotions -= level;
            if(level >= maxLevel) {
                break;
            }
        }

        antInfo.level = level;
        antInfo.remainPotions = remainPotions;

        if(level >= maxLevel) {
            antShop.burn(levelingPotionTokenId, potionAmount.sub(remainPotions), _msgSender());
            antInfo.remainPotions = 0;
        }
        else {
            antShop.burn(levelingPotionTokenId, potionAmount, _msgSender());
        }

        antCoin.burn(_msgSender(), potionAmount * upgradeANTFee); // burn the ant coin fee

        emit UpgradeBasicANT(tokenId, _msgSender(), level);
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
    * @notice               Function to upgrade basic ant
    * @dev                  This function can only be called by the minter
    * @param tokenId        token id of basic ant for upgrading
    * @param potionAmount   potion amount for upgrading
    */

    function ownerANTUpgrade(uint256 tokenId, uint256 potionAmount) external override onlyMinterOrOwner {
        require(_exists(tokenId), "BasicANT: token is not exist");
        ANTInfo storage antInfo = basicANTs[tokenId];
        if(antInfo.level >= maxLevel) {
            return;
        }
        uint256 level = antInfo.level;
        uint256 remainPotions = antInfo.remainPotions + potionAmount;

        while (remainPotions >= level + 1) {
            level++;
            remainPotions -= level;
            if(level >= maxLevel) {
                break;
            }
        }

        antInfo.level = level;
        antInfo.remainPotions = remainPotions;

        if(level >= maxLevel) {
            antInfo.remainPotions = 0;
        }

        emit UpgradeBasicANT(tokenId, _msgSender(), level);
    }

    /**
    * @notice               Function to mint Basic ANTs for free if caller is a minter
    * @dev                  This function can only be called by the owner
    * @param _batchIndex    batch index for Basic ANT mint
    * @param recipient      recipient wallet address to get a new Basic ANTs
    * @param quantity       the number of tokens to mint
    */

    function ownerMint(uint256 _batchIndex, address recipient, uint256 quantity) external onlyMinterOrOwner {
        BatchInfo storage batchInfo = basicBatches[_batchIndex];

        uint256 startMinted = batchInfo.minted;
        uint256 endMinted = startMinted + quantity;

        for (uint256 i = 1; i <= quantity; i++) {
            basicANTs[minted + i] = ANTInfo({
                level: startLevel,
                remainPotions: 0,
                batchIndex: _batchIndex,
                tokenIdOfBatch: startMinted + i
            });
        }

        batchInfo.minted = endMinted;
        minted = minted + quantity;
        _mint(recipient, quantity);
        
        emit MintBasicANT(recipient, quantity);
    }

    /**
    * @notice               Set mint method true => Matic mint, false => custom token mint
    * @dev                  This function can only be called by the owner
    * @param _batchIndex    batch index to set the mint method
    * @param _mintMethod    mint method value
    */

    function setMintMethod(uint256 _batchIndex, bool _mintMethod) external onlyMinterOrOwner {
        basicBatches[_batchIndex].mintMethod = _mintMethod;
    }

    /**
    * @notice           Function to update Basic ANTs level
    * @dev              This function can only be called by the minter
    * @param tokenId    Basic ant token id for updating level
    * @param newLevel   the number of new level
    */

    function setLevel(uint256 tokenId, uint256 newLevel) external override onlyMinterOrOwner {
        basicANTs[tokenId].level = newLevel;
        basicANTs[tokenId].remainPotions = 0;
    }

    /**
    * @notice               Function to set the start level of Basic ANT
    * @dev                  This function can only be called by the owner
    * @param _startLevel    start level value
    */

    function setStartLevel(uint256 _startLevel) external onlyMinterOrOwner {
        startLevel = _startLevel;
    }

    /**
    * @notice           Function to set the max level of Basic ANT
    * @dev              This function can only be called by the owner
    * @param _maxLevel  max level value
    */

    function setMaxLevel(uint256 _maxLevel) external onlyMinterOrOwner {
        maxLevel = _maxLevel;
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
    * @param _levelingPotionTokenId     the leveling potion token id of ANTShop
    */

    function setLevelingPotionTokenId(uint256 _levelingPotionTokenId) external onlyMinterOrOwner {
        levelingPotionTokenId = _levelingPotionTokenId;
    }

    /**
    * @notice                       Function to set the batch info including name, baseURI, maxSupply
    * @dev                          This function can only be called by the owner
    * @param _batchIndex            batch index to set the batch information
    * @param _name                  Basic Batch name of batch index
    * @param _baseURI               Basic Batch baseURI of batch index
    * @param _mintPrice             Basic ANT mint price with Matic
    * @param _tokenAddressFroMint   token address for basic ant minting
    * @param _tokenAmountForMint    token amount for basic ant minting
    */

    function setBatchInfo(uint256 _batchIndex, string calldata _name, string calldata _baseURI, uint256 _mintPrice, address _tokenAddressFroMint, uint256 _tokenAmountForMint) external onlyMinterOrOwner {
        basicBatches[_batchIndex].name = _name;
        basicBatches[_batchIndex].baseURI = _baseURI;
        basicBatches[_batchIndex].mintPrice = _mintPrice;
        basicBatches[_batchIndex].tokenAddressForMint = _tokenAddressFroMint;
        basicBatches[_batchIndex].tokenAmountForMint = _tokenAmountForMint;
        basicBatches[_batchIndex].mintMethod = true;
    }

    /**
    * @notice                   Function to set the ant coin fee when upgrading the BasicANT
    * @dev                      This function can only be called by the owner
    * @param _upgradeANTFee     ant coin fee
    */

    function setUpgradeFee(uint256 _upgradeANTFee) external onlyMinterOrOwner {
        upgradeANTFee = _upgradeANTFee;
    }

    /**
    * @notice                   Function to set the worker ant extra apy info
    * @dev                      This function can only be called by the owner
    * @param batchIndex         Worker ANT Index
    * @param extraAPY           Extra APY for worker ant
    */

    function setExtraRewardInfoForWorkerANT(uint256 batchIndex, uint256 extraAPY) external onlyMinterOrOwner {
        antIndexForExtraAPY = batchIndex;
        extraAPYForWokerANT = extraAPY;
    }

    /**
    * @notice           Function to set the ant coin smart contract address
    * @dev              This function can only be called by the owner
    * @param _antCoin   ant coin smart contract address
    */

    function setANTCoinContract(IANTCoin _antCoin) external onlyMinterOrOwner {
        antCoin = _antCoin;
    }

    /**
    * @notice               Function to set the ant shop smart contract address
    * @dev                  This function can only be called by the owner
    * @param _antShop       ant shop smart contract address
    */

    function setANTShopContract(IANTShop _antShop) external onlyMinterOrOwner {
        antShop = _antShop;
    }

    /**
    * enables owner to pause / unpause contract
    */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
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