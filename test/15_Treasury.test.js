const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")

const QuickSwapFactoryABI = require('./abi/QuickswapFactory.json')
const RouterABI = require('./abi/Router.json')

describe("Treasury", function () {
    let ANTCoin, ANTCoinContract, Treasury, TreasuryContract, WETHAddress, QuickSwapFactoryContract, QuickSwapRouterContract;
    let ANTCoinContractAddress, TreasuryContractAddress = '';
    const quickSwapMainnetRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
    const quickSwapFactoryAddress = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
    const wBTCAddress = "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"
    const wETHAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"
    const usdtAddress = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
    const wMaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        // ANTCoin smart contract deployment
        ANTCoin = await hre.ethers.getContractFactory("ANTCoin");
        ANTCoinContract = await hre.upgrades.deployProxy(ANTCoin, [ethers.parseEther("200000000"), "0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"], {
            initializer: "initialize",
            kind: "transparent",
        });
        await ANTCoinContract.waitForDeployment();
        ANTCoinContractAddress = await ANTCoinContract.getAddress();

        Treasury = await hre.ethers.getContractFactory("Treasury");
        TreasuryContract = await hre.upgrades.deployProxy(Treasury, [quickSwapMainnetRouterAddress, ANTCoinContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await TreasuryContract.waitForDeployment();
        TreasuryContractAddress = await TreasuryContract.getAddress();

        await ANTCoinContract.addMinterRole(TreasuryContractAddress);

        // create pool
        WETHAddress = await TreasuryContract._wETH();

        const provider = hre.ethers.provider;

        QuickSwapFactoryContract = new hre.ethers.Contract(quickSwapFactoryAddress, QuickSwapFactoryABI, provider);

        await QuickSwapFactoryContract.connect(deployer).createPair(ANTCoinContractAddress, WETHAddress);

        const pairAddress = await QuickSwapFactoryContract.getPair(ANTCoinContractAddress, WETHAddress);
        await TreasuryContract.setANTCLPPair(pairAddress);

        QuickSwapRouterContract = new hre.ethers.Contract(quickSwapMainnetRouterAddress, RouterABI, provider);
        await ANTCoinContract.approve(quickSwapMainnetRouterAddress, ethers.parseEther("100000"));
        // antc addLiquidity
        await QuickSwapRouterContract.connect(deployer).addLiquidityETH(ANTCoinContractAddress, ethers.parseEther("100000"), 0, 0, deployer.address, Date.now() + 1000, {
            value: ethers.parseEther('100'),
        })

        // await TreasuryContract.setANTCLPPair(pairAddress);
        await TreasuryContract.addActiveAssets([[wMaticAddress, [wMaticAddress, usdtAddress]]]);

        // // swap btc
        // await QuickSwapRouterContract.connect(user1).swapExactETHForTokens(ethers.parseEther("1"), [wMaticAddress, wBTCAddress], user1.address, Date.now() + 1000, {
        //     value: ethers.parseEther('5')
        // })

        // // swap eth

        // await QuickSwapRouterContract.connect(user1).swapExactETHForTokens(ethers.parseEther("1"), [wMaticAddress, wETHAddress], user1.address, Date.now() + 1000, {
        //     value: ethers.parseEther('5')
        // })

        // swap usdt

        // await QuickSwapRouterContract.connect(user1).swapExactETHForTokens(ethers.parseEther("1"), [wMaticAddress, usdtAddress], user1.address, Date.now() + 1000, {
        //     value: ethers.parseEther('5')
        // })

        // await TreasuryContract.updateActiveAssets([wBTCAddress, wETHAddress, usdtAddress])

        // matic
        // eth
        // await TreasuryContract.updateActiveAssets(["0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"], ["0xF9680D99D6C9589e2a93a78A04A279e509205945"])
        // usdt
        // await TreasuryContract.updateActiveAssets(["0xc2132D05D31c914a87C6611C10748AEb04B58e8F"], ["0x0A6513e40db6EB1b165753AD52E80663aeA50545"])

    })

    describe("Test Suite", function () {
        it("should set the right owner", async () => {
            const owner = await TreasuryContract.owner();
            expect(owner).to.be.equal(deployer.address)
        })

        it("depositFundsETH: should work properly", async () => {
            await TreasuryContract.depositFundsETH({ value: ethers.parseEther("10") });
            const totalUSDBalance = await TreasuryContract.getTotalAssetsUSDValue();
            expect(totalUSDBalance).to.be.not.equal(0)
            console.log("total Assets USD Value:", Number(totalUSDBalance))
        });

        it("antCValue:", async () => {
            const antCBalance = await TreasuryContract.getANTCoinUSDValue(ethers.parseEther("100"));
            console.log("ant coin use value:", Number(antCBalance))
        })

        it("LPTokenValue:", async () => {
            const lpTokenValue = await TreasuryContract.getANTCoinLPTokenUSDValue(ethers.parseEther("3190"))
            console.log("lpTokenValue:", Number(lpTokenValue))
        })

        it("totalUSDValue of treasury contract", async () => {
            await TreasuryContract.depositFundsETH({ value: ethers.parseEther("10") });
            const totalUSDValueOfTreasury = await TreasuryContract.getTotalUSDValueOfTreasury();
            console.log("totalTreasuryUSDValue:", Number(totalUSDValueOfTreasury));

            const KOATTPrice = await TreasuryContract.getKOATTUSDPrice(10);
            console.log("KOATTPrice per one token:", Number(KOATTPrice))
        })

        it("buyKOATTTokens", async () => {
            await TreasuryContract.depositFundsETH({ value: ethers.parseEther("10") });
            const expectedAssetAmount = await TreasuryContract.getAssetAmountForKOATT(100, wMaticAddress);
            await TreasuryContract.buyKOATTTokens(100, wMaticAddress, expectedAssetAmount, { value: expectedAssetAmount })
        });

        it("sellKOATTTokens", async () => {
            await TreasuryContract.depositFundsETH({ value: ethers.parseEther("10") });
            const expectedAssetAmount = await TreasuryContract.getAssetAmountForKOATT(100, wMaticAddress);
            await TreasuryContract.connect(user1).buyKOATTTokens(100, wMaticAddress, expectedAssetAmount, { value: expectedAssetAmount })
            await TreasuryContract.connect(user1).sellKOATTTokens(10);
        })
    })
})