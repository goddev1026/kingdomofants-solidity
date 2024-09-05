const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")

describe.skip("Purse", function () {
    let Randomizer, RandomizerContract, ANTShop, ANTShopContract, Purse, PurseContract, Marketplace, MarketplaceContract, ANTCoin, ANTCoinContract, ANTLottery, ANTLotteryContract, MockRandomizer, MockRandomizerContract;
    let RandomizerContractAddress, MockRandomizerContractAddress, ANTCoinContractAddress, ANTShopContractAddress, ANTLotteryContractAddress, PurseContractAddress, MarketplaceContractAddress = ''

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        // Randomizer smart contract deployment
        const polyKeyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
        const polyVrfCoordinator = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed"
        const subScriptionId = 5715;
        Randomizer = await hre.ethers.getContractFactory("Randomizer");
        RandomizerContract = await Randomizer.deploy(polyKeyHash, polyVrfCoordinator, subScriptionId);
        await RandomizerContract.waitForDeployment();
        RandomizerContractAddress = await RandomizerContract.getAddress()

        MockRandomizer = await hre.ethers.getContractFactory("MockRandomizer");
        MockRandomizerContract = await MockRandomizer.deploy();
        await MockRandomizerContract.waitForDeployment();
        MockRandomizerContractAddress = await MockRandomizerContract.getAddress();

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

        // ANTLottery smart contract deployment
        ANTLottery = await hre.ethers.getContractFactory("ANTLottery");
        ANTLotteryContract = await hre.upgrades.deployProxy(ANTLottery, [RandomizerContractAddress, ANTCoinContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await ANTLotteryContract.waitForDeployment();
        ANTLotteryContractAddress = await ANTLotteryContract.getAddress();

        // Purse smart contract deployment
        Purse = await hre.ethers.getContractFactory("Purse");
        PurseContract = await hre.upgrades.deployProxy(Purse, [RandomizerContractAddress, ANTShopContractAddress, ANTLotteryContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await PurseContract.waitForDeployment();
        PurseContractAddress = await PurseContract.getAddress();

        // Marketplace smart contract deployment
        Marketplace = await hre.ethers.getContractFactory("Marketplace");
        MarketplaceContract = await hre.upgrades.deployProxy(Marketplace, [ANTShopContractAddress, PurseContractAddress, ANTLotteryContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await MarketplaceContract.waitForDeployment();
        MarketplaceContractAddress = await MarketplaceContract.getAddress();

        await PurseContract.addMinterRole(MarketplaceContractAddress);
        await ANTShopContract.addMinterRole(PurseContractAddress);
        await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "ANTFoodURI");
        await ANTShopContract.setTokenTypeInfo(1, "Leveling Potions", "LevelingPotionsURI");
        await ANTLotteryContract.addMinterRole(MarketplaceContractAddress);
        await ANTLotteryContract.addMinterRole(PurseContractAddress);
        await ANTCoinContract.addMinterRole(ANTLotteryContractAddress)
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await PurseContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(PurseContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await PurseContract.addMinterRole(user1.address);
            const role = await PurseContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(PurseContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await PurseContract.addMinterRole(user1.address);
            const role1 = await PurseContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await PurseContract.revokeMinterRole(user1.address);
            const role2 = await PurseContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        });

        it("setAntFoodTokenId: should fail if caller is not the owner", async () => {
            await expect(PurseContract.connect(badActor).setAntFoodTokenId(0)).to.be.revertedWith("Purse: Caller is not the owner or minter");
        })

        it("setAntFoodTokenId: should work if caller is the owner", async () => {
            const antFoodTokenId = await PurseContract.antFoodTokenId();
            expect(antFoodTokenId).to.be.equal(0);
            await PurseContract.setAntFoodTokenId(1);
            const expected = await PurseContract.antFoodTokenId();
            expect(expected).to.be.equal(1);
        })

        it("setLevelingPotionTokenId: should fail if caller is not the owner", async () => {
            await expect(PurseContract.connect(badActor).setLevelingPotionTokenId(0)).to.be.revertedWith("Purse: Caller is not the owner or minter");
        })

        it("setLevelingPotionTokenId: should work if caller is the owner", async () => {
            const levelingPotionTokenId = await PurseContract.levelingPotionTokenId();
            expect(levelingPotionTokenId).to.be.equal(1);
            await PurseContract.setLevelingPotionTokenId(2);
            const expected = await PurseContract.levelingPotionTokenId();
            expect(expected).to.be.equal(2);
        })


        it("setRandomizerContract: should fail if caller is not the owner", async () => {
            await expect(PurseContract.connect(badActor).setRandomizerContract(user1.address)).to.be.revertedWith("Purse: Caller is not the owner or minter");
        })

        it("setRandomizerContract: should work if caller is the owner", async () => {
            const randomizerContract = await PurseContract.randomizer();
            expect(randomizerContract).to.be.equal(RandomizerContractAddress);
            await PurseContract.setRandomizerContract(user1.address);
            const expected = await PurseContract.randomizer();
            expect(expected).to.be.equal(user1.address);
        })

        // exact prameters
        // ["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])

        it("addMultiPurseCategories: should fail if caller is not the owner", async () => {
            await expect(PurseContract.connect(badActor).addMultiPurseCategories(["name"], [100], [40], [40], [20], [1], [1], [1], [1])).to.be.revertedWith("Purse: Caller is not the owner or minter");
        })

        it("addMultiPurseCategories: should fail if param array length doens't match", async () => {
            await expect(PurseContract.connect(deployer).addMultiPurseCategories(["name"], [100, 100], [40], [40], [20], [1], [1], [1], [1])).to.be.revertedWith("Purse: invalid purse category data");
        })

        it("addMultiPurseCategories: should fail if sum value of rarities value is not 100", async () => {
            await expect(PurseContract.connect(deployer).addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 2], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])).to.be.revertedWith("Purse: invalid purse category data");
            await expect(PurseContract.connect(deployer).addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 4], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])).to.be.revertedWith("Purse: invalid purse category data");
        })

        it("addMultiPurseCategories: should fail if sum value of randomness percentage is not 100", async () => {
            await expect(PurseContract.connect(deployer).addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 4, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])).to.be.revertedWith("Purse: invalid purse category data");
        })

        it("addMultiPurseCategories: should work well if all prams are correct", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            const purseInfo1 = await PurseContract.getPurseCategoryInfo(0);
            const purseInfo4 = await PurseContract.getPurseCategoryInfo(3);
            expect(purseInfo1.toString()).to.be.equal("Common,45,0,20,5,75,5,1,10")
            expect(purseInfo4.toString()).to.be.equal("Ultra Rare,7,0,25,25,50,20,2,50")
        })

        it("updatePurseCategories: should fail if caller is not the owner", async () => {
            await expect(PurseContract.connect(badActor).updatePurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100])).to.be.revertedWith("Purse: Caller is not the owner or minter")
        })

        it("updatePurseCategories: should fail if updated purse categories array length doesn't match", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await expect(PurseContract.connect(deployer).updatePurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare"], [45, 25, 20, 7], [20, 5, 25, 25], [5, 20, 25, 25], [75, 75, 50, 50], [5, 10, 10, 20], [1, 1, 1, 2], [10, 25, 30, 50])).to.be.revertedWith("Purse: length doesn't match with purseCategory")
        })

        it("updatePurseCategories: should fail if sum value of rarity is not 100", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await expect(PurseContract.updatePurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 4], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100])).to.be.revertedWith("Purse: invalid purse category data")
        })

        it("updatePurseCategories: should fail if sum value of randomness percentage is not 100", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await expect(PurseContract.updatePurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 4], [21, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100])).to.be.revertedWith("Purse: invalid purse category data")
        })

        it("updatePurseCategories: should work if all params are correct", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await PurseContract.updatePurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [40, 25, 20, 12, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100])
            const purseInfo1 = await PurseContract.getPurseCategoryInfo(0);
            const purseInfo4 = await PurseContract.getPurseCategoryInfo(3);
            expect(purseInfo1.toString()).to.be.equal("Common,40,0,20,5,75,5,1,10")
            expect(purseInfo4.toString()).to.be.equal("Ultra Rare,12,0,25,25,50,20,2,50")
        })

        it("mint: should fail if caller is not minter", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await expect(PurseContract.connect(user1).mint(user1.address, 2)).to.be.revertedWith("Purse: Caller is not the owner or minter")
        })

        it("buyPurseTokens: should fail if matic mint amount is not enough", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await MarketplaceContract.setPurseMintInfo(true, 100000, ANTCoinContractAddress, 10000000);
            await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 3, { value: 100000 * 3 - 1 })).to.be.revertedWith("Marketplace: Insufficient Matic");
        })

        it("buyPurseTokens: should fail if owner didn't set the purse mint info in marketplace contract", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 3, { value: 100000 * 3 - 1 })).to.be.revertedWith("Marketplace: token address can't be null");
        })

        it("buyPurseTokens: should fail if you don't have enough token balance for purse mint", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await MarketplaceContract.setPurseMintInfo(false, 100000, ANTCoinContractAddress, 10000000);
            await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 3)).to.be.revertedWith("Marketplace: Insufficient Tokens");
            await ANTCoinContract.transfer(user1.address, 10000000 * 2);
            await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 2)).to.be.revertedWith("Marketplace: You should approve tokens for minting");
        })

        it("buyPurseTokens: should work if user has enough token balance for purse mint", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await MarketplaceContract.setPurseMintInfo(false, 100000, ANTCoinContractAddress, 10000000);
            await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 3)).to.be.revertedWith("Marketplace: Insufficient Tokens");
            await ANTCoinContract.transfer(user1.address, 10000000 * 2);
            await ANTCoinContract.connect(user1).approve(MarketplaceContractAddress, 10000000 * 2)
            await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 2)).to.be.not.reverted;
        })

        it("mint: should work if caller is minter", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await MarketplaceContract.setPurseMintInfo(true, 100000, ANTCoinContractAddress, 10000000);
            await MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 100, { value: 100000 * 100 });
            const purseInfo1 = await PurseContract.getPurseCategoryInfo(0);
            const purseInfo2 = await PurseContract.getPurseCategoryInfo(1);
            const purseInfo3 = await PurseContract.getPurseCategoryInfo(2);
            const purseInfo4 = await PurseContract.getPurseCategoryInfo(3);
            const purseInfo5 = await PurseContract.getPurseCategoryInfo(4);
            console.log("Common:", Number(purseInfo1.minted), "UnCommon:", Number(purseInfo2.minted), "Rare:", Number(purseInfo3.minted), "Ultra Rare:", Number(purseInfo4.minted), "Legendary:", Number(purseInfo5.minted));
        });

        it("usePurseReward: should fail if caller is not owner of purse token", async () => {
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await MarketplaceContract.setPurseMintInfo(true, 100000, ANTCoinContractAddress, 10000000);
            await MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 1, { value: 100000 * 1 });
            await expect(PurseContract.connect(badActor).usePurseToken(1)).to.be.revertedWith("Purse: you are not owner of this token")
        })

        it("usePurseReward: should work if caller is owner", async () => {
            const provider = hre.ethers.provider;
            const blockNumber = await provider.getBlockNumber();
            const block = await provider.getBlock(blockNumber);
            const blockTimestamp = block.timestamp;
            const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
            await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(user1.address, user1.address);
            await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
            await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
            await PurseContract.mint(user2.address, 3);
            await PurseContract.mint(user2.address, 2);
            await PurseContract.mint(user2.address, 6);
            await PurseContract.connect(user2).usePurseToken(4)
            // await MarketplaceContract.setPurseMintInfo(true, 100000, ANTCoinContractAddress, 10000000);
            // await MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 50, { value: 100000 * 100 });
            // await MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 50, { value: 100000 * 100 });
            // await expect(PurseContract.connect(user1).usePurseToken(5)).to.be.not.reverted;
            // await expect(PurseContract.connect(user1).usePurseToken(8)).to.be.not.reverted;
            // await expect(PurseContract.connect(user1).usePurseToken(2)).to.be.not.reverted;
            // await expect(PurseContract.connect(user1).usePurseToken(10)).to.be.not.reverted;
            // await expect(PurseContract.connect(user1).usePurseToken(29)).to.be.not.reverted;
            // await expect(PurseContract.connect(user1).usePurseToken(30)).to.be.not.reverted;
        })
    });
});