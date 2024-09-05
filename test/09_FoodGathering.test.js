const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")
const { network } = require("hardhat")

describe.skip("FoodGathering", function () {
    let ANTCoin, ANTCoinContract, ANTShop, ANTShopContract, FoodGathering, FoodGatheringContract, Randomizer, RandomizerContract;
    let RandomizerContractAddress, MockRandomizerContractAddress, ANTCoinContractAddress, ANTShopContractAddress, ANTLotteryContractAddress, PurseContractAddress, MarketplaceContractAddress, BasicANTContractAddress, PremiumANTContractAddress, WorkforceContractAddress, FoodGatheringContractAddress = ''

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        // Randomizer smart contract deployment
        Randomizer = await hre.ethers.getContractFactory("MockRandomizer");
        RandomizerContract = await Randomizer.deploy();
        await RandomizerContract.waitForDeployment();
        RandomizerContractAddress = await RandomizerContract.getAddress();

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

        FoodGathering = await hre.ethers.getContractFactory("FoodGathering");
        FoodGatheringContract = await hre.upgrades.deployProxy(FoodGathering, [ANTCoinContractAddress, ANTShopContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await FoodGatheringContract.waitForDeployment();
        FoodGatheringContractAddress = await FoodGatheringContract.getAddress();

        await ANTCoinContract.addMinterRole(FoodGatheringContractAddress);
        await ANTShopContract.addMinterRole(FoodGatheringContractAddress);
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await FoodGatheringContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("all contracts should be set correctly", async () => {
            const antCoinAddress = await FoodGatheringContract.antCoin();
            const antShopAddress = await FoodGatheringContract.antShop();
            expect(antCoinAddress).to.be.equal(ANTCoinContractAddress);
            expect(antShopAddress).to.be.equal(ANTShopContractAddress);
        })

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await FoodGatheringContract.addMinterRole(user1.address);
            const role = await FoodGatheringContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await FoodGatheringContract.addMinterRole(user1.address);
            const role1 = await FoodGatheringContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await FoodGatheringContract.revokeMinterRole(user1.address);
            const role2 = await FoodGatheringContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        });

        it("setAntFoodTokenId: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(badActor).setANTFoodTokenId(2)).to.be.revertedWith("FoodGathering: Caller is not the owner or minter");
        })

        it("setAntFoodTokenId: should work if caller is owner", async () => {
            const antFoodTokenId = await FoodGatheringContract.antFoodTokenId();
            expect(antFoodTokenId).to.be.equal(0);
            await FoodGatheringContract.setANTFoodTokenId(1);
            const expected = await FoodGatheringContract.antFoodTokenId();
            expect(expected).to.be.equal(1);
        })

        it("setStakeFeeAmount: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(badActor).setStakeFeeAmount(2)).to.be.revertedWith("FoodGathering: Caller is not the owner or minter");
        })

        it("setStakeFeeAmount: should work if caller is owner", async () => {
            const stakeFeeAmount = await FoodGatheringContract.stakeFeeAmount();
            expect(stakeFeeAmount).to.be.equal(ethers.parseEther("1000"));
            await FoodGatheringContract.setStakeFeeAmount(1);
            const expected = await FoodGatheringContract.stakeFeeAmount();
            expect(expected).to.be.equal(1);
        })

        it("setMaxAmountForStake: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(badActor).setMaxAmountForStake(2)).to.be.revertedWith("FoodGathering: Caller is not the owner or minter");
        })

        it("setMaxAmountForStake: should work if caller is owner", async () => {
            const maxAmountForStake = await FoodGatheringContract.maxAmountForStake();
            expect(maxAmountForStake).to.be.equal(ethers.parseEther("900000"));
            await FoodGatheringContract.setMaxAmountForStake(1);
            const expected = await FoodGatheringContract.maxAmountForStake();
            expect(expected).to.be.equal(1);
        })

        it("setCycleStakedAmount: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(badActor).setCycleTimestamp(2)).to.be.revertedWith("FoodGathering: Caller is not the owner or minter");
        })

        it("setCycleStakedAmount: should work if caller is owner", async () => {
            const cycleStakedAmount = await FoodGatheringContract.cycleStakedAmount();
            expect(cycleStakedAmount).to.be.equal(ethers.parseEther("30000"));
            await FoodGatheringContract.setCycleStakedAmount(1);
            const expected = await FoodGatheringContract.cycleStakedAmount();
            expect(expected).to.be.equal(1);
        })

        it("setCycleTimestamp: should fail if caller is not owner", async () => {
            await expect(FoodGatheringContract.connect(badActor).setCycleTimestamp(2)).to.be.revertedWith("FoodGathering: Caller is not the owner or minter");
        })

        it("setCycleTimestamp: should work if caller is owner", async () => {
            const cycleTimestamp = await FoodGatheringContract.cycleTimestamp();
            expect(cycleTimestamp).to.be.equal(60 * 60 * 24);
            await FoodGatheringContract.setCycleTimestamp(1);
            const expected = await FoodGatheringContract.cycleTimestamp();
            expect(expected).to.be.equal(1);
        })

        it("stake: should fail if user don't have enough ant coin balance for staking", async () => {
            await expect(FoodGatheringContract.connect(user1).stake(1000)).to.be.revertedWith("FoodGathering: you don't have enough ant coin balance for staking")
        })

        it("stake: should fail if user staking amount exceed the maximum staking amount limit", async () => {
            const maxAmountForStake = await FoodGatheringContract.maxAmountForStake();
            const stakeFeeAmount = await FoodGatheringContract.stakeFeeAmount();
            await ANTCoinContract.transfer(user1.address, maxAmountForStake + BigInt(stakeFeeAmount) + BigInt(1));
            await expect(FoodGatheringContract.connect(user1).stake(maxAmountForStake + BigInt(1))).to.be.revertedWith("FoodGathering: your staking amount exceeds the maximum staking amount limit.")
        })

        it("stake & unStake: should work if all conditions are correct", async () => {
            const stakeFeeAmount = await FoodGatheringContract.stakeFeeAmount();
            await ANTCoinContract.transfer(user1.address, stakeFeeAmount + BigInt(ethers.parseEther("900000")));
            const initialBalance = await ANTCoinContract.balanceOf(user1.address);
            await FoodGatheringContract.connect(user1).stake(ethers.parseEther("100000"));
            const userANTCBalance1 = await ANTCoinContract.balanceOf(user1.address);
            expect(userANTCBalance1).to.be.equal(initialBalance - BigInt(ethers.parseEther("100000")) - BigInt(stakeFeeAmount));

            const stakedInfo1 = await FoodGatheringContract.getStakedInfo(user1.address);
            expect(stakedInfo1.stakedAmount).to.be.equal(ethers.parseEther("100000"));
            expect(stakedInfo1.rewardDebt).to.be.equal(0);

            await increaseTime(60 * 60 * 25);
            const expectedPendingAmount1 = ethers.parseEther("100000") * BigInt(60 * 60 * 25) * BigInt(1000) / BigInt(ethers.parseEther("30000") * BigInt(60 * 60 * 24));
            const pendingAmount1 = await FoodGatheringContract.pendingRewardByAddress(user1.address);
            expect(expectedPendingAmount1).to.be.equal(pendingAmount1); // 3472

            await FoodGatheringContract.connect(user1).stake(ethers.parseEther("50000"));
            const userANTCBalance2 = await ANTCoinContract.balanceOf(user1.address);
            expect(userANTCBalance2).to.be.equal(userANTCBalance1 - BigInt(ethers.parseEther("50000")) - BigInt(stakeFeeAmount));

            const stakedInfo2 = await FoodGatheringContract.getStakedInfo(user1.address);
            expect(stakedInfo2.stakedAmount).to.be.equal(ethers.parseEther("100000") + BigInt(ethers.parseEther("50000")));
            expect(stakedInfo2.rewardDebt).to.be.equal(expectedPendingAmount1);
            await increaseTime(60 * 60 * 30);
            const expectedPendingAmount2 = ethers.parseEther("150000") * BigInt(60 * 60 * 30) * BigInt(1000) / BigInt(ethers.parseEther("30000") * BigInt(60 * 60 * 24));
            const pendingAmount2 = await FoodGatheringContract.pendingRewardByAddress(user1.address);
            expect(pendingAmount2).to.be.equal(pendingAmount1 + BigInt(expectedPendingAmount2)) // 9722

            const tx = await FoodGatheringContract.connect(user1).unStake();
            const rewardAmount = await ANTShopContract.balanceOf(user1.address, 0);
            const expectedANTFoodBalance = (pendingAmount1 + BigInt(expectedPendingAmount2)) / BigInt(1000);
            expect(rewardAmount).to.be.equal(expectedANTFoodBalance); // 9

            const userANTCBalance3 = await ANTCoinContract.balanceOf(user1.address);
            expect(userANTCBalance3).to.be.equal(userANTCBalance2 + BigInt(ethers.parseEther("150000")));
            const stakedInfo3 = await FoodGatheringContract.getStakedInfo(user1.address);
            expect(stakedInfo3.stakedAmount).to.be.equal(0);
            expect(stakedInfo3.rewardDebt).to.be.equal(0);
            expect(stakedInfo3.stakedTimestamp).to.be.equal(0);
            expect(tx).to.emit(FoodGatheringContract, "FoodGatheringUnStaked").withArgs(user1.address, ethers.parseEther("150000"), 9)
        })

        it("unStake: should fail if caller didn't stake anything", async () => {
            await expect(FoodGatheringContract.connect(user3).unStake()).to.be.revertedWith("FoodGathering: You didn't stake any amount of ant coins")
        })
    })
})

const rpc = ({ method, params }) => {
    return network.provider.send(method, params);
};

const increaseTime = async (seconds) => {
    await rpc({ method: "evm_increaseTime", params: [seconds] });
    return rpc({ method: "evm_mine" });
};