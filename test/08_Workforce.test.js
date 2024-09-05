const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")
const { network } = require("hardhat")

describe.skip("Workforce", function () {
    let ANTCoin, ANTCoinContract, BasicANT, BasicANTContract, PremiumANT, PremiumANTContract, ANTShop, ANTShopContract, Workforce, WorkforceContract;
    let RandomizerContractAddress, MockRandomizerContractAddress, ANTCoinContractAddress, ANTShopContractAddress, ANTLotteryContractAddress, PurseContractAddress, MarketplaceContractAddress, BasicANTContractAddress, PremiumANTContractAddress, WorkforceContractAddress = ''

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

        // ANTShop smart contract deployment
        ANTShop = await hre.ethers.getContractFactory("ANTShop");
        ANTShopContract = await hre.upgrades.deployProxy(ANTShop, [], {
            initializer: "initialize",
            kind: "transparent",
        });
        await ANTShopContract.waitForDeployment();
        ANTShopContractAddress = await ANTShopContract.getAddress();

        // set ANTFood and LevelingPotions contract
        await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI1");
        await ANTShopContract.setTokenTypeInfo(1, "Leveling Potions", "testBaseURI2");

        // Basic ANT smart contract deployment
        BasicANT = await hre.ethers.getContractFactory("BasicANT");
        BasicANTContract = await hre.upgrades.deployProxy(BasicANT, [ANTCoinContractAddress, ANTShopContractAddress], {
            initializer: "initialize",
            kind: "transparent",
        });
        await BasicANTContract.waitForDeployment();
        BasicANTContractAddress = await BasicANTContract.getAddress();
        await ANTShopContract.addMinterRole(BasicANTContractAddress);

        // Premium ANT smart contract deployment
        PremiumANT = await hre.ethers.getContractFactory("PremiumANT");
        PremiumANTContract = await hre.upgrades.deployProxy(PremiumANT, [ANTCoinContractAddress, ANTShopContractAddress], {
            initializer: "initialize",
            kind: "transparent",
        });
        await PremiumANTContract.waitForDeployment();
        PremiumANTContractAddress = await PremiumANTContract.getAddress();
        await ANTShopContract.addMinterRole(PremiumANTContractAddress);

        // Workforce contract deployment
        Workforce = await hre.ethers.getContractFactory("Workforce");
        WorkforceContract = await hre.upgrades.deployProxy(Workforce, [ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await WorkforceContract.waitForDeployment();
        WorkforceContractAddress = await WorkforceContract.getAddress();

        // give a minterRole to Workforce contract
        await ANTCoinContract.addMinterRole(WorkforceContractAddress);
        await PremiumANTContract.addMinterRole(WorkforceContractAddress);
        await BasicANTContract.addMinterRole(WorkforceContractAddress);
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await WorkforceContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("all contracts should be set correctly", async () => {
            const antCoinAddress = await WorkforceContract.antCoin();
            const premiumANT = await WorkforceContract.premiumANT();
            const basicANT = await WorkforceContract.basicANT();
            expect(antCoinAddress).to.be.equal(ANTCoinContractAddress);
            expect(premiumANT).to.be.equal(PremiumANTContractAddress);
            expect(basicANT).to.be.equal(BasicANTContractAddress);
        })

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(WorkforceContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await WorkforceContract.addMinterRole(user1.address);
            const role = await WorkforceContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(WorkforceContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await WorkforceContract.addMinterRole(user1.address);
            const role1 = await WorkforceContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await WorkforceContract.revokeMinterRole(user1.address);
            const role2 = await WorkforceContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        });

        it("setInitLevelAfterUnstake: should work if caller is owner", async () => {
            const initLevelAfterUnstake = await WorkforceContract.initLevelAfterUnstake();
            expect(initLevelAfterUnstake).to.be.equal(1);
            await WorkforceContract.setInitLevelAfterUnstake(2);
            const expected = await WorkforceContract.initLevelAfterUnstake();
            expect(expected).to.be.equal(2);
        });

        it("setMaxStakePeriod: should work if caller is owner", async () => {
            const maxStakePeriod = await WorkforceContract.maxStakePeriod();
            expect(maxStakePeriod).to.be.equal(60 * 60 * 24 * 365 * 3);
            await WorkforceContract.setMaxStakePeriod(60 * 60 * 24 * 365 * 4);
            const expected = await WorkforceContract.maxStakePeriod();
            expect(expected).to.be.equal(60 * 60 * 24 * 365 * 4);
        });

        it("setCycleStakePeriod: should work if caller is owner", async () => {
            const cycleStakePeriod = await WorkforceContract.cycleStakePeriod();
            expect(cycleStakePeriod).to.be.equal(60 * 60 * 24 * 365 * 1);
            await WorkforceContract.setCycleStakePeriod(60 * 60 * 24 * 365 * 2);
            const expected = await WorkforceContract.cycleStakePeriod();
            expect(expected).to.be.equal(60 * 60 * 24 * 365 * 2);
        });

        it("setANTCoinContract: should work if caller is owner", async () => {
            const antCoin = await WorkforceContract.antCoin();
            expect(antCoin).to.be.equal(ANTCoinContractAddress);
            await WorkforceContract.setANTCoinContract(user1.address);
            const expected = await WorkforceContract.antCoin();
            expect(expected).to.be.equal(user1.address);
        })

        it("setPremiumANTContract: should work if caller is owner", async () => {
            const premiumANT = await WorkforceContract.premiumANT();
            expect(premiumANT).to.be.equal(PremiumANTContractAddress);
            await WorkforceContract.setPremiumANTContract(user1.address);
            const expected = await WorkforceContract.premiumANT();
            expect(expected).to.be.equal(user1.address);
        })

        it("setBasicANTContract: should work if caller is owner", async () => {
            const basicANT = await WorkforceContract.basicANT();
            expect(basicANT).to.be.equal(BasicANTContractAddress);
            await WorkforceContract.setBasicANTContract(user1.address);
            const expected = await WorkforceContract.basicANT();
            expect(expected).to.be.equal(user1.address);
        })

        it("stakePremiumANT: should fail if caller is not the owner of the premium ant token", async () => {
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await expect(WorkforceContract.connect(user2).stakePremiumANT(1, 0)).to.be.revertedWith("Workforce: you are not owner of this token");
        })

        it("stakePremiumANT: should fail if caller don't have enough ant coin balance for stake", async () => {
            const antCoinTransferAmount = 100000000000;
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await expect(WorkforceContract.connect(user1).stakePremiumANT(1, antCoinTransferAmount + 1)).to.be.revertedWith("Workforce: insufficient ant coin balance");
        })

        it("stakePremiumANT: should work if all conditions are correct", async () => {
            const antCoinTransferAmount = 100000000000;
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            // batch index 0 mint of premium ants
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            const blockNumber = await hre.ethers.provider.getBlockNumber();
            const block = await hre.ethers.provider.getBlock(blockNumber);
            const tx1 = await WorkforceContract.connect(user1).stakePremiumANT(1, antCoinTransferAmount);
            const premiumANTStakeInfo = await WorkforceContract.getPremiumANTStakeInfo(1);
            expect(premiumANTStakeInfo.tokenId).to.be.equal(1);
            expect(premiumANTStakeInfo.owner).to.be.equal(user1.address);
            expect(premiumANTStakeInfo.batchIndex).to.be.equal(0);
            expect(premiumANTStakeInfo.antCStakeAmount).to.be.equal(antCoinTransferAmount);
            expect(premiumANTStakeInfo.originTimestamp).to.be.equal(block.timestamp + 1);
            const expectedOwner1 = await PremiumANTContract.ownerOf(1);
            const expectedANTCoinBalance1 = await ANTCoinContract.balanceOf(WorkforceContractAddress);
            expect(expectedOwner1).to.be.equal(WorkforceContractAddress);
            expect(expectedANTCoinBalance1).to.be.equal(antCoinTransferAmount);
            expect(tx1).to.emit(PremiumANTContract, "StakePremiumANT").withArgs(1, user1.address);

            // batch index 1 mint of premium ants
            await PremiumANTContract.connect(user1).mint(1, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            const blockNumber1 = await hre.ethers.provider.getBlockNumber();
            const block1 = await hre.ethers.provider.getBlock(blockNumber1);
            const tx2 = await WorkforceContract.connect(user1).stakePremiumANT(2, antCoinTransferAmount);
            const premiumANTStakeInfo1 = await WorkforceContract.getPremiumANTStakeInfo(2);
            expect(premiumANTStakeInfo1.tokenId).to.be.equal(2);
            expect(premiumANTStakeInfo1.owner).to.be.equal(user1.address);
            expect(premiumANTStakeInfo1.batchIndex).to.be.equal(1);
            expect(premiumANTStakeInfo1.antCStakeAmount).to.be.equal(antCoinTransferAmount);
            expect(premiumANTStakeInfo1.originTimestamp).to.be.equal(block1.timestamp + 1);
            const expectedOwner2 = await PremiumANTContract.ownerOf(2);
            const expectedANTCoinBalance2 = await ANTCoinContract.balanceOf(WorkforceContractAddress);
            expect(expectedOwner2).to.be.equal(WorkforceContractAddress);
            expect(expectedANTCoinBalance2).to.be.equal(antCoinTransferAmount * 2);
            expect(tx2).to.emit(PremiumANTContract, "StakePremiumANT").withArgs(2, user1.address);
        })

        it("stakeBasicANT: should work if all conditions are correct", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            const antCoinTransferAmount = 100000000000;

            // batch index 0 mint of basic ants
            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            const blockNumber = await hre.ethers.provider.getBlockNumber();
            const block = await hre.ethers.provider.getBlock(blockNumber);
            const tx1 = await WorkforceContract.connect(user1).stakeBasicANT(1, antCoinTransferAmount);
            const basicANTStakeInfo = await WorkforceContract.getBasicANTStakeInfo(1);
            expect(basicANTStakeInfo.tokenId).to.be.equal(1);
            expect(basicANTStakeInfo.owner).to.be.equal(user1.address);
            expect(basicANTStakeInfo.batchIndex).to.be.equal(0);
            expect(basicANTStakeInfo.antCStakeAmount).to.be.equal(antCoinTransferAmount);
            expect(basicANTStakeInfo.originTimestamp).to.be.equal(block.timestamp + 1);
            const expectedOwner1 = await BasicANTContract.ownerOf(1);
            const expectedANTCoinBalance1 = await ANTCoinContract.balanceOf(WorkforceContractAddress);
            expect(expectedOwner1).to.be.equal(WorkforceContractAddress);
            expect(expectedANTCoinBalance1).to.be.equal(antCoinTransferAmount);
            expect(tx1).to.emit(BasicANTContract, "StakeBasicANT").withArgs(1, user1.address);

            // batch index 1 mint of basic ants
            await BasicANTContract.connect(user1).mint(1, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            const blockNumber2 = await hre.ethers.provider.getBlockNumber();
            const block2 = await hre.ethers.provider.getBlock(blockNumber2);
            const tx2 = await WorkforceContract.connect(user1).stakeBasicANT(2, antCoinTransferAmount);
            const basicANTStakeInfo2 = await WorkforceContract.getBasicANTStakeInfo(2);
            expect(basicANTStakeInfo2.tokenId).to.be.equal(2);
            expect(basicANTStakeInfo2.owner).to.be.equal(user1.address);
            expect(basicANTStakeInfo2.batchIndex).to.be.equal(1);
            expect(basicANTStakeInfo2.antCStakeAmount).to.be.equal(antCoinTransferAmount);
            expect(basicANTStakeInfo2.originTimestamp).to.be.equal(block2.timestamp + 1);
            const expectedOwner2 = await BasicANTContract.ownerOf(2);
            const expectedANTCoinBalance2 = await ANTCoinContract.balanceOf(WorkforceContractAddress);
            expect(expectedOwner2).to.be.equal(WorkforceContractAddress);
            expect(expectedANTCoinBalance2).to.be.equal(antCoinTransferAmount * 2);
            expect(tx2).to.emit(BasicANTContract, "StakeBasicANT").withArgs(2, user1.address);
        })

        it("pendingRewardOfPremiumToken: should calculated rewards correclty regarding ant expereince", async () => {
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            // batch index 0 mint of premium ants
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakePremiumANT(1, antCoinTransferAmount);
            const premiumANTStakeInfo = await WorkforceContract.getPremiumANTStakeInfo(1);
            const yearTimeStamp = 60 * 60 * 24 * 365; // a year
            await increaseTime(yearTimeStamp);
            const pendingAmount1 = await WorkforceContract.pendingRewardOfPremiumToken(1);
            const cycleStakePeriod = await WorkforceContract.cycleStakePeriod();
            const antExpereince = await PremiumANTContract.getANTExperience(1);
            const expected = antCoinTransferAmount * BigInt(antExpereince) * BigInt(yearTimeStamp) / BigInt(cycleStakePeriod * BigInt(10 ** 4));
            expect(Math.floor(Number(ethers.formatEther(pendingAmount1)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected))))
            await increaseTime(yearTimeStamp * 4);
            const pendingAmount2 = await WorkforceContract.pendingRewardOfPremiumToken(1);
            console.log("premium ant level: 20, batchIndex: 0 (worker ant), stakePeriod: 3 years, antcoin staked amount: 10k, rewardAmount: ", ethers.formatEther(pendingAmount2))
            expect(Math.floor(Number(ethers.formatEther(pendingAmount2)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected * BigInt(3)))))

            // batch index 1 mint of premium ants
            await PremiumANTContract.connect(user1).mint(1, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakePremiumANT(2, antCoinTransferAmount);
            await increaseTime(yearTimeStamp);
            const pendingAmount3 = await WorkforceContract.pendingRewardOfPremiumToken(2);
            const cycleStakePeriod1 = await WorkforceContract.cycleStakePeriod();
            const antExpereince1 = await PremiumANTContract.getANTExperience(2);
            const expected1 = antCoinTransferAmount * BigInt(antExpereince1) * BigInt(yearTimeStamp) / BigInt(cycleStakePeriod1 * BigInt(10 ** 4));
            expect(Math.floor(Number(ethers.formatEther(pendingAmount3)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected1))))
            await increaseTime(yearTimeStamp * 4);
            const pendingAmount4 = await WorkforceContract.pendingRewardOfPremiumToken(2);
            console.log("premium ant level: 20, batchIndex: 1 (wise ant), stakePeriod: 3 years, antcoin staked amount: 10k, rewardAmount: ", ethers.formatEther(pendingAmount4))
            expect(Math.floor(Number(ethers.formatEther(pendingAmount4)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected1 * BigInt(3)))))
        })

        it("pendingRewardOfBasicToken: should calculated rewards correclty regarding ant expereince", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);

            // batch index 0 mint of premium ants
            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakeBasicANT(1, antCoinTransferAmount);
            const basicANTStakeInfo = await WorkforceContract.getBasicANTStakeInfo(1);
            const yearTimeStamp = 60 * 60 * 24 * 365; // a year
            await increaseTime(yearTimeStamp);
            const pendingAmount1 = await WorkforceContract.pendingRewardOfBasicToken(1);
            const cycleStakePeriod = await WorkforceContract.cycleStakePeriod();
            const antExpereince = await BasicANTContract.getANTExperience(1);
            const expected = antCoinTransferAmount * BigInt(antExpereince) * BigInt(yearTimeStamp) / BigInt(cycleStakePeriod * BigInt(10 ** 4));
            expect(Math.floor(Number(ethers.formatEther(pendingAmount1)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected))))
            await increaseTime(yearTimeStamp * 4);
            const pendingAmount2 = await WorkforceContract.pendingRewardOfBasicToken(1);
            console.log("basic ant level: 1, batchIndex: 0 (worker ant), stakePeriod: 3 years, antcoin staked amount: 10k, rewardAmount: ", ethers.formatEther(pendingAmount2))
            expect(Math.floor(Number(ethers.formatEther(pendingAmount2)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected * BigInt(3)))))

            // batch index 1 mint of premium ants
            await BasicANTContract.connect(user1).mint(1, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakeBasicANT(2, antCoinTransferAmount);
            const basicANTStakeInfo1 = await WorkforceContract.getBasicANTStakeInfo(2);
            await increaseTime(yearTimeStamp);
            const pendingAmount3 = await WorkforceContract.pendingRewardOfBasicToken(2);
            const cycleStakePeriod1 = await WorkforceContract.cycleStakePeriod();
            const antExpereince1 = await BasicANTContract.getANTExperience(2);
            const expected1 = antCoinTransferAmount * BigInt(antExpereince1) * BigInt(yearTimeStamp) / BigInt(cycleStakePeriod1 * BigInt(10 ** 4));
            expect(Math.floor(Number(ethers.formatEther(pendingAmount3)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected1))))
            await increaseTime(yearTimeStamp * 4);
            const pendingAmount4 = await WorkforceContract.pendingRewardOfBasicToken(2);
            console.log("basic ant level: 1, batchIndex: 1 (wise ant), stakePeriod: 3 years, antcoin staked amount: 10k, rewardAmount: ", ethers.formatEther(pendingAmount4))
            expect(Math.floor(Number(ethers.formatEther(pendingAmount4)))).to.be.equal(Math.floor(Number(ethers.formatEther(expected1 * BigInt(3)))))
        })

        it("unStakePremiumANT: should fail if caller is not owne of staekd ant", async () => {
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakePremiumANT(1, antCoinTransferAmount);
            const balance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(balance1).to.be.equal(0);
            const yearTimeStamp = 60 * 60 * 24 * 365; // a year
            await increaseTime(yearTimeStamp);
            await expect(WorkforceContract.connect(badActor).unStakePremiumANT(1)).to.be.revertedWith("Workforce: you are not owner of this premium ant");
        })

        it("unStakePremiumANT: should unstake with reward and ant level should be 1", async () => {
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakePremiumANT(1, antCoinTransferAmount);
            const balance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(balance1).to.be.equal(0);
            const yearTimeStamp = 60 * 60 * 24 * 365; // a year
            await increaseTime(yearTimeStamp);
            const pendingAmount1 = await WorkforceContract.pendingRewardOfPremiumToken(1);
            await WorkforceContract.connect(user1).unStakePremiumANT(1);
            const expectedBalance = await ANTCoinContract.balanceOf(user1.address);
            expect(Math.floor(Number(ethers.formatEther(expectedBalance)))).to.be.equal(Math.floor(Number(ethers.formatEther(pendingAmount1 + BigInt(antCoinTransferAmount)))))
            const antInfo = await PremiumANTContract.getANTInfo(1);
            expect(antInfo.level).to.be.equal(1);
        })

        it("unStakeBasicANT: should fail if caller is not owne of staekd ant", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);

            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakeBasicANT(1, antCoinTransferAmount);
            const balance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(balance1).to.be.equal(0);
            const yearTimeStamp = 60 * 60 * 24 * 365; // a year
            await increaseTime(yearTimeStamp);
            await expect(WorkforceContract.connect(badActor).unStakeBasicANT(1)).to.be.revertedWith("Workforce: you are not owner of this basic ant");
        })

        it("unStakeBasicANT: should unstake with reward and ant level should be 1", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);

            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakeBasicANT(1, antCoinTransferAmount);
            const balance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(balance1).to.be.equal(0);
            const yearTimeStamp = 60 * 60 * 24 * 365; // a year
            await increaseTime(yearTimeStamp);
            const pendingAmount1 = await WorkforceContract.pendingRewardOfBasicToken(1);
            await WorkforceContract.connect(user1).unStakeBasicANT(1);
            const expectedBalance = await ANTCoinContract.balanceOf(user1.address);
            expect(Math.floor(Number(ethers.formatEther(expectedBalance)))).to.be.equal(Math.floor(Number(ethers.formatEther(pendingAmount1 + BigInt(antCoinTransferAmount)))))
            const antInfo = await BasicANTContract.getANTInfo(1);
            expect(antInfo.level).to.be.equal(1);
        })

        it("getPremiumANTStakedByAddress: should return the correct staked ant token ids", async () => {
            const antCoinTransferAmount = 100000000000;
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            // batch index 0 mint of premium ants
            await PremiumANTContract.connect(user1).mint(0, user1.address, 4);
            await PremiumANTContract.connect(user1).mint(1, user1.address, 4);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakePremiumANT(1, 1000);
            await WorkforceContract.connect(user1).stakePremiumANT(4, 1000);
            await WorkforceContract.connect(user1).stakePremiumANT(5, 1000);
            await WorkforceContract.connect(user1).stakePremiumANT(3, 1000);
            const stakedPremiumANTs = await WorkforceContract.getPremiumANTStakedByAddress(user1.address);
            expect(stakedPremiumANTs.toString()).to.be.equal("1,4,5,3");
            await WorkforceContract.connect(user1).unStakePremiumANT(4);
            const stakedPremiumANTs1 = await WorkforceContract.getPremiumANTStakedByAddress(user1.address);
            expect(stakedPremiumANTs1.toString()).to.be.equal("1,3,5");
            await WorkforceContract.connect(user1).stakePremiumANT(2, 1000);
            const stakedPremiumANTs2 = await WorkforceContract.getPremiumANTStakedByAddress(user1.address);
            expect(stakedPremiumANTs2.toString()).to.be.equal("1,3,5,2");
            await WorkforceContract.connect(user1).unStakePremiumANT(1);
            const stakedPremiumANTs3 = await WorkforceContract.getPremiumANTStakedByAddress(user1.address);
            expect(stakedPremiumANTs3.toString()).to.be.equal("2,3,5");
        })

        it("getBasicANTStakedByAddress: should return the correct staked ant token ids", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            const antCoinTransferAmount = ethers.parseEther("10000");
            await ANTShopContract.mint(0, 10, user1.address);
            await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await ANTCoinContract.transfer(user1.address, 1000000000);

            await BasicANTContract.connect(user1).mint(0, user1.address, 5, { value: maticMintPrice * 5 });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakeBasicANT(1, 1000);
            await WorkforceContract.connect(user1).stakeBasicANT(4, 1000);
            await WorkforceContract.connect(user1).stakeBasicANT(5, 1000);
            await WorkforceContract.connect(user1).stakeBasicANT(3, 1000);
            const stakedBasicANTs = await WorkforceContract.getBasicANTStakedByAddress(user1.address);
            expect(stakedBasicANTs.toString()).to.be.equal("1,4,5,3");
            await WorkforceContract.connect(user1).unStakeBasicANT(4);
            const stakedBasicANTs1 = await WorkforceContract.getBasicANTStakedByAddress(user1.address);
            expect(stakedBasicANTs1.toString()).to.be.equal("1,3,5");
            await WorkforceContract.connect(user1).stakeBasicANT(2, 1000);
            const stakedBasicANTs2 = await WorkforceContract.getBasicANTStakedByAddress(user1.address);
            expect(stakedBasicANTs2.toString()).to.be.equal("1,3,5,2");
            await WorkforceContract.connect(user1).unStakeBasicANT(1);
            const stakedBasicANTs3 = await WorkforceContract.getBasicANTStakedByAddress(user1.address);
            expect(stakedBasicANTs3.toString()).to.be.equal("2,3,5");
        })

        it("withdrawToken: should fail if caller is not the owner", async () => {
            await expect(WorkforceContract.connect(badActor).withdrawToken(ANTCoinContractAddress, user1.address, 10000)).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("withdrawToken: should withdraw ERC20 tokens successfully if caller is the owner", async () => {
            const antCoinTransferAmount = 100000000000;
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            // batch index 0 mint of premium ants
            await PremiumANTContract.connect(user1).mint(0, user1.address, 4);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.connect(user1).stakePremiumANT(1, 1000);
            await WorkforceContract.withdrawToken(ANTCoinContractAddress, user3.address, 1000);
            const expectedBalance = await ANTCoinContract.balanceOf(user3.address);
            expect(expectedBalance).to.be.equal(1000)
        })

        it("setPaused: should fail if caller is not the owner", async () => {
            await expect(WorkforceContract.connect(badActor).setPaused(true)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("setPaused: should stop all functions work if paused", async () => {
            await WorkforceContract.setPaused(true);
            const antCoinTransferAmount = 100000000000;
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            // batch index 0 mint of premium ants
            await PremiumANTContract.connect(user1).mint(0, user1.address, 4);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await expect(WorkforceContract.connect(user1).stakePremiumANT(1, 1000)).to.be.revertedWith("Pausable: paused");
            await expect(WorkforceContract.connect(user1).unStakePremiumANT(1)).to.be.revertedWith("Pausable: paused");
        })

        it("setLimitAntCoinStakeAmount: should fail if caller is not the owner", async () => {
            await expect(WorkforceContract.connect(badActor).setLimitAntCoinStakeAmount(100)).to.be.revertedWith("Workforce: Caller is not the owner or minter")
        })

        it("setLimitAntCoinStakeAmount: shoudl work if caller is the owner", async () => {
            await WorkforceContract.setLimitAntCoinStakeAmount(1000);
            const expected = await WorkforceContract.limitAntCoinStakeAmount();
            expect(expected).to.be.equal(1000)
        })

        it("stakeBasicANT: should fail if antcoin stake amount exceed the limit amount", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            const antCoinTransferAmount = 100000000000;
            // batch index 0 mint of basic ants
            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.setLimitAntCoinStakeAmount(100);
            const limitAntCoinStakeAmount = await WorkforceContract.limitAntCoinStakeAmount()
            await expect(WorkforceContract.connect(user1).stakeBasicANT(1, limitAntCoinStakeAmount + BigInt(1))).to.be.revertedWith("Workforce: ant coin stake amount exceed the limit amount");
            await expect(WorkforceContract.connect(user1).stakeBasicANT(1, limitAntCoinStakeAmount)).to.not.be.reverted
        })

        it("stakePremiumANT: should fail if antcoin stake amount exceed the limit amount", async () => {
            const antCoinTransferAmount = 100000000000;
            await ANTShopContract.mint(0, 10, user1.address);
            await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 1000, 1);
            await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 1000, 1);
            // batch index 0 mint of premium ants
            await PremiumANTContract.connect(user1).mint(0, user1.address, 1);
            await ANTCoinContract.transfer(user1.address, antCoinTransferAmount)
            await WorkforceContract.setLimitAntCoinStakeAmount(100);
            const limitAntCoinStakeAmount = await WorkforceContract.limitAntCoinStakeAmount()
            await expect(WorkforceContract.connect(user1).stakePremiumANT(1, limitAntCoinStakeAmount + BigInt(1))).to.be.revertedWith("Workforce: ant coin stake amount exceed the limit amount");
            await expect(WorkforceContract.connect(user1).stakePremiumANT(1, limitAntCoinStakeAmount)).to.be.not.reverted;
        })
    });
});

const rpc = ({ method, params }) => {
    return network.provider.send(method, params);
};

const increaseTime = async (seconds) => {
    await rpc({ method: "evm_increaseTime", params: [seconds] });
    return rpc({ method: "evm_mine" });
};