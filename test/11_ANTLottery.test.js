const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")
const { network } = require("hardhat")

describe.skip("ANTLottery", function () {
    let ANTCoin, ANTCoinContract, Randomizer, RandomizerContract, ANTLottery, ANTLotteryContract, Marketplace, MarketplaceContract, ANTShop, ANTShopContract, Purse, PurseContract;
    let RandomizerContractAddress, MockRandomizerContractAddress, ANTCoinContractAddress, ANTShopContractAddress, ANTLotteryContractAddress, PurseContractAddress, MarketplaceContractAddress, BasicANTContractAddress, PremiumANTContractAddress, WorkforceContractAddress, LevelingGroundContractAddress = ''

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

        // Randomizer smart contract deployment
        Randomizer = await hre.ethers.getContractFactory("MockRandomizer");
        RandomizerContract = await Randomizer.deploy();
        await RandomizerContract.waitForDeployment();
        RandomizerContractAddress = await RandomizerContract.getAddress();

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
        await ANTShopContract.addMinterRole(MarketplaceContractAddress);
        await ANTLotteryContract.addMinterRole(MarketplaceContractAddress);
        await ANTCoinContract.addMinterRole(ANTLotteryContractAddress);
    })

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await ANTLotteryContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(ANTLotteryContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await ANTLotteryContract.addMinterRole(user1.address);
            const role = await ANTLotteryContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(ANTLotteryContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await ANTLotteryContract.addMinterRole(user1.address);
            const role1 = await ANTLotteryContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await ANTLotteryContract.revokeMinterRole(user1.address);
            const role2 = await ANTLotteryContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        });

        it("reverseUint256: should reverse uint256", async () => {
            const result = await ANTLotteryContract.reverseUint256(123678912);
            expect(result).to.be.equal("219876321");
        })

        it("setANTCoinAmountPerTicket: should fail if caller is not the owner", async () => {
            await expect(ANTLotteryContract.connect(badActor).setANTCoinAmountPerTicket(0)).to.be.revertedWith("ANTLottery: Caller is not the owner or minter");
        })

        it("setANTCoinAmountPerTicket: should work if caller is the owner", async () => {
            await ANTLotteryContract.setANTCoinAmountPerTicket(100);
            const expected = await ANTLotteryContract.antCoinAmountPerTicket();
            expect(expected).to.be.equal(100)
        })

        it("setOperatorAndTreasuryAndInjectorAddresses: should fail if caller is not the owner", async () => {
            await expect(ANTLotteryContract.connect(badActor).setOperatorAndTreasuryAndInjectorAddresses(user1.address, user2.address)).to.be.revertedWith("ANTLottery: Caller is not the owner or minter");
        })

        it("setOperatorAndTreasuryAndInjectorAddresses: should work if caller is the owner", async () => {
            await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(user1.address, user2.address);
            const expected1 = await ANTLotteryContract.operatorAddress();
            const expected2 = await ANTLotteryContract.injectorAddress();
            expect(expected1).to.be.equal(user1.address);
            expect(expected2).to.be.equal(user2.address);
        })

        it("recoverWrongTokens: should fail if recover tokekn is ant coin", async () => {
            await expect(ANTLotteryContract.recoverWrongTokens(ANTCoinContractAddress, 100)).to.be.revertedWith("ANTLottery: Cannot be ANT Coin token")
        })

        it.skip("recoverWrongTokens: should work if tokens are not antcoins", async () => { })

        it("injectFunds: should fail if recover tokekn is ant coin", async () => {
            await expect(ANTLotteryContract.injectFunds(0, 100)).to.be.revertedWith("ANTLottery: Lottery not open");
        })

        it.skip("injectFunds: should work if lottery is opened", async () => { });

        it.skip("changeRandomGenerator: should fail if lottery ticket is open status", async () => { });

        it.skip("changeRandomGenerator: should work if lottery ticket is claimable", async () => { });

        it("viewUserInfoForLotteryId: should return ticketids, numbers and status", async () => {
            await ANTLotteryContract.addMinterRole(user1.address);
            const provider = hre.ethers.provider;
            const blockNumber = await provider.getBlockNumber();
            const block = await provider.getBlock(blockNumber);
            const blockTimestamp = block.timestamp;
            const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
            await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
            await ANTLotteryContract.connect(user1).buyTickets(user1.address, 10);
            const userInfoForLotteryId = await ANTLotteryContract.viewUserInfoForLotteryId(user1.address, 1, 0, 5);
            expect(userInfoForLotteryId[0].toString()).to.be.equal("0,1,2,3,4");
            expect(userInfoForLotteryId[1].length).to.be.equal(5);
            expect(userInfoForLotteryId[2].toString()).to.be.equal("false,false,false,false,false");
            expect(userInfoForLotteryId[3].toString()).to.be.equal("5");
        })

        it("viewNumbersAndStatusesForTicketIds: should return ticket random numbers and status", async () => {
            await ANTLotteryContract.addMinterRole(user1.address);
            const provider = hre.ethers.provider;
            const blockNumber = await provider.getBlockNumber();
            const block = await provider.getBlock(blockNumber);
            const blockTimestamp = block.timestamp;
            const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
            await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
            await ANTLotteryContract.connect(user1).buyTickets(user1.address, 10);
            const numberAndStatusInfo = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1, 2, 3, 4, 5]);
            console.log("Ticket Rnadom Numbers: ", numberAndStatusInfo[0].toString());
            console.log("Ticket Status: ", numberAndStatusInfo[1].toString());
        })

        describe("startLottery", async () => {

            this.beforeEach(async () => {
                await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(user1.address, user2.address);
            })

            it("should fail if current status is not claimable", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await expect(ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000])).to.be.revertedWith("ANTLottery: Not time to start lottery");
            })

            it("should fail if lottery period is not of range", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await expect(ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) - 100, [2000, 2000, 2000, 2000, 1000, 1000])).to.be.revertedWith("ANTLottery: Lottery length outside of range");
            })

            it("should fail reward percentage total amount is not equal 10000", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await expect(ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 999])).to.be.revertedWith("ANTLottery: Rewards must equal 10000");
            })

            it("should work if all conditions are correct", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                const tx = await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                const lottery = await ANTLotteryContract.viewLottery(1);
                expect(lottery.status).to.be.equal(1); // open
                expect(lottery.startTime).to.be.equal(blockTimestamp + 1);
                expect(lottery.endTime).to.be.equal(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100);
                expect(lottery.rewardsBreakdown.toString()).to.be.equal("2000,2000,2000,2000,1000,1000");
                expect(lottery.antCoinPerBracket.toString()).to.be.equal("0,0,0,0,0,0");
                expect(lottery.countWinnersPerBracket.toString()).to.be.equal("0,0,0,0,0,0");
                expect(lottery.firstTicketId).to.be.equal(lottery.firstTicketIdNextLottery).to.be.equal(lottery.amountCollectedInAntCoin).to.be.equal(0);
                expect(tx).to.emit("LotteryOpen", ANTLotteryContract).withArgs(1, blockTimestamp + 1, Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, 1, 0)
            })
        })

        describe("closeLottery", async () => {
            it("should fail if caller is not operator", async () => {
                await expect(ANTLotteryContract.connect(badActor).closeLottery(1)).to.be.revertedWith("Not operator");
            })

            it("should fail if lottery ticket is not open", async () => {
                await expect(ANTLotteryContract.connect(user1).closeLottery(1)).to.be.revertedWith("ANTLottery: Lottery not open");
            })

            it("should fail if lottery is not over", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await expect(ANTLotteryContract.connect(user1).closeLottery(1)).to.be.revertedWith("ANTLottery: Lottery not over");
            })

            it("should fail if caller is not antLottery", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await expect(ANTLotteryContract.connect(user1).closeLottery(1)).to.be.revertedWith("Only antLottery");
            })

            it("should work if all conditions are correct", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                await RandomizerContract.setNextRandomResult(10000000);
                const tx = await ANTLotteryContract.connect(user1).closeLottery(1);
                expect(tx).to.emit("LotteryClose", ANTLotteryContract).withArgs("1", "1")
            })
        })

        describe("buyTickets", async () => {

            it("should fail if Caller is not the owner or minter", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await expect(ANTLotteryContract.connect(badActor).buyTickets(user1.address, 1)).to.be.revertedWith("ANTLottery: Caller is not the owner or minter");
            })

            it("should fail if lottery is not opened", async () => {
                await ANTLotteryContract.addMinterRole(user1.address);
                await expect(ANTLotteryContract.connect(user1).buyTickets(user1.address, 1)).to.be.revertedWith("ANTLottery: Lottery is not open");
            })

            it("should fail if lottery is over", async () => {
                await ANTLotteryContract.addMinterRole(user1.address);
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await increaseTime(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100);
                await expect(ANTLotteryContract.connect(user1).buyTickets(user1.address, 1)).to.be.revertedWith("ANTLottery: Lottery is over");
            })

            it("should work if all conditions are correct", async () => {
                await ANTLotteryContract.addMinterRole(user1.address);
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                const tx = await ANTLotteryContract.connect(user1).buyTickets(user1.address, 10);
                const antCoinAmountPerTicket = await ANTLotteryContract.antCoinAmountPerTicket();
                const expectedAmount = antCoinAmountPerTicket * BigInt(10);
                const balance = await ANTCoinContract.balanceOf(ANTLotteryContractAddress);
                expect(balance).to.be.equal(expectedAmount);
                expect(tx).to.emit("TicketsPurchase", ANTLotteryContract).withArgs(user1.address, 1, 10)
                const currentTicketId = await ANTLotteryContract.currentTicketId();
                expect(currentTicketId).to.be.equal(10)
            })
        })

        describe("drawFinalNumberAndMakeLotteryClaimable", async () => {
            it("should fail if caller is not operator", async () => {
                await expect(ANTLotteryContract.connect(badActor).drawFinalNumberAndMakeLotteryClaimable(1)).to.be.revertedWith("Not operator");
            })

            it("should fail if lottery is not closed", async () => {
                await expect(ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1)).to.be.revertedWith("ANTLottery: Lottery not close");
            })

            it("should fail if Numbers not drawn", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                await RandomizerContract.setNextRandomResult(10000000);
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await expect(ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1)).to.be.revertedWith("ANTLottery: Numbers not drawn");
            })

            it("should work if all conditions are correct", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 100);
                await ANTLotteryContract.connect(user1).buyTickets(user2.address, 100);
                await ANTLotteryContract.connect(user1).buyTickets(user3.address, 100);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("199" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                const expectedBurnBalance1 = await ANTCoinContract.balanceOf(ANTLotteryContractAddress)
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                const lotteryInfo = await ANTLotteryContract.viewLottery(1);
                console.log("countWinnersPerBracket1:", lotteryInfo.countWinnersPerBracket.toString(), ", antCoinPerBracket: ", lotteryInfo.antCoinPerBracket.toString());
                let matchCount = 0;
                for (let i = 0; i < lotteryInfo.countWinnersPerBracket.length; i++) {
                    if (lotteryInfo.countWinnersPerBracket[i] > 0) {
                        if (i > 3) {
                            matchCount += 0.5;
                        }
                        else {
                            matchCount++;
                        }
                    }
                }
                matchCount *= 10;
                const expectedBalance = await ANTCoinContract.balanceOf(ANTLotteryContractAddress)
                expect(expectedBalance).to.be.equal(expectedBurnBalance1 - BigInt((expectedBurnBalance1 - BigInt(expectedBurnBalance1 * BigInt(matchCount) * BigInt(20) / BigInt(1000))) * BigInt(40) / BigInt(100)))
                const pendingInjectionNextLottery = await ANTLotteryContract.pendingInjectionNextLottery();
                expect(pendingInjectionNextLottery).to.be.equal((expectedBurnBalance1 - BigInt(expectedBurnBalance1 * BigInt(matchCount) * BigInt(20) / BigInt(1000))) * BigInt(60) / BigInt(100));
                // second lottery
                const blockNumber1 = await provider.getBlockNumber();
                const block1 = await provider.getBlock(blockNumber1);
                const blockTimestamp1 = block1.timestamp;
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp1) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                const lotteryInfo2 = await ANTLotteryContract.viewLottery(2);
                expect(lotteryInfo2.amountCollectedInAntCoin).to.be.equal(pendingInjectionNextLottery);
                const pendingInjectionNextLottery1 = await ANTLotteryContract.pendingInjectionNextLottery();
                expect(pendingInjectionNextLottery1).to.be.equal(0);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 100);
                await ANTLotteryContract.connect(user1).buyTickets(user2.address, 100);
                await ANTLotteryContract.connect(user1).buyTickets(user3.address, 100);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                const userInfoForLotteryId = await ANTLotteryContract.viewUserInfoForLotteryId(user1.address, 2, 0, 20)
                await RandomizerContract.setNextRandomResult("199" + userInfoForLotteryId[1][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(2);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(2);
                const lotteryInfo3 = await ANTLotteryContract.viewLottery(2);
                console.log("countWinnersPerBracket2:", lotteryInfo3.countWinnersPerBracket.toString(), ", antCoinPerBracket: ", lotteryInfo3.antCoinPerBracket.toString());
            })
        })

        describe("claimTickets", async () => {

            it("should fail if bracket is not correct", async () => {
                await ANTLotteryContract.setOperatorAndTreasuryAndInjectorAddresses(user1.address, user2.address);
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 100);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("1000" + ticketRandomNumbers[0][0].toString().slice(-3));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                const lotteryInfo = await ANTLotteryContract.viewLottery(1);
                console.log("countWinnersPerBracket:", lotteryInfo.countWinnersPerBracket.toString(), ", antCoinPerBracket: ", lotteryInfo.antCoinPerBracket.toString());
                // await expect(ANTLotteryContract.connect(user1).claimTickets(1, [0], [0])).to.be.revertedWith("ANTLottery: Bracket must be higher");
            })

            it("should fail if param length is not equal", async () => {
                await expect(ANTLotteryContract.connect(user1).claimTickets(1, ["2"], ["3", "4"])).to.be.revertedWith("ANTLottery: Not same length");
            });

            it("should fail if tickets length is less than 0", async () => {
                await expect(ANTLotteryContract.connect(user1).claimTickets(1, [], [])).to.be.revertedWith("ANTLottery: Length must be >0");
            });

            it("should fail if lottery ticket is not claimable", async () => {
                await expect(ANTLotteryContract.connect(user1).claimTickets(1, ["2"], ["3"])).to.be.revertedWith("ANTLottery: Lottery not claimable");
            });

            it("should fail if bracket is out of range", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 50);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("199" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                await expect(ANTLotteryContract.connect(user1).claimTickets(1, [3], [6])).to.be.revertedWith("ANTLottery: Bracket out of range");
            })

            it("should fail if ticket id is too high", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 20);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("199" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                await expect(ANTLotteryContract.connect(user1).claimTickets(1, [21], [0])).to.be.revertedWith("ANTLottery: TicketId too high");
            })

            it("should fail if ticket id is too low", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 20);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("199" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                const blockNumber1 = await provider.getBlockNumber();
                const block1 = await provider.getBlock(blockNumber1);
                const blockTimestamp1 = block1.timestamp;
                // @important it can be return some issues
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp1) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 20);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                const userInfoForLotteryId = await ANTLotteryContract.viewUserInfoForLotteryId(user1.address, 2, 0, 20)
                await RandomizerContract.setNextRandomResult("199" + userInfoForLotteryId[1][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(2);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(2);
                await expect(ANTLotteryContract.connect(user1).claimTickets(2, [10], [0])).to.be.revertedWith("ANTLottery: TicketId too low");
            });

            it("should fail if caller is not owner of the ticket id", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 20);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("199" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                await expect(ANTLotteryContract.connect(user2).claimTickets(1, [10], [0])).to.be.revertedWith("ANTLottery: Not the owner");
            })

            it("should fail if no prize for the bracket", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 20);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("199" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                await expect(ANTLotteryContract.connect(user1).claimTickets(1, [0], [5])).to.be.revertedWith("ANTLottery: No prize for this bracket");
            })



            it("should work if all conditions are correct", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.addMinterRole(user1.address);
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await ANTLotteryContract.connect(user1).buyTickets(user1.address, 100);
                await ANTLotteryContract.connect(user1).buyTickets(user2.address, 100);
                await increaseTime(Number(MIN_LENGTH_LOTTERY) + 100);
                await RandomizerContract.setLotteryAddress(ANTLotteryContractAddress);
                const ticketRandomNumbers = await ANTLotteryContract.viewNumbersAndStatusesForTicketIds([0, 1]);
                await RandomizerContract.setNextRandomResult("100" + ticketRandomNumbers[0][0].toString().slice(-4));
                await ANTLotteryContract.connect(user1).closeLottery(1);
                await RandomizerContract.changeLatestLotteryId();
                await ANTLotteryContract.connect(user1).drawFinalNumberAndMakeLotteryClaimable(1);
                const lotteryInfo = await ANTLotteryContract.viewLottery(1);
                const lotteryIds = await ANTLotteryContract.viewUserInfoForLotteryId(user1.address, 1, 0, 100);
                const lotteryIds1 = await ANTLotteryContract.viewUserInfoForLotteryId(user2.address, 1, 0, 100);
                const winningTicketIds = [];
                const winningTicketIds1 = [];
                const winningTicketBrackets = [];
                const winningTicketBrackets1 = [];
                for (let i = 0; i < lotteryIds[0].length; i++) {
                    const _bracket1 = compareStrings(lotteryInfo.finalNumber.toString().slice(1), lotteryIds[1][i].toString());
                    const _bracket2 = compareStrings(lotteryInfo.finalNumber.toString().slice(1), lotteryIds1[1][i].toString());
                    if (_bracket1 > 0) {
                        winningTicketIds.push(lotteryIds[0][i]);
                        winningTicketBrackets.push(_bracket1 - 1);
                    }
                    if (_bracket2 > 0) {
                        winningTicketIds1.push(lotteryIds1[0][i]);
                        winningTicketBrackets1.push(_bracket2 - 1);
                    }
                }
                await ANTLotteryContract.connect(user1).claimTickets(1, winningTicketIds, winningTicketBrackets);
                await ANTLotteryContract.connect(user2).claimTickets(1, winningTicketIds1, winningTicketBrackets1);
                const expectedBalance1 = await ANTCoinContract.balanceOf(user1.address);
                const expectedBalance2 = await ANTCoinContract.balanceOf(user2.address);
                console.log("user1 claimed amount:", expectedBalance1.toString(), " user2 claimed amount:", expectedBalance2.toString())
            })
        })

        describe("buyTickets in Marketplace", async () => {
            it("setLotteryTicketMintInfo: should fail if caller is not the owner", async () => {
                await expect(MarketplaceContract.connect(badActor).setLotteryTicketMintInfo(true, 10000, ANTCoinContractAddress, 2100000)).to.be.revertedWith("Marketplace: Caller is not the owner or minter");
            })

            it("setLotteryTicketMintInfo: should work if caller is the owner", async () => {
                await MarketplaceContract.connect(deployer).setLotteryTicketMintInfo(true, 100000, ANTCoinContractAddress, 210000000);
                const mintMethod = await MarketplaceContract.lotteryTicketMintMethod();
                const mintPrice = await MarketplaceContract.lotteryTicketMintPrice();
                const mintAddress = await MarketplaceContract.lotteryTicketMintTokenAddress();
                const mintAmount = await MarketplaceContract.lotteryTicketMintTokenAmount();
                expect(mintMethod).to.be.equal(true);
                expect(mintPrice).to.be.equal(100000);
                expect(mintAddress).to.be.equal(ANTCoinContractAddress);
                expect(mintAmount).to.be.equal(210000000);
            })

            it("shoud fail if user don't have enough Matic for mint", async () => {
                await MarketplaceContract.connect(deployer).setLotteryTicketMintInfo(true, 100000, ANTCoinContractAddress, 210000000);
                await expect(MarketplaceContract.connect(user1).buyLotteryTickets(user1.address, 5)).to.be.revertedWith("Marketplace: Insufficient Matic");
            })

            it("should work if user purchased enough Matic", async () => {
                const provider = hre.ethers.provider;
                const blockNumber = await provider.getBlockNumber();
                const block = await provider.getBlock(blockNumber);
                const blockTimestamp = block.timestamp;
                const MIN_LENGTH_LOTTERY = await ANTLotteryContract.MIN_LENGTH_LOTTERY();
                await ANTLotteryContract.connect(user1).startLottery(Number(blockTimestamp) + Number(MIN_LENGTH_LOTTERY) + 100, [2000, 2000, 2000, 2000, 1000, 1000]);
                await MarketplaceContract.connect(deployer).setLotteryTicketMintInfo(true, 100000, ANTCoinContractAddress, 210000000);
                await MarketplaceContract.connect(user1).buyLotteryTickets(user1.address, 5, { value: 100000 * 5 });
                const viewUserInfoForLotteryId = await ANTLotteryContract.viewUserInfoForLotteryId(user1.address, 1, 0, 15);
                expect(viewUserInfoForLotteryId[0].length).to.be.equal(5);
            })
        })
    })
});

const rpc = ({ method, params }) => {
    return network.provider.send(method, params);
};

const increaseTime = async (seconds) => {
    await rpc({ method: "evm_increaseTime", params: [seconds] });
    return rpc({ method: "evm_mine" });
};

function compareStrings(str1, str2) {
    let count = 0;
    for (let i = 1; i <= Math.min(str1.length, str2.length); i++) {
        if (str1[str1.length - i] === str2[str2.length - i]) {
            count++;
        } else {
            break;
        }
    }
    return count;
}