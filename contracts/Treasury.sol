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

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IANTCoin.sol";
import "hardhat/console.sol";

contract Treasury is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMath for uint256;

    struct Asset {
        address asset;
        address[] path;
    }

    IUniswapV2Router02 public uniswapV2Router;

    // assets info array
    Asset[] private _activeAssets;

    IUniswapV2Pair private antCLPPair;

    // minters
    mapping(address => bool) private minters;

    uint256[3] public distributeRates; // distribute rates index0 => ant coin, index1 => ant lp, index2 => assets
    // buy / sell tax rates
    uint256 public buyTaxFee;
    uint256 public sellTaxFee;

    uint256 public PRECISION;
    uint256 public PRECISION_E8;
    uint256 public PRECISION_E6;

    address public _wETH;
    address public usdtAddress;
    address public antCToken;
    address public teamWallet;
    address public deadWallet1;
    address public deadWallet2;

    // modifier to check _msgSender has minter role
    modifier onlyMinter() {
        require(minters[_msgSender()], "Treasury: Caller is not the minter");
        _;
    }

    modifier isAvailableAsset(address _assetAddress) {
        require(_assetAddress == antCToken || _checkAddressInActiveAssets(_assetAddress), "Treasury: Not allowed asset");
        _;
    }

    event OwnerDepositETH(uint256 depositAmount);
    event BuyKOATTTokens(address buyer, uint256 amount);
    event SellKOATTTokens(address seller, uint256 amount);

    constructor() {}

    function initialize(address _quickswapRouter, address antCAddress) initializer public {
        __ERC20_init("KOA Treasury Token", "KOATT");
        __ERC20Burnable_init();
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(_quickswapRouter);

        _mint(address(this), 300000);

        uniswapV2Router = _uniswapV2Router;
        _wETH = uniswapV2Router.WETH();
        antCToken = antCAddress;
        teamWallet = _msgSender();

        distributeRates = [20, 20, 60]; // distribute rates index0 => ant coin, index1 => ant lp, index2 => assets
        // buy / sell tax rates
        buyTaxFee = 5;
        sellTaxFee = 5;
        PRECISION = 1e18;
        PRECISION_E8 = 1e8;
        PRECISION_E6 = 1e6;

        usdtAddress = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
        deadWallet1 = 0x000000000000000000000000000000000000dEaD;
        deadWallet2 = 0x0000000000000000000000000000000000000000;
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
     * @notice Initialize the active assets array to empty
     */

    function _clearActiveAssets() internal {
        delete (_activeAssets);
    }

    /**
     * @notice Function to check asset address is exist
     * @param _assetAddress asset address to check
     */

    function _checkAddressInActiveAssets(address _assetAddress) private view returns (bool isAllowed) {
        for (uint256 i = 0; i < _activeAssets.length; i++) {
            if (_assetAddress == _activeAssets[i].asset) {
                isAllowed = true;
                break;
            }
        }
    }

    /**
     * @notice Function to deposit the ant coin to ant coin treasury pool
     * @param _depositAmount depoist eth amount for ant coin treasury pool
     */

    function _depositToANTCTreasury(uint256 _depositAmount) internal {
        uint256[] memory amounts = _swapExactETHforTokens(_depositAmount, antCToken);
        IANTCoin(antCToken).burn(address(this), amounts[1]);
    }

    /**
     * @notice Swap and distribute ETH to each assets
     * @param _ethAmount eth amount to distribute
     */

    function _distributeToAssets(uint256 _ethAmount) internal {
        require(_activeAssets.length > 0, "Treasury: No assets in treasury");

        uint256 totalUSDBalanceOfAssets = getTotalAssetsUSDValue();

        if (totalUSDBalanceOfAssets != 0) {
            for (uint256 i = 0; i < _activeAssets.length; i++) {
                uint256 _assetUSDBalance = getAssetUSDValue(i);
                uint256 _distributeAmount = (_assetUSDBalance * _ethAmount) /
                    totalUSDBalanceOfAssets;
                if (_activeAssets[i].asset != _wETH) {
                    _swapExactETHforTokens(
                        _distributeAmount,
                        _activeAssets[i].asset
                    );
                }
            }
        } else {
            uint256 distributeAmountForEach = _ethAmount / _activeAssets.length;
            for (uint256 i = 0; i < _activeAssets.length; i++) {
                if (_activeAssets[i].asset != _wETH) {
                    _swapExactETHforTokens(
                        distributeAmountForEach,
                        _activeAssets[i].asset
                    );
                }
            }
        }
    }

    /**
     * @notice Return total USD balance of assets
     */

    function getTotalAssetsUSDValue() public view returns (uint256 sum) {
        for (uint256 i = 0; i < _activeAssets.length; i++) {
            sum += getAssetUSDValue(i);
        }
    }

    /**
     * @notice Function to calculate the usd value of an asset
     * @param _activeAssetIndex asset index number
     */
    
    function getAssetUSDValue(uint256 _activeAssetIndex) public view returns (uint256 balance) {
        Asset memory _asset = _activeAssets[_activeAssetIndex];
        uint256 assetBalance = IERC20(_asset.asset).balanceOf(address(this));
        if (_asset.asset == _wETH) {
            assetBalance = address(this).balance;
            assetBalance += IERC20(_wETH).balanceOf(address(this));
        }
        if (assetBalance == 0) {
            balance = 0;
        } else {
            uint256[] memory amounts = uniswapV2Router.getAmountsOut(
                assetBalance,
                _asset.path
            );
            balance = amounts[1];
        }
    }

    /**
     * @notice Function to return the ant coin usd balance
     * @param _amount ant coin amount to calculate the usd value
     */

    function getANTCoinUSDValue(uint256 _amount) public view returns (uint256) {
        address[] memory _path1 = new address[](2);
        _path1[0] = antCToken;
        _path1[1] = _wETH;

        uint256[] memory amounts1 = uniswapV2Router.getAmountsOut(
            _amount,
            _path1
        );

        address[] memory _path2 = new address[](2);
        _path2[0] = _wETH;
        _path2[1] = usdtAddress;

        uint256[] memory amounts2 = uniswapV2Router.getAmountsOut(
            amounts1[1],
            _path2
        );

        return amounts2[1];
    }

    /**
     * @notice Function to get ANTCoin LP token's USD value
     * @param _lpTokenAmount LP token amount to calculate USD value
     */

    function getANTCoinLPTokenUSDValue(uint256 _lpTokenAmount) public view returns (uint256) {
        require(address(antCLPPair) != address(0x0), "Treasury: Invalid LP Pair address");

        uint256 totalSupplyOfLPPair = antCLPPair.totalSupply();
        uint256 deadWallet1Supply = antCLPPair.balanceOf(deadWallet1);
        uint256 deadWallet2Supply = antCLPPair.balanceOf(deadWallet2);
        uint256 circulatingSupply = totalSupplyOfLPPair
            .sub(deadWallet1Supply)
            .sub(deadWallet2Supply);

        // address[] memory _path0 = new address[](2);
        // _path0[0] = antCToken;
        // _path0[1] = _wETH;

        // uint256[] memory amounts0 = uniswapV2Router.getAmountsOut(
        //     IERC20(antCToken).balanceOf(address(antCLPPair)),
        //     _path0
        // );

        // address[] memory _path1 = new address[](2);
        // _path1[0] = _wETH;
        // _path1[1] = usdtAddress;

        // uint256[] memory amounts1 = uniswapV2Router.getAmountsOut(
        //     IERC20(_wETH).balanceOf(address(antCLPPair)) + amounts0[1],
        //     _path1
        // );

        uint256 totalUSDValueOfPair = getTotalUSDValueOfLPPair();
        uint256 lpTokenPriceForReturn = (totalUSDValueOfPair * _lpTokenAmount) /
            circulatingSupply;

        return lpTokenPriceForReturn;
    }

    function getTotalUSDValueOfLPPair() public view returns(uint256) {
        address[] memory _path0 = new address[](2);
        _path0[0] = antCToken;
        _path0[1] = _wETH;

        uint256[] memory amounts0 = uniswapV2Router.getAmountsOut(
            IERC20(antCToken).balanceOf(address(antCLPPair)),
            _path0
        );

        address[] memory _path1 = new address[](2);
        _path1[0] = _wETH;
        _path1[1] = usdtAddress;

        uint256[] memory amounts1 = uniswapV2Router.getAmountsOut(
            IERC20(_wETH).balanceOf(address(antCLPPair)) + amounts0[1],
            _path1
        );

        return amounts1[1];
    }

    /**
     * @notice Function to get LP token amount from usd value
     * @param _usdValue usd value to calculate the LP token amount
     */

    function getLPTokenAmountFromUSDValue(uint256 _usdValue) public view returns (uint256) {
        require(
            address(antCLPPair) != address(0x0),
            "Treasury: Invalid LP Pair address"
        );

        uint256 totalSupplyOfLPPair = antCLPPair.totalSupply();
        uint256 deadWallet1Supply = antCLPPair.balanceOf(deadWallet1);
        uint256 deadWallet2Supply = antCLPPair.balanceOf(deadWallet2);
        uint256 circulatingSupply = totalSupplyOfLPPair
            .sub(deadWallet1Supply)
            .sub(deadWallet2Supply);

        uint256 totalUSDValueOfPair = getTotalUSDValueOfLPPair();

        uint256 lpTokenAmountForReturn = _usdValue * circulatingSupply / totalUSDValueOfPair; 

        return lpTokenAmountForReturn;
    }

    function getTotalUSDValueOfTreasury() public view returns (uint256) {
        uint256 antCoinUSDValue = getANTCoinUSDValue(IERC20(antCToken).balanceOf(address(this)));
        uint256 antCLPTokenValue = getANTCoinLPTokenUSDValue(IERC20(address(antCLPPair)).balanceOf(address(this)));
        uint256 assetsUSDValue = getTotalAssetsUSDValue();

        return antCoinUSDValue + antCLPTokenValue + assetsUSDValue;
    }

    function getKOATTUSDPrice(uint256 _KOATTAmount) public view returns (uint256) {
        return (_KOATTAmount * totalSupply() * PRECISION_E6) / getTotalUSDValueOfTreasury();
    }

    function getAssetAmountForKOATT(uint256 _KOATTAmount, address _assetAddress) public view isAvailableAsset(_assetAddress) returns (uint256 assetAmount) {
        uint256 KOATTPrice = getKOATTUSDPrice(_KOATTAmount);

        address[] memory path = new address[](2);
        path[0] = usdtAddress;
        path[1] = _assetAddress;

        if (_assetAddress != usdtAddress) {
            uint256[] memory amounts = uniswapV2Router.getAmountsOut(KOATTPrice, path);
            assetAmount = amounts[1];
        } else {
            assetAmount = KOATTPrice;
        }
    }

    /**
     * @notice Function to buy KOATT tokens
     * @param _KOATTAmount KOATT amount to buy
     * @param _assetAddress asset address that uses for purchase kOATT tokens
     * @param _assetAmount asset amount that uses for purchase KOATT tokens
     */

    function buyKOATTTokens(uint256 _KOATTAmount, address _assetAddress, uint256 _assetAmount) external payable nonReentrant whenNotPaused isAvailableAsset(_assetAddress) {
        uint256 expectedAssetAmount = getAssetAmountForKOATT(_KOATTAmount, _assetAddress);
        require(_assetAmount >= expectedAssetAmount, "Treasury: Insufficient Asset Amount");

        if (_assetAddress == _wETH) {
            require(msg.value >= _assetAmount, "Treasury: Insufficient Funds");
            IWETH(_wETH).deposit{value: msg.value}();
            uint256 buyTax = (_assetAmount * buyTaxFee) / 100;
            IERC20(_assetAddress).transfer(teamWallet, buyTax);
        } else {
            require(IERC20(_assetAddress).allowance(_msgSender(), address(this)) >= _assetAmount, "Treasury: Insufficient Asset Allowance");
            require(IERC20(_assetAddress).balanceOf(_msgSender()) >= _assetAmount, "Treasury: Insufficient Asset Balance");
            uint256 buyTax = (_assetAmount * buyTaxFee) / 100;
            IERC20(_assetAddress).transferFrom(_msgSender(), address(this), _assetAmount);
            IERC20(_assetAddress).transfer(teamWallet, buyTax);
        }

        _mint(_msgSender(), _KOATTAmount);

        emit BuyKOATTTokens(_msgSender(), _KOATTAmount);
    }

    /**
     * @notice Function to sell KOATT tokens
     * @param _KOATTAmount KOATT amount to sell
     */

    function sellKOATTTokens(uint256 _KOATTAmount) external nonReentrant whenNotPaused {
        require(balanceOf(_msgSender()) >= _KOATTAmount, "Treasury: Insufficient KOATT balance");
        uint256 totalTreasuryUSDValue = getTotalUSDValueOfTreasury();
        uint256 antCoinUSDValue = getANTCoinUSDValue(IERC20(antCToken).balanceOf(address(this)));
        uint256 lpTokenUSDValue = getANTCoinLPTokenUSDValue(IERC20(address(antCLPPair)).balanceOf(address(this)));
        uint256 assetsUSDValue = getTotalAssetsUSDValue();
        uint256 usdValueForSell = getKOATTUSDPrice(_KOATTAmount);

        uint256 antCTokenSaleValue = (antCoinUSDValue * usdValueForSell) / totalTreasuryUSDValue;
        uint256 lpTokenSaleValue = (lpTokenUSDValue * usdValueForSell) / totalTreasuryUSDValue;
        uint256 assetsSaleValue = (assetsUSDValue * usdValueForSell) / totalTreasuryUSDValue;
        _sellANTCoinToUsers(antCTokenSaleValue, _msgSender());
        _sellANTCLPTokensToUsers(lpTokenSaleValue, _msgSender());
        _sellTreasuryAssetsToUsers(assetsSaleValue, assetsUSDValue, _msgSender());

        _burn(_msgSender(), _KOATTAmount);

        emit SellKOATTTokens(_msgSender(), _KOATTAmount);
    }

    function _sellANTCoinToUsers(uint256 _antCTokenSaleValue, address _recipient) internal {
        if (_antCTokenSaleValue > 0) {
            address[] memory _path0 = new address[](2);
            _path0[0] = usdtAddress;
            _path0[1] = _wETH;

            address[] memory _path1 = new address[](2);
            _path1[0] = _wETH;
            _path1[1] = antCToken;

            uint256[] memory amounts0 = uniswapV2Router.getAmountsOut(_antCTokenSaleValue, _path0);
            uint256[] memory amounts1 = uniswapV2Router.getAmountsOut(amounts0[1], _path1);
            uint256 antCoinAmountToSend = amounts1[1];
            uint256 sellTaxAmount = (antCoinAmountToSend * sellTaxFee) / 100;

            IERC20(antCToken).transfer(_recipient, antCoinAmountToSend - sellTaxAmount);
            IERC20(antCToken).transfer(teamWallet, sellTaxAmount);
        }
    }

    function _sellANTCLPTokensToUsers(uint256 _antCLPTokenSaleValue, address _recipient) internal {
        if (_antCLPTokenSaleValue > 0) {
            uint256 _lpTokenAmountForSale = getLPTokenAmountFromUSDValue(_antCLPTokenSaleValue);

            if (_lpTokenAmountForSale > IERC20(address(antCLPPair)).balanceOf(address(this))) {
                uint256 sellTaxAmount = (_lpTokenAmountForSale * sellTaxFee) / 100;
                IERC20(address(antCLPPair)).transfer(_recipient, _lpTokenAmountForSale - sellTaxAmount);
                IERC20(teamWallet).transfer(_recipient, sellTaxAmount);
            }
        }
    }

    function _sellTreasuryAssetsToUsers(uint256 _assetsSaleValue, uint256 _assetsTotalUSDValue, address _recipient) internal {
        if (_assetsSaleValue > 0) {
            for (uint256 i = 0; i < _activeAssets.length; i++) {
                uint256 _assetAmountToSend = (_assetsSaleValue * getAssetUSDValue(i)) / _assetsTotalUSDValue;
                uint256 sellTaxAmount = (_assetAmountToSend * sellTaxFee) / 100;
                IERC20(_activeAssets[i].asset).transfer(_recipient, _assetAmountToSend - sellTaxAmount);
                IERC20(_activeAssets[i].asset).transfer(teamWallet, sellTaxAmount);
            }
        }
    }

    /**
     * @notice Function to add liquidity
     * @param _depositAmountETH ETH deposit amount to add liquidity pool
     */

    function _addLiquidity(uint256 _depositAmountETH) internal {
        uint256[] memory amounts = _swapExactETHforTokens(
            _depositAmountETH / 2,
            antCToken
        );

        IERC20(antCToken).approve(address(uniswapV2Router), amounts[1]);

        uniswapV2Router.addLiquidityETH{value: _depositAmountETH / 2}(
            antCToken,
            amounts[1],
            0, // Slippage is unavoidable
            0, // Slippage is unavoidable
            address(this),
            block.timestamp + 100
        );
    }

    /**
     * @notice Exchange the Matic to ERC20 token amounts
     * @param _amount Amount of ETH to swap
     * @param _tokenAddress ERC20 token address for exchange
     * @return amounts the token exchanged values
     */

    function _swapExactETHforTokens(
        uint256 _amount,
        address _tokenAddress
    ) internal returns (uint256[] memory amounts) {
        address[] memory path = new address[](2);
        path[0] = uniswapV2Router.WETH();
        path[1] = _tokenAddress;
        amounts = uniswapV2Router.swapExactETHForTokens{value: _amount}(
            _amount,
            path,
            address(this),
            block.timestamp + 300
        );
    }

    /**
     * @notice Transfer ETH and return the success status.
     * @dev This function only forwards 30,000 gas to the callee.
     * @param to Address for ETH to be send to
     * @param value Amount of ETH to send
     */

    function _safeTransferETH(
        address to,
        uint256 value
    ) internal returns (bool) {
        (bool success, ) = to.call{value: value, gas: 30_000}(new bytes(0));
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
     * @dev Override decimals to set the default value to 1
     */

    function decimals() public view virtual override returns (uint8) {
        return 1;
    }

    /**
     * @notice Check address has minterRole
     */

    function getMinterRole(address _address) public view returns (bool) {
        return minters[_address];
    }

    /**
     * @notice Returns an array of assets included in the index
     * @return assets An array of assets included in the index with all information about them
     */

    function getActiveAssets() external view returns (Asset[] memory assets) {
        return _activeAssets;
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
     * @notice Function to deposit the funds to each teasury pools
     * @dev This function can only be called by the owner
     */

    function depositFundsETH() external payable onlyOwner {
        require(msg.value > 0, "Treasury: deposit ETH can not be zero");
        uint256 depositETH = msg.value;
        _depositToANTCTreasury((depositETH * distributeRates[0]) / 100);
        _addLiquidity((depositETH * distributeRates[1]) / 100);
        _distributeToAssets((depositETH * distributeRates[2]) / 100);

        emit OwnerDepositETH(depositETH);
    }

    /**
     * @notice Add the asset information with asset address and usd price feed
     * @dev This function can only be called by the owner
     * @param _assets treasury assets
     */

    function addActiveAssets(Asset[] memory _assets) external onlyOwner {
        require(_assets.length > 0, "Treasury: invalid assets data");
        for (uint256 i = 0; i < _assets.length; i++) {
            _activeAssets.push(_assets[i]);
        }
    }
 
    /**
     * @notice Update the asset information
     * @dev This function can only be called by the owner
     * @param _assets treasury assets
     */

    function updateActiveAssets(Asset[] memory _assets) external onlyOwner {
        _clearActiveAssets();
        require(_assets.length > 0, "Treasury: invalid assets data");
        for (uint256 i = 0; i < _assets.length; i++) {
            _activeAssets.push(_assets[i]);
        }
    }

    /**
     * @notice Set a new ant coin token contract address
     * @dev This function can only be called by the owner
     * @param _antCToken ant coin smart contract address
     */

    function setANTCToken(address _antCToken) external onlyOwner {
        require(_antCToken != address(0x0), "Treasury: ant coin address can not be null");
        antCToken = _antCToken;
    }

    /**
     * @notice Set a new ant coin lp token contract address
     * @dev This function can only be called by the owner
     * @param _antCLPPair ant coin lp smart contract address
     */

    function setANTCLPPair(IUniswapV2Pair _antCLPPair) external onlyOwner {
        require(address(_antCLPPair) != address(0x0), "Treasury: ant coin lp token address can not be null");
        antCLPPair = _antCLPPair;
    }

    /**
     * @notice Set Buy Tax Fee Rate
     * @dev This function can only be called by the owner
     * @param _buyTaxFee buy tax fee rate
     */

    function setBuyTaxFee(uint256 _buyTaxFee) external onlyOwner {
        buyTaxFee = _buyTaxFee;
    }

    /**
     * @notice Set Sell Tax Fee Rate
     * @dev This function can only be called by the owner
     * @param _sellTaxFee sell tax fee rate
     */

    function setSellTaxFee(uint256 _sellTaxFee) external onlyOwner {
        sellTaxFee = _sellTaxFee;
    }

    /**
     * @notice Set Team Wallet Address to get the tax fee
     * @dev This function can only be called by the owner
     * @param _teamWallet team wallet address
     */

    function setTeamWallet(address _teamWallet) external onlyOwner {
        require(_teamWallet != address(0x0), "Treasury: Team wallet address can not be null");
        teamWallet = _teamWallet;
    }

    function setDistributeRates(uint256[3] calldata _rates) external onlyOwner {
        require(_rates[0] + _rates[1] + _rates[2] == 100, "Treasury: total value should be 100");
        distributeRates = _rates;
    }

    function setUSDTAddress(address _usdtAddress) external onlyOwner {
        require(_usdtAddress != address(0x0));
        usdtAddress = _usdtAddress;
    }

    /**
     * @notice Function to grant mint role
     * @dev This function can only be called by the owner
     * @param _address address to get minter role
     */

    function addMinterRole(address _address) external onlyOwner {
        minters[_address] = true;
    }

    /**
     * @notice Function to revoke mint role
     * @dev This function can only be called by the owner
     * @param _address address to revoke minter role
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

    // To recieve ETH from uniswapV2Router when swaping
    receive() external payable {}

    function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}
