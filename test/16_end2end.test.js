const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")
const { network } = require("hardhat")

describe.skip("End2End", function () {
    let ANTCoin, ANTCoinContract, ANTShop, ANTShopContract, BasicANT, BasicANTContract, PremiumANT, PremiumANTContract, ANTLottery, ANTLotteryContract, Purse, PurseContract, Marketplace, MarketplaceContract, Bosses, BossesContract, FoodGathering, FoodGatheringContract, LevelingGround, LevelingGroundContract, Tasks, TasksContract, Workforce, WorkforceContract, Vesting, VestingContract, Randomizer, RandomizerContract;
    let RandomizerContractAddress, MockRandomizerContractAddress, ANTCoinContractAddress, ANTShopContractAddress, ANTLotteryContractAddress, PurseContractAddress, MarketplaceContractAddress, BasicANTContractAddress, PremiumANTContractAddress, WorkforceContractAddress, TasksContractAddress, BossesContractAddress, FoodGatheringContractAddress, LevelingGroundContractAddress, VestingContractAddress = '';

    // const basicANTMaticMintPrice = ethers.parseEther("0.001")
    // const baiscANTANTCoinMintAmount = ethers.parseEther("1000");
    const basicANTMaticMintPrice = "1000000000000000"
    const baiscANTANTCoinMintAmount = "1000000000000000000000"

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        ANTCoin = await hre.ethers.getContractFactory("ANTCoin");
        ANTCoinContract = await hre.upgrades.deployProxy(ANTCoin, [ethers.parseEther("200000000"), "0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"], {
            initializer: "initialize",
            kind: "transparent",
        });
        await ANTCoinContract.waitForDeployment();
        ANTCoinContractAddress = await ANTCoinContract.getAddress();

        // ant shop
        ANTShop = await hre.ethers.getContractFactory("ANTShop");
        ANTShopContract = await hre.upgrades.deployProxy(ANTShop, [], {
            initializer: "initialize",
            kind: "transparent",
        });
        await ANTShopContract.waitForDeployment();
        ANTShopContractAddress = await ANTShopContract.getAddress();

        await ANTShopContract.connect(deployer).setTokenTypeInfo(0, "ANTFood", "ant food uri")
        await ANTShopContract.connect(deployer).setTokenTypeInfo(1, "Leveling Potion", "leveling potion uri")

        // basic ant
        BasicANT = await hre.ethers.getContractFactory("BasicANT");
        BasicANTContract = await hre.upgrades.deployProxy(BasicANT, [ANTCoinContractAddress, ANTShopContractAddress], {
            initializer: "initialize",
            kind: "transparent",
        });
        await BasicANTContract.waitForDeployment();
        BasicANTContractAddress = await BasicANTContract.getAddress();

        await ANTShopContract.addMinterRole(BasicANTContractAddress);
        await ANTCoinContract.addMinterRole(BasicANTContractAddress);

        await BasicANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", basicANTMaticMintPrice, ANTCoinContractAddress, baiscANTANTCoinMintAmount);
        await BasicANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", basicANTMaticMintPrice, ANTCoinContractAddress, baiscANTANTCoinMintAmount);
        await BasicANTContract.setBatchInfo(2, "Fighter ANT", "testBaseURI3", basicANTMaticMintPrice, ANTCoinContractAddress, baiscANTANTCoinMintAmount);

        // premium ant
        PremiumANT = await hre.ethers.getContractFactory("PremiumANT");
        PremiumANTContract = await hre.upgrades.deployProxy(PremiumANT, [ANTCoinContractAddress, ANTShopContractAddress], {
            initializer: "initialize",
            kind: "transparent",
        });
        await PremiumANTContract.waitForDeployment();
        PremiumANTContractAddress = await PremiumANTContract.getAddress();

        await ANTShopContract.addMinterRole(PremiumANTContractAddress);
        await ANTCoinContract.addMinterRole(PremiumANTContractAddress);

        await PremiumANTContract.setBatchInfo(0, "Worker ANT", "testBaseURI1", 100, 1);
        await PremiumANTContract.setBatchInfo(1, "Wise ANT", "testBaseURI2", 100, 1);
        await PremiumANTContract.setBatchInfo(2, "Fighter ANT", "testBaseURI2", 100, 1);

        // Randomizer smart contract deployment
        const polyKeyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
        const polyVrfCoordinator = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed"
        const subScriptionId = 5715;
        Randomizer = await hre.ethers.getContractFactory("Randomizer");
        RandomizerContract = await Randomizer.deploy(polyKeyHash, polyVrfCoordinator, subScriptionId);
        await RandomizerContract.waitForDeployment();
        RandomizerContractAddress = await RandomizerContract.getAddress();

        // ant lottery
        ANTLottery = await hre.ethers.getContractFactory("ANTLottery");
        ANTLotteryContract = await hre.upgrades.deployProxy(ANTLottery, [RandomizerContractAddress, ANTCoinContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await ANTLotteryContract.waitForDeployment();
        ANTLotteryContractAddress = await ANTLotteryContract.getAddress();

        await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(deployer.address, deployer.address);
        const provider = hre.ethers.provider;
        const blockNumber = await provider.getBlockNumber();
        const block = await provider.getBlock(blockNumber);
        const blockTimestamp = block.timestamp;
        const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
        await ANTLotteryContract.startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);

        // purse
        Purse = await hre.ethers.getContractFactory("Purse");
        PurseContract = await hre.upgrades.deployProxy(Purse, [RandomizerContractAddress, ANTShopContractAddress, ANTLotteryContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await PurseContract.waitForDeployment();
        PurseContractAddress = await PurseContract.getAddress();

        Marketplace = await hre.ethers.getContractFactory("Marketplace");
        MarketplaceContract = await hre.upgrades.deployProxy(Marketplace, [ANTShopContractAddress, PurseContractAddress, ANTLotteryContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await MarketplaceContract.waitForDeployment();
        MarketplaceContractAddress = await MarketplaceContract.getAddress();

        await ANTShopContract.addMinterRole(MarketplaceContractAddress);
        await ANTShopContract.addMinterRole(PurseContractAddress);
        await ANTLotteryContract.addMinterRole(MarketplaceContractAddress);
        await ANTLotteryContract.addMinterRole(PurseContractAddress);
        await ANTCoinContract.addMinterRole(ANTLotteryContractAddress);
        await PurseContract.addMinterRole(MarketplaceContractAddress);
        await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0]);

        // bosses
        Bosses = await hre.ethers.getContractFactory('Bosses');
        BossesContract = await hre.upgrades.deployProxy(Bosses, [RandomizerContractAddress, ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await BossesContract.waitForDeployment();
        BossesContractAddress = await BossesContract.getAddress();

        await ANTCoinContract.addMinterRole(BossesContractAddress);
        await PremiumANTContract.addMinterRole(BossesContractAddress);
        await BasicANTContract.addMinterRole(BossesContractAddress);
        await BossesContract.setBossesPoolsInfo(["Catepillar", "Snail", "Beetle", "Snake", "Anteater"], [20, 50, 100, 250, 600], [1, 1, 1, 1, 1], [5, 10, 18, 25, 40])

        // food fathering
        FoodGathering = await hre.ethers.getContractFactory("FoodGathering");
        FoodGatheringContract = await hre.upgrades.deployProxy(FoodGathering, [ANTCoinContractAddress, ANTShopContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await FoodGatheringContract.waitForDeployment();
        FoodGatheringContractAddress = await FoodGatheringContract.getAddress();

        await ANTCoinContract.addMinterRole(FoodGatheringContractAddress);
        await ANTShopContract.addMinterRole(FoodGatheringContractAddress);

        // leveling ground
        LevelingGround = await hre.ethers.getContractFactory("LevelingGround");
        LevelingGroundContract = await hre.upgrades.deployProxy(LevelingGround, [ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await LevelingGroundContract.waitForDeployment();
        LevelingGroundContractAddress = await LevelingGroundContract.getAddress();

        await PremiumANTContract.addMinterRole(LevelingGroundContractAddress);
        await BasicANTContract.addMinterRole(LevelingGroundContractAddress);
        await ANTCoinContract.addMinterRole(LevelingGroundContractAddress)

        // tasks
        Tasks = await hre.ethers.getContractFactory("Tasks");
        TasksContract = await hre.upgrades.deployProxy(Tasks, [RandomizerContractAddress, ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress, PurseContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await TasksContract.waitForDeployment();
        TasksContractAddress = await TasksContract.getAddress();

        await TasksContract.setRewardLevels([[5, 19], [10, 25], [19, 40], [25, 40], [30, 40]])
        await TasksContract.setRewardsAmount([1, 2, 3, 4, 5]);

        await ANTCoinContract.addMinterRole(TasksContractAddress);
        await PremiumANTContract.addMinterRole(TasksContractAddress);
        await BasicANTContract.addMinterRole(TasksContractAddress);
        await PurseContract.addMinterRole(TasksContractAddress)

        // workforce
        Workforce = await hre.ethers.getContractFactory("Workforce");
        WorkforceContract = await hre.upgrades.deployProxy(Workforce, [ANTCoinContractAddress, PremiumANTContractAddress, BasicANTContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await WorkforceContract.waitForDeployment();
        WorkforceContractAddress = await WorkforceContract.getAddress();

        await ANTCoinContract.addMinterRole(WorkforceContractAddress);
        await PremiumANTContract.addMinterRole(WorkforceContractAddress);
        await BasicANTContract.addMinterRole(WorkforceContractAddress);

        // vesting
        Vesting = await hre.ethers.getContractFactory("Vesting");
        VestingContract = await hre.upgrades.deployProxy(Vesting, [ANTCoinContractAddress], {
            initializer: "initialize",
            kind: "transparent"
        });
        await VestingContract.waitForDeployment()
        VestingContractAddress = await VestingContract.getAddress();
        await ANTCoinContract.addMinterRole(VestingContractAddress);
        await VestingContract.addVestingPoolInfo("Private sale", 20, 9);
        await VestingContract.addVestingPoolInfo("Public sale", 40, 6);
        await VestingContract.addVestingPoolInfo("Team", 10, 12);
        await VestingContract.addVestingPoolInfo("Advisory", 10, 12);
        await VestingContract.addVestingPoolInfo("Reserve", 0, 12);
        await VestingContract.addVestingPoolInfo("Foundation", 10, 24)
    });

    describe("Test Suite", function () {
        it("All smart contracts should be deployed properly", async () => {
            expect(ANTCoinContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(ANTShopContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(MarketplaceContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(PremiumANTContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(BasicANTContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(PurseContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(RandomizerContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(WorkforceContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(FoodGatheringContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(LevelingGroundContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(ANTLotteryContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(BossesContractAddress).to.not.equal(ethers.ZeroAddress);
            expect(VestingContractAddress).to.not.equal(ethers.ZeroAddress);
        })

        describe("ANTCoin", async () => {
            it("should mint to owner 100 million upon the smart contract deployed", async () => {
                const ownerBalance = await ANTCoinContract.balanceOf(deployer.address);
                expect(ownerBalance).to.be.equal(ethers.parseEther("100000000"))
            })

            it("maxCirculationSupply should be less than 200 million", async () => {
                await expect(ANTCoinContract.mint(user1.address, ethers.parseEther("100000000"))).to.be.not.reverted;
                await expect(ANTCoinContract.mint(user1.address, 1)).to.be.revertedWith("ANTCoin: Mint amount exceed Max Circulation Supply")
            })

            it("should calculate the totalCirculationSupply properly", async () => {
                await ANTCoinContract.burn(deployer.address, ethers.parseEther("100"));
                await ANTCoinContract.mint(user1.address, ethers.parseEther("101"));
                const totalCirculatingSupply = await ANTCoinContract.totalCirculatingSupply();
                expect(totalCirculatingSupply).to.be.equal(ethers.parseEther(String(100000000 - 100 + 101)))
            })
        })

        describe("ANTShop", async () => {
            it("setTokenTypeInfo: should be set the token type info properly by owner", async () => {
                await ANTShopContract.setTokenTypeInfo(0, "test token 1", "test token 1 base uri");
                await ANTShopContract.setTokenTypeInfo(1, "test token 2", "test token 2 base uri");

                const token1TypeInfo = await ANTShopContract.getInfoForType(0);
                const token2TypeInfo = await ANTShopContract.getInfoForType(1);

                expect(token1TypeInfo.toString()).to.be.equal("0,0,true,test token 1 base uri,test token 1");
                expect(token2TypeInfo.toString()).to.be.equal("0,0,true,test token 2 base uri,test token 2");
            })

            it("mint & burn: ant shop ERC1155 tokens could be minted & burned by minter", async () => {
                await ANTShopContract.addMinterRole(user1.address);
                await ANTShopContract.connect(user1).mint(0, 10, user2.address);
                await ANTShopContract.connect(user1).mint(1, 5, user3.address);
                await ANTShopContract.connect(user1).burn(0, 2, user2.address);
                await ANTShopContract.connect(user1).burn(1, 3, user3.address);

                const token1Info = await ANTShopContract.getInfoForType(0);
                const token2Info = await ANTShopContract.getInfoForType(1);

                const user2Balance = await ANTShopContract.balanceOf(user2.address, 0);
                const user3Balance = await ANTShopContract.balanceOf(user3.address, 1);

                expect(token1Info.toString()).to.be.equal("10,2,true,ant food uri,ANTFood");
                expect(token2Info.toString()).to.be.equal("5,3,true,leveling potion uri,Leveling Potion");

                expect(user2Balance).to.be.equal(8);
                expect(user3Balance).to.be.equal(2);
            })

            it("isApprovedForAll: auto approve for minters", async () => {
                await ANTShopContract.addMinterRole(user1.address);
                await ANTShopContract.connect(user1).mint(0, 10, user2.address);
                await ANTShopContract.connect(user1).mint(0, 10, user1.address);
                await expect(ANTShopContract.connect(user3).safeTransferFrom(user2.address, user3.address, 0, 2, ethers.ZeroHash)).to.be.revertedWith("ANTShop: Caller is not owner nor approved")
                await expect(ANTShopContract.connect(badActor).safeTransferFrom(user2.address, user1.address, 0, 2, ethers.ZeroHash)).to.be.revertedWith("ANTShop: Caller is not owner nor approved");
                await expect(ANTShopContract.connect(badActor).safeTransferFrom(user1.address, user2.address, 0, 2, ethers.ZeroHash)).to.be.revertedWith("ANTShop: Caller is not owner nor approved");
                await expect(ANTShopContract.connect(user1).safeTransferFrom(user2.address, user3.address, 0, 3, ethers.ZeroHash)).to.be.not.reverted;
                // await expect(ANTShopContract.connect(user1).safeTransferFrom(user2.address, ANTShopContractAddress, 0, 3, ethers.ZeroHa  sh)).to.be.not.reverted;
            })
        })

        describe("Marketplace", async () => {
            it("setMintInfo: should work properly by owner", async () => {
                await expect(MarketplaceContract.connect(badActor).setMintInfo(0, 0, ANTCoinContractAddress, 100)).to.be.revertedWith("Marketplace: Caller is not the owner or minter");
                await expect(MarketplaceContract.setMintInfo(0, 0, ethers.ZeroAddress, 0)).to.be.revertedWith("Marketplace: token address can't be a null address");
                await MarketplaceContract.setMintInfo(0, ethers.parseEther("0.1"), ANTCoinContractAddress, 100);
                await expect(MarketplaceContract.getMintInfo(1)).to.be.revertedWith("Marketplace: Mint information not set yet");
                const mintInfo1 = await MarketplaceContract.getMintInfo(0);
                expect(mintInfo1.toString()).to.be.equal(`true,true,100000000000000000,100,${ANTCoinContractAddress}`);
                await MarketplaceContract.setMintMethod(0, false);
                const mintInfo2 = await MarketplaceContract.getMintInfo(0);
                expect(mintInfo2.toString()).to.be.equal(`false,true,100000000000000000,100,${ANTCoinContractAddress}`);
            });

            it("setPurseMintInfo & setLotteryTicketMintInfo: should set mint info by owner", async () => {
                await expect(MarketplaceContract.connect(badActor).setPurseMintInfo(true, ethers.parseEther("0.1"), ANTCoinContractAddress, 100)).to.be.revertedWith("Marketplace: Caller is not the owner or minter");
                await expect(MarketplaceContract.connect(badActor).setLotteryTicketMintInfo(true, ethers.parseEther("0.1"), ANTCoinContractAddress, 100)).to.be.revertedWith("Marketplace: Caller is not the owner or minter");
                await expect(MarketplaceContract.setPurseMintInfo(true, ethers.parseEther("0.1"), ethers.ZeroAddress, 100)).to.be.revertedWith("Marketplace: Purse token address can't be zero address");
                await expect(MarketplaceContract.setLotteryTicketMintInfo(true, ethers.parseEther("0.1"), ethers.ZeroAddress, 100)).to.be.revertedWith("Marketplace: Lottery token address can't be zero address");

                await MarketplaceContract.setPurseMintInfo(true, ethers.parseEther("0.1"), ANTCoinContractAddress, 100);
                await MarketplaceContract.setLotteryTicketMintInfo(true, ethers.parseEther("0.1"), ANTCoinContractAddress, 100);

                const purseMintMethod = await MarketplaceContract.purseMintMethod();
                const purseMintPrice = await MarketplaceContract.purseMintPrice();
                const purseMintTokenAddress = await MarketplaceContract.purseMintTokenAddress();
                const purseMintTokenAmount = await MarketplaceContract.purseMintTokenAmount();
                const lotteryTicketMintMethod = await MarketplaceContract.lotteryTicketMintMethod();
                const lotteryTicketMintPrice = await MarketplaceContract.lotteryTicketMintPrice();
                const lotteryTicketMintTokenAddress = await MarketplaceContract.lotteryTicketMintTokenAddress();
                const lotteryTicketMintTokenAmount = await MarketplaceContract.lotteryTicketMintTokenAmount();

                expect(purseMintMethod).to.be.equal(lotteryTicketMintMethod).to.be.equal(true);
                expect(purseMintPrice).to.be.equal(lotteryTicketMintPrice).to.be.equal(ethers.parseEther("0.1"));
                expect(purseMintTokenAddress).to.be.equal(lotteryTicketMintTokenAddress).to.be.equal(ANTCoinContractAddress);
                expect(purseMintTokenAmount).to.be.equal(lotteryTicketMintTokenAmount).to.be.equal(100);
            })

            it("buyTokens: should mint the ant shop tokens regarding the antshop mint info", async () => {
                await expect(MarketplaceContract.connect(user1).buyTokens(0, 1, user1.address)).to.be.revertedWith("Marketplace: mint info not set");
                await MarketplaceContract.setMintInfo(0, ethers.parseEther("0.01"), ANTCoinContractAddress, 100); // ant food
                await MarketplaceContract.setMintInfo(1, ethers.parseEther("0.1"), ANTCoinContractAddress, 1000); // leveling potions
                await MarketplaceContract.connect(user1).buyTokens(0, 10, user1.address, { value: ethers.parseEther("0.1") });
                await MarketplaceContract.connect(user1).buyTokens(1, 10, user1.address, { value: ethers.parseEther("1") });

                const user1balance1 = await ANTShopContract.balanceOf(user1.address, 0);
                const user1balance2 = await ANTShopContract.balanceOf(user1.address, 1);

                expect(user1balance1).to.be.equal(10)
                expect(user1balance2).to.be.equal(10)

                await MarketplaceContract.setMintMethod(0, false);
                await MarketplaceContract.setMintMethod(1, false);

                await expect(MarketplaceContract.connect(user1).buyTokens(0, 10, user1.address)).to.be.revertedWith("Marketplace: Insufficient Tokens");
                await expect(MarketplaceContract.connect(user1).buyTokens(1, 10, user1.address)).to.be.revertedWith("Marketplace: Insufficient Tokens");

                await ANTCoinContract.transfer(user1.address, 100 * 10 + 1000 * 10);
                await ANTCoinContract.connect(user1).approve(MarketplaceContractAddress, 100 * 10 + 1000 * 10);

                await MarketplaceContract.connect(user1).buyTokens(0, 10, user1.address);
                await MarketplaceContract.connect(user1).buyTokens(1, 10, user1.address);

                const user1balance3 = await ANTShopContract.balanceOf(user1.address, 0);
                const user1balance4 = await ANTShopContract.balanceOf(user1.address, 1);

                expect(user1balance3).to.be.equal(20)
                expect(user1balance4).to.be.equal(20)

                await expect(MarketplaceContract.connect(user1).buyTokens(0, 10, user1.address)).to.be.revertedWith("Marketplace: Insufficient Tokens");
                await expect(MarketplaceContract.connect(user1).buyTokens(1, 10, user1.address)).to.be.revertedWith("Marketplace: Insufficient Tokens");
            })

            it("buyPurseToken & buyLotteryTickets: should mint the purse token regarding the purse mint info", async () => {
                await MarketplaceContract.setPurseMintInfo(true, ethers.parseEther("0.01"), ANTCoinContractAddress, 100);
                await MarketplaceContract.setLotteryTicketMintInfo(true, ethers.parseEther("0.1"), ANTCoinContractAddress, 1000);
                await expect(MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 10)).to.be.revertedWith("Marketplace: Insufficient Matic");
                await expect(MarketplaceContract.connect(user1).buyLotteryTickets(user1.address, 10)).to.be.revertedWith("Marketplace: Insufficient Matic");
                await MarketplaceContract.connect(user1).buyPurseTokens(user1.address, 10, { value: ethers.parseEther("0.1") });
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(deployer.address, deployer.address)
                await MarketplaceContract.connect(user1).buyLotteryTickets(user1.address, 10, { value: ethers.parseEther("1") });
                const purseBalance1 = await PurseContract.balanceOf(user1.address);
                expect(purseBalance1).to.be.equal(10)
                const currentLotteryId = await ANTLotteryContract.currentLotteryId()
                const lotteryBalance1 = await ANTLotteryContract.viewUserInfoForLotteryId(user1.address, currentLotteryId, 0, 100);
                expect(lotteryBalance1[0].length).to.be.equal(10)
            })
        })

        describe("PremiumANT", async () => {
            it("setBatchInfo: should be set the correct batch info", async () => {
                await expect(PremiumANTContract.connect(badActor).setBatchInfo(0, "Worker ANT", "Worker ANT Base URI", 100, 2)).to.be.revertedWith("PremiumANT: Caller is not the owner or minter");
                await PremiumANTContract.setBatchInfo(0, "Worker ANT", "https://ipfs.io/ipfs/", 100, 2);
                const workerBatchInfo = await PremiumANTContract.getBatchInfo(0)
                expect(workerBatchInfo.toString()).to.be.equal("Worker ANT,https://ipfs.io/ipfs/,0,100,2");
            })

            it("mint: should mint the premium ants according to the exact logic", async () => {
                await expect(PremiumANTContract.connect(user1).mint(0, user2.address, 1)).to.be.revertedWith("PremiumANT: caller is not minter")
                await expect(PremiumANTContract.connect(user1).mint(0, user1.address, 1)).to.be.revertedWith("PremiumANT: insufficient balance")
                await ANTShopContract.mint(0, 10, user1.address);
                await PremiumANTContract.connect(user1).mint(0, user1.address, 2);
                await PremiumANTContract.connect(user1).mint(1, user1.address, 2);
                await PremiumANTContract.connect(user1).mint(2, user1.address, 2);
                const userBalance1 = await PremiumANTContract.balanceOf(user1.address);
                expect(userBalance1).to.be.equal(6);
                const batchInfo1 = await PremiumANTContract.getBatchInfo(0);
                const batchInfo2 = await PremiumANTContract.getBatchInfo(1);
                const batchInfo3 = await PremiumANTContract.getBatchInfo(2);
                expect(batchInfo1.minted).to.be.equal(batchInfo2.minted).to.be.equal(batchInfo3.minted)
                const antFoodBalance1 = await ANTShopContract.balanceOf(user1.address, 0);
                expect(antFoodBalance1).to.be.equal(4)

                // owner mint
                await PremiumANTContract.ownerMint(0, user2.address, 5);
                const batchInfo4 = await PremiumANTContract.getBatchInfo(0);
                expect(batchInfo4.minted).to.be.equal(7)
                const totalMinted = await PremiumANTContract.minted();
                expect(totalMinted).to.be.equal(11)
                const antOwner1 = await PremiumANTContract.ownerOf(7);
                expect(antOwner1).to.be.equal(user2.address)
            })

            it("upgradePremiumANT: should be upgraded properly according to the exact upgrade logic", async () => {
                await ANTShopContract.mint(0, 10, user1.address);
                await ANTShopContract.mint(1, 100, user1.address);
                await PremiumANTContract.connect(user1).mint(0, user1.address, 2);
                await expect(PremiumANTContract.connect(user2).upgradePremiumANT(1, 5)).to.be.revertedWith("PremiumANT: you are not owner of this token");
                await expect(PremiumANTContract.connect(user1).upgradePremiumANT(1, 0)).to.be.revertedWith("PremiumANT: leveling potion amount must be greater than zero");
                await expect(PremiumANTContract.connect(user1).upgradePremiumANT(1, 101)).to.be.revertedWith("PremiumANT: you don't have enough potions for upgrading");
                await expect(PremiumANTContract.connect(user1).upgradePremiumANT(1, 10)).to.be.revertedWith("PremiumANT: insufficient ant coin fee for upgrading");
                const upgradeANTFeePerPotion = await PremiumANTContract.upgradeANTFee();
                await ANTCoinContract.transfer(user1.address, upgradeANTFeePerPotion * BigInt(100));
                await PremiumANTContract.connect(user1).upgradePremiumANT(1, 10)
                const antInfo1 = await PremiumANTContract.getANTInfo(1)
                expect(antInfo1.level).to.be.equal(BigInt(20));
                expect(antInfo1.remainPotions).to.be.equal(BigInt(10));
                await PremiumANTContract.connect(user1).upgradePremiumANT(1, 11);
                const antInfo2 = await PremiumANTContract.getANTInfo(1)
                expect(antInfo2.level).to.be.equal(BigInt(21));
                expect(antInfo2.remainPotions).to.be.equal(0);
                await PremiumANTContract.connect(user1).upgradePremiumANT(1, 24);
                const antInfo3 = await PremiumANTContract.getANTInfo(1)
                expect(antInfo3.level).to.be.equal(BigInt(22));
                expect(antInfo3.remainPotions).to.be.equal(BigInt(2));

                const user1ANTCoinBalance1 = await ANTCoinContract.balanceOf(user1.address);
                expect(user1ANTCoinBalance1).to.be.equal(upgradeANTFeePerPotion * BigInt(100 - (10 + 11 + 24)))

                await PremiumANTContract.setMaxLevel(23);
                await PremiumANTContract.connect(user1).upgradePremiumANT(1, 30);
                const user1ANTFoodBalance = await ANTShopContract.balanceOf(user1.address, 1)
                expect(user1ANTFoodBalance).to.be.equal(BigInt(100 - 10 - 11 - 24 - 21)) // 
                const antInfo4 = await PremiumANTContract.getANTInfo(1)
                expect(antInfo4.level).to.be.equal(23)
                expect(antInfo4.remainPotions).to.be.equal(0)
            })

            it("ownerANTUpgrade: should be upgraded by owner", async () => {
                await ANTShopContract.mint(0, 10, user1.address);
                await PremiumANTContract.connect(user1).mint(0, user1.address, 2);
                await expect(PremiumANTContract.connect(badActor).ownerANTUpgrade(1, 25)).to.be.revertedWith("PremiumANT: Caller is not the owner or minter")
                await PremiumANTContract.ownerANTUpgrade(1, 25);
                const antInfo1 = await PremiumANTContract.getANTInfo(1)
                expect(antInfo1.level).to.be.equal(BigInt(21));
                expect(antInfo1.remainPotions).to.be.equal(BigInt(4));
            })
        })

        describe("BasicANT", async () => {
            it("setBatchInfo: should be set the correct batch info", async () => {
                await expect(BasicANTContract.connect(badActor).setBatchInfo(0, "Worker ANT", "Worker ANT Base URI", 100, ANTCoinContractAddress, 1000)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
                await BasicANTContract.setBatchInfo(0, "Worker ANT", "Worker ANT Base URI", 100, ANTCoinContractAddress, 1000);
                const workerBatchInfo = await BasicANTContract.getBatchInfo(0)
                expect(workerBatchInfo.toString()).to.be.equal(`Worker ANT,Worker ANT Base URI,0,100,${ANTCoinContractAddress},1000,true`);
            })

            it("mint: should mint the basic ants according to the exact logic", async () => {
                await expect(BasicANTContract.connect(user1).mint(0, user2.address, 1)).to.be.revertedWith("BasicANT: caller is not minter")
                await expect(BasicANTContract.connect(user1).mint(0, user1.address, 1)).to.be.revertedWith("BasicANT: insufficient Matic")
                await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: BigInt(basicANTMaticMintPrice) * BigInt(2) });
                await BasicANTContract.connect(user1).mint(1, user1.address, 2, { value: BigInt(basicANTMaticMintPrice) * BigInt(2) });
                await BasicANTContract.connect(user1).mint(2, user1.address, 2, { value: BigInt(basicANTMaticMintPrice) * BigInt(2) });
                const userBalance1 = await BasicANTContract.balanceOf(user1.address);
                expect(userBalance1).to.be.equal(6);
                const batchInfo1 = await BasicANTContract.getBatchInfo(0);
                const batchInfo2 = await BasicANTContract.getBatchInfo(1);
                const batchInfo3 = await BasicANTContract.getBatchInfo(2);
                expect(batchInfo1.minted).to.be.equal(batchInfo2.minted).to.be.equal(batchInfo3.minted)

                // owner mint
                await BasicANTContract.ownerMint(0, user2.address, 5);
                const batchInfo4 = await BasicANTContract.getBatchInfo(0);
                expect(batchInfo4.minted).to.be.equal(7)
                const totalMinted = await BasicANTContract.minted();
                expect(totalMinted).to.be.equal(11)
                const antOwner1 = await BasicANTContract.ownerOf(7);
                expect(antOwner1).to.be.equal(user2.address)
            })

            it("upgradeBasicANT: should be upgraded properly according to the exact upgrade logic", async () => {
                await ANTShopContract.mint(1, 100, user1.address);
                await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: BigInt(basicANTMaticMintPrice) * BigInt(2) });
                await expect(BasicANTContract.connect(user2).upgradeBasicANT(1, 5)).to.be.revertedWith("BasicANT: you are not owner of this token");
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 0)).to.be.revertedWith("BasicANT: leveling potion amount must be greater than zero");
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 101)).to.be.revertedWith("BasicANT: you don't have enough potions for upgrading");
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 10)).to.be.revertedWith("BasicANT: insufficient ant coin fee for upgrading");
                const upgradeANTFeePerPotion = await BasicANTContract.upgradeANTFee();
                await ANTCoinContract.transfer(user1.address, upgradeANTFeePerPotion * BigInt(100));
                await BasicANTContract.connect(user1).upgradeBasicANT(1, 3)
                const antInfo1 = await BasicANTContract.getANTInfo(1)
                expect(antInfo1.level).to.be.equal(2);
                expect(antInfo1.remainPotions).to.be.equal(1);
                await BasicANTContract.connect(user1).upgradeBasicANT(1, 5);
                const antInfo2 = await BasicANTContract.getANTInfo(1)
                expect(antInfo2.level).to.be.equal(3);
                expect(antInfo2.remainPotions).to.be.equal(3);

                const user1ANTCoinBalance1 = await ANTCoinContract.balanceOf(user1.address);
                expect(user1ANTCoinBalance1).to.be.equal(upgradeANTFeePerPotion * BigInt(100 - (3 + 5)))

                await BasicANTContract.setMaxLevel(4);
                await BasicANTContract.connect(user1).upgradeBasicANT(1, 10);
                const user1ANTFoodBalance = await ANTShopContract.balanceOf(user1.address, 1)
                expect(user1ANTFoodBalance).to.be.equal(100 - 3 - 5 - 1) // 
                const antInfo4 = await BasicANTContract.getANTInfo(1)
                expect(antInfo4.level).to.be.equal(4)
                expect(antInfo4.remainPotions).to.be.equal(0)
            })

            it("ownerANTUpgrade: should be upgraded by owner", async () => {
                await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: BigInt(basicANTMaticMintPrice) * BigInt(2) });
                await expect(BasicANTContract.connect(badActor).ownerANTUpgrade(1, 25)).to.be.revertedWith("BasicANT: Caller is not the owner or minter")
                await BasicANTContract.ownerANTUpgrade(1, 6);
                const antInfo1 = await BasicANTContract.getANTInfo(1)
                expect(antInfo1.level).to.be.equal(3);
                expect(antInfo1.remainPotions).to.be.equal(1);
            })
        })

        describe("Purse", async () => {
            it("addMultiPurseCategories: should add the purse category infos properly", async () => {
                await expect(PurseContract.connect(badActor).addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])).to.be.revertedWith("Purse: Caller is not the owner or minter");
                await expect(PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])).to.be.revertedWith("Purse: invalid purse category data");
                await expect(PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [46, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])).to.be.revertedWith("Purse: invalid purse category data");
                await PurseContract.addMultiPurseCategories(["Common", "UnCommon", "Rare", "Ultra Rare", "Legendary"], [45, 25, 20, 7, 3], [20, 5, 25, 25, 35], [5, 20, 25, 25, 35], [75, 75, 50, 50, 30], [5, 10, 10, 20, 50], [1, 1, 1, 2, 5], [10, 25, 30, 50, 100], [0, 0, 0, 0, 0])
                const purseCategoryInfo = await PurseContract.getPurseCategoryInfo(0);
                expect(purseCategoryInfo.toString()).to.be.equal("Common,45,0,20,5,75,5,1,10");
                const purseCategoryInfo1 = await PurseContract.getPurseCategoryInfo(2);
                expect(purseCategoryInfo1.toString()).to.be.equal("Rare,20,0,25,25,50,10,1,30");
                await expect(PurseContract.getPurseCategoryInfo(5)).to.be.revertedWith("Purse: category info doesn't exist")
                const multiInfo1 = await PurseContract.getPurseCategoryMultiInfo([0, 1, 2, 3, 4])
                expect(multiInfo1[1].categoryName).to.be.equal("UnCommon")
            })

            it("mint: should be minted randomly", async () => {
                await PurseContract.mint(user1.address, 10);
                const tokenInfos = await PurseContract.getPurseCategoryInfoOfMultiToken([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
                console.log("category names of minted purse tokens:", tokenInfos.toString());
            })

            it("usePurseToken: user have to earn the correct reward when use a purse token", async () => {
                await PurseContract.mint(user1.address, 5);
                await PurseContract.connect(user1).usePurseToken(1);
                await PurseContract.connect(user1).usePurseToken(2);
                await PurseContract.connect(user1).usePurseToken(3);
                await expect(PurseContract.ownerOf(1)).to.be.reverted;
                const usedTokenIds = await PurseContract.getUsedPurseTokenIdsByAddress(user1.address);
                const usedTokenIdsNumber = usedTokenIds.map(num => Number(num));
                const multiUserInfos = await PurseContract.getPurseMultiTokenRewardInfo(usedTokenIdsNumber);
                expect(usedTokenIds.length).to.be.equal(multiUserInfos.length).to.be.equal(3)
            })
        })

        describe("LevelingGround", async () => {
            it("should work properly all owner setting functions", async () => {
                await expect(LevelingGroundContract.connect(badActor).setBenefitCyclePeriod(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter");
                await expect(LevelingGroundContract.connect(badActor).setFullCyclePeriod(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter");
                await expect(LevelingGroundContract.connect(badActor).setStakeFeeAmount(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter");
                await expect(LevelingGroundContract.connect(badActor).setBasicWiseANTBatchIndex(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter"); await expect(LevelingGroundContract.connect(badActor).setBenefitCyclePeriod(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter");
                await expect(LevelingGroundContract.connect(badActor).setPremiumWiseANTBatchIndex(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter");
                await expect(LevelingGroundContract.connect(badActor).setBasicWiseANTRewardSpeed(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter")
                await expect(LevelingGroundContract.connect(badActor).setPremiumWiseANTRewardSpeed(100)).to.be.revertedWith("LevelingGround: Caller is not the owner or minter")
            })

            it("should work stakePremiumANT & stakeBasicANT functions in levelingGround contract", async () => {
                await ANTCoinContract.transfer(user1.address, ethers.parseEther("10000"))
                await ANTShopContract.mint(0, 100, user1.address);
                await PremiumANTContract.connect(user1).mint(0, user1.address, 2);
                const batchInfo = await BasicANTContract.getBatchInfo(0);
                await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: batchInfo.mintPrice * BigInt(2) })
                await LevelingGroundContract.connect(user1).stakePremiumANT(1);
                await LevelingGroundContract.connect(user1).stakeBasicANT(1);
                const basicANTInfo = await LevelingGroundContract.getBasicANTStakeInfo(1);
                const premiumANTInfo = await LevelingGroundContract.getPremiumANTStakeInfo(1);
                expect(basicANTInfo.level).to.be.equal(1);
                expect(basicANTInfo.owner).to.be.equal(user1.address);
                expect(basicANTInfo.batchIndex).to.be.equal(0);
                expect(premiumANTInfo.level).to.be.equal(20);
                expect(premiumANTInfo.owner).to.be.equal(user1.address);
                expect(premiumANTInfo.batchIndex).to.be.equal(0);

                await increaseTime(60 * 60 * (48 - 0.5 * Number(Number(premiumANTInfo.level) - 1)))
                const pendingRewardPremiumANT = await LevelingGroundContract.pendingRewardOfPremiumToken(1);
                expect(pendingRewardPremiumANT / BigInt(1000)).to.be.equal(1)
                await increaseTime(60 * 60 * 0.5 * Number(premiumANTInfo.level));
                const pendingRewardBasicANT = await LevelingGroundContract.pendingRewardOfBasicToken(1);
                expect(BigInt(pendingRewardBasicANT) / BigInt(1000)).to.be.equal(BigInt(1))

                await LevelingGroundContract.connect(user1).unStakeBasicANT(1);
                await LevelingGroundContract.connect(user1).unStakePremiumANT(1);

                const basicANTInfo2 = await BasicANTContract.getANTInfo(1);
                const premiumANTInfo2 = await PremiumANTContract.getANTInfo(1);

                expect(basicANTInfo2.remainPotions).to.be.equal(1)
                expect(premiumANTInfo2.remainPotions).to.be.equal(1);
            })
        })

        describe("Workforce", async () => {
            it("should work all setting functions properly", async () => {
                await expect(WorkforceContract.connect(badActor).setLimitAntCoinStakeAmount(100)).to.be.revertedWith("Workforce: Caller is not the owner or minter");
                await expect(WorkforceContract.connect(badActor).setInitLevelAfterUnstake(100)).to.be.revertedWith("Workforce: Caller is not the owner or minter");
                await expect(WorkforceContract.connect(badActor).setCycleStakePeriod(100)).to.be.revertedWith("Workforce: Caller is not the owner or minter");
                await expect(WorkforceContract.connect(badActor).setMaxStakePeriod(100)).to.be.revertedWith("Workforce: Caller is not the owner or minter");
            })

            it("stakePremiumANT & stakeBasicANT & unStakePremiumANT & unStakeBasicANT functions should work properly", async () => {
                await WorkforceContract.setLimitAntCoinStakeAmount(ethers.parseEther("100"))
                await ANTShopContract.mint(0, 10, user1.address)
                await PremiumANTContract.connect(user1).mint(0, user1.address, 2)
                await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: ethers.parseEther("0.2") })
                await ANTCoinContract.transfer(user1.address, ethers.parseEther("1000"))
                await expect(WorkforceContract.connect(badActor).stakePremiumANT(1, ethers.parseEther("100"))).to.be.revertedWith("Workforce: you are not owner of this token");
                await expect(WorkforceContract.connect(user1).stakePremiumANT(1, ethers.parseEther("0"))).to.be.revertedWith("Workforce: ant coin stake amount should be > 0");
                await expect(WorkforceContract.connect(user1).stakePremiumANT(1, ethers.parseEther("101"))).to.be.revertedWith("Workforce: ant coin stake amount exceed the limit amount");
                await expect(WorkforceContract.connect(badActor).stakeBasicANT(1, ethers.parseEther("100"))).to.be.revertedWith("Workforce: you are not owner of this token");
                await expect(WorkforceContract.connect(user1).stakeBasicANT(1, ethers.parseEther("0"))).to.be.revertedWith("Workforce: ant coin stake amount should be > 0");
                await expect(WorkforceContract.connect(user1).stakeBasicANT(1, ethers.parseEther("101"))).to.be.revertedWith("Workforce: ant coin stake amount exceed the limit amount");
                await WorkforceContract.setLimitAntCoinStakeAmount(ethers.parseEther("10000"))
                await expect(WorkforceContract.connect(user1).stakePremiumANT(1, ethers.parseEther("10000"))).to.be.revertedWith("Workforce: insufficient ant coin balance");
                await expect(WorkforceContract.connect(user1).stakeBasicANT(1, ethers.parseEther("10000"))).to.be.revertedWith("Workforce: insufficient ant coin balance");
                await WorkforceContract.connect(user1).stakePremiumANT(1, ethers.parseEther("100"));
                await WorkforceContract.connect(user1).stakeBasicANT(1, ethers.parseEther("100"));
            })
        })

        describe("FoodGathering", async () => {
            it("food gathering stake & unStke functions should work properly", async () => {
                const stakeFeeAmount = await FoodGatheringContract.stakeFeeAmount();
                // transfer some ant coins to users wallet address
                await ANTCoinContract.transfer(user1.address, ethers.parseEther("1000000"));
                await ANTCoinContract.transfer(user2.address, ethers.parseEther("1000000"));
                /** ------------------ user1 --------------- */
                await FoodGatheringContract.connect(user1).stake(ethers.parseEther("90000"));
                // check user ant coin balance after staking
                const user1Balance1 = await ANTCoinContract.balanceOf(user1.address);
                expect(user1Balance1).to.be.equal(ethers.parseEther("1000000") - BigInt(ethers.parseEther("90000")) - BigInt(stakeFeeAmount));
                const stakeInfo = await FoodGatheringContract.getStakedInfo(user1.address);
                expect(stakeInfo.stakedAmount).to.be.equal(ethers.parseEther("90000"));
                expect(stakeInfo.rewardDebt).to.be.equal(0);
                // increase timestamp to 24 hrs
                await increaseTime(60 * 60 * 24);
                // check pending reward amount
                const pendingRewardByAddress = await FoodGatheringContract.pendingRewardByAddress(user1.address);
                expect(pendingRewardByAddress).to.be.equal(3000)
                // stake more ant coins again
                await FoodGatheringContract.connect(user1).stake(ethers.parseEther("90000"));
                // check staked info status
                const stakeInfo1 = await FoodGatheringContract.getStakedInfo(user1.address);
                expect(stakeInfo1.stakedAmount).to.be.equal(ethers.parseEther("180000"));
                expect(stakeInfo1.rewardDebt).to.be.equal(3000);
                // increase time to 24 hrs
                await increaseTime(60 * 60 * 24);
                // Unstake user1's staked ant coins
                await FoodGatheringContract.connect(user1).unStake();
                const stakeInfo2 = await FoodGatheringContract.getStakedInfo(user1.address);
                expect(stakeInfo2.stakedAmount).to.be.equal(ethers.parseEther("0"));
                expect(stakeInfo2.rewardDebt).to.be.equal(0);
                // check user1's fod balance
                const user1FoodBalance = await ANTShopContract.balanceOf(user1.address, 0);
                expect(user1FoodBalance).to.be.equal(9);

                /** ------------------ user2 --------------- */
                // stake 10000 ant coins. It's 30% of cycle ant coin amounts.
                await FoodGatheringContract.connect(user2).stake(ethers.parseEther("10000"));
                // incrase time
                await increaseTime(60 * 60 * 24);
                // check user2's staked info
                const stakeInfo3 = await FoodGatheringContract.getStakedInfo(user2.address);
                expect(stakeInfo3.stakedAmount).to.be.equal(ethers.parseEther("10000"));
                expect(stakeInfo3.rewardDebt).to.be.equal(0);
                // check pending reward. It should be 33% of a cycle reward amount
                const pendingRewardUser2ByAddress = await FoodGatheringContract.pendingRewardByAddress(user2.address);
                expect(pendingRewardUser2ByAddress).to.be.equal(333)
                // incrase time to 3 days
                await increaseTime(60 * 60 * 24 * 3);
                await FoodGatheringContract.connect(user2).unStake();
                // user2's ant food balance should be 1
                const user2FoodBalance = await ANTShopContract.balanceOf(user2.address, 0);
                expect(user2FoodBalance).to.be.equal(1);
            })
        })

        describe("ANTLottery", async () => {

        })

        describe("Bosses", async () => {
            it("setBossesPoolsInfo: should be set the bosses pools info properly", async () => {
                // try to set with invalid pools info
                await expect(BossesContract.setBossesPoolsInfo(["Catepillar", "Snail", "Beetle", "Snake", "Anteater"], [20, 50, 100, 250, 600], [1, 1, 1, 1, 1], [5, 10, 18, 25])).to.be.revertedWith("Bosses: invalid bosses pools info");
                // set with the correct info
                await expect(BossesContract.setBossesPoolsInfo(["Catepillar", "Snail", "Beetle", "Snake", "Anteater"], [20, 50, 100, 250, 600], [1, 1, 1, 1, 1], [5, 10, 18, 25, 40])).to.be.not.reverted;
                // get the information of all pools and check pool index 2 information
                const bossesPoolMultiInfo = await BossesContract.getBossesPoolMultiInfoByIndex([0, 1, 2, 3, 4]);
                expect(bossesPoolMultiInfo[2].poolName).to.be.equal("Beetle");
                expect(bossesPoolMultiInfo[2].rewardAPY).to.be.equal(100);
                expect(bossesPoolMultiInfo[2].drainedLevel).to.be.equal(1);
                expect(bossesPoolMultiInfo[2].levelRequired).to.be.equal(18);
            })

            it("stakePremiumANT & stakeBasicANT should work", async () => {
                // transfer ant coins and mint some ant foods to user1 address
                await ANTCoinContract.transfer(user1.address, ethers.parseEther("2000"))
                await ANTShopContract.mint(0, 10, user1.address);
                // mint premium & basic ant and upgrade the basic ant level to 27 since level should be greater than minimum level required
                await PremiumANTContract.connect(user1).mint(0, user1.address, 2);
                await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: BigInt(basicANTMaticMintPrice) * BigInt(2) })
                await BasicANTContract.setLevel(1, 27)
                // stake premium & basic ant
                await BossesContract.connect(user1).stakePremiumANT(1, ethers.parseEther("500"))
                await BossesContract.connect(user1).stakeBasicANT(1, ethers.parseEther("500"))
                // check premium ant staked info
                const premiumStakedInfo1 = await BossesContract.getPremiumANTStakeInfo(1);
                const totalPremiumANTStaked1 = await BossesContract.totalPremiumANTStaked();
                expect(premiumStakedInfo1.tokenId).to.be.equal(1)
                expect(premiumStakedInfo1.owner).to.be.equal(user1.address)
                expect(premiumStakedInfo1.stakeAmount).to.be.equal(ethers.parseEther("500"));
                expect(premiumStakedInfo1.lockPeriod).to.be.equal(30 * 60 * 60 * 24);
                expect(totalPremiumANTStaked1).to.be.equal(1)
                // check basic ant staked info
                const basicStakedInfo1 = await BossesContract.getBasicANTStakeInfo(1);
                const totalBasicANTStaked1 = await BossesContract.totalBasicANTStaked();
                expect(basicStakedInfo1.tokenId).to.be.equal(1)
                expect(basicStakedInfo1.owner).to.be.equal(user1.address)
                expect(basicStakedInfo1.stakeAmount).to.be.equal(ethers.parseEther("500"));
                expect(basicStakedInfo1.lockPeriod).to.be.equal(30 * 60 * 60 * 24);
                expect(totalBasicANTStaked1).to.be.equal(1)

                /** --- unStake ants early(should be burn 20% of staked ant coins) --- */
                const burnRate = await BossesContract.burnRate();
                await BossesContract.connect(user1).unStakePremiumANT(1);
                const user1ANTCoinBalance1 = await ANTCoinContract.balanceOf(user1.address);
                const expectedBalance1 = ethers.parseEther("1000") + BigInt(ethers.parseEther("500") - BigInt(ethers.parseEther("500") * BigInt(burnRate) / BigInt(100)))
                expect(user1ANTCoinBalance1).to.be.equal(expectedBalance1)
                await BossesContract.connect(user1).unStakeBasicANT(1);
                const user1ANTCoinBalance2 = await ANTCoinContract.balanceOf(user1.address);
                const expectedBalance2 = expectedBalance1 + BigInt(ethers.parseEther("500") - BigInt(ethers.parseEther("500") * BigInt(burnRate) / BigInt(100)))
                expect(user1ANTCoinBalance2).to.be.equal(expectedBalance2)
                const totalPremiumANTStaked2 = await BossesContract.totalPremiumANTStaked();
                const totalBasicANTStaked2 = await BossesContract.totalBasicANTStaked();
                expect(totalPremiumANTStaked2).to.be.equal(0);
                expect(totalBasicANTStaked2).to.be.equal(0);

                /** --- unStake ants after finishing stake period --- */
                const stakePeriod = await BossesContract.stakePeriod();
                await BossesContract.connect(user1).stakePremiumANT(1, ethers.parseEther("500"));
                await BossesContract.connect(user1).stakeBasicANT(1, ethers.parseEther("500"));
                const premiumANTStakeInfo2 = await BossesContract.getPremiumANTStakeInfo(1);
                const premiumANTStakePoolInfo = await BossesContract.getBossesPoolInfoByIndex(premiumANTStakeInfo2.rewardIndex);
                const basicANTStakeInfo2 = await BossesContract.getBasicANTStakeInfo(1);
                const basicANTStakePoolInfo = await BossesContract.getBossesPoolInfoByIndex(basicANTStakeInfo2.rewardIndex);

                const totalPremiumANTStaked3 = await BossesContract.totalPremiumANTStaked();
                const totalBasicANTStaked3 = await BossesContract.totalBasicANTStaked();
                expect(totalPremiumANTStaked3).to.be.equal(1);
                expect(totalBasicANTStaked3).to.be.equal(1);

                // increase time
                await increaseTime(Number(stakePeriod));
                await BossesContract.connect(user1).unStakePremiumANT(1);
                const user1ANTCoinBalance3 = await ANTCoinContract.balanceOf(user1.address);
                const expectedBalance3 = expectedBalance2 - BigInt(ethers.parseEther("500")) + BigInt(ethers.parseEther("500") * BigInt(premiumANTStakePoolInfo.rewardAPY) / BigInt(100));
                expect(user1ANTCoinBalance3).to.be.equal(expectedBalance3)
                await BossesContract.connect(user1).unStakeBasicANT(1);
                const user1ANTCoinBalance4 = await ANTCoinContract.balanceOf(user1.address);
                const expectedBalance4 = expectedBalance3 + BigInt(ethers.parseEther("500")) + BigInt(ethers.parseEther("500") * BigInt(basicANTStakePoolInfo.rewardAPY) / BigInt(100))
                expect(user1ANTCoinBalance4).to.be.equal(expectedBalance4)

                const totalPremiumANTStaked4 = await BossesContract.totalPremiumANTStaked();
                const totalBasicANTStaked4 = await BossesContract.totalBasicANTStaked();
                expect(totalPremiumANTStaked4).to.be.equal(0);
                expect(totalBasicANTStaked4).to.be.equal(0);
            })
        })

        describe("Tasks", async () => {

        })

        describe("Vesting", async () => {

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
