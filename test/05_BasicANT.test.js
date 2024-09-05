const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")

describe.skip("BasicANT", function () {
    let ANTShop, ANTShopContract, BasicANT, BasicANTContract, ANTCoin, ANTCoinContract;
    let ANTCoinContractAddress, ANTShopContractAddress, BasicANTContractAddress = ''

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
        ANTShopContractAddress = await ANTShopContract.getAddress()

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
        BasicANTContractAddress = await BasicANTContract.getAddress()

        await ANTShopContract.addMinterRole(BasicANTContractAddress);
        await ANTCoinContract.addMinterRole(BasicANTContractAddress)
        await ANTCoinContract.transfer(user1.address, ethers.parseEther("1000"))
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await BasicANTContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(BasicANTContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await BasicANTContract.addMinterRole(user1.address);
            const role = await BasicANTContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(BasicANTContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await BasicANTContract.addMinterRole(user1.address);
            const role1 = await BasicANTContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await BasicANTContract.revokeMinterRole(user1.address);
            const role2 = await BasicANTContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        })

        it("setLevelingPotionTokenId: should fail if caller is not the owner", async () => {
            await expect(BasicANTContract.connect(badActor).setLevelingPotionTokenId(1)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
        })

        it("setLevelingPotionTokenId: should work if caller is the owner", async () => {
            await BasicANTContract.setLevelingPotionTokenId(2);
            const expected = await BasicANTContract.levelingPotionTokenId();
            expect(expected).to.be.equal(2)
        })

        it("setAntFoodTokenId: should fail if caller is not the owner", async () => {
            await expect(BasicANTContract.connect(badActor).setAntFoodTokenId(1)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
        })

        it("setAntFoodTokenId: should work if caller is owner", async () => {
            await BasicANTContract.setAntFoodTokenId(2);
            const expected = await BasicANTContract.antFoodTokenId();
            expect(expected).to.be.equal(2)
        })

        it("setBatchInfo: should fail if caller is not the owner", async () => {
            await expect(BasicANTContract.connect(badActor).setBatchInfo(0, "name1", "testBaseURI1", 1000, ANTCoinContractAddress, 10000)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
        })

        it("setBatchInfo: should work if caller is the owner", async () => {
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", 1000, ANTCoinContractAddress, 10000);
            await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", 2000, ANTCoinContractAddress, 20000);
            const expected1 = await BasicANTContract.getBatchInfo(0);
            const expected2 = await BasicANTContract.getBatchInfo(1);
            expect(expected1.toString()).to.be.equal("name1,testBaseURI1,0,1000," + ANTCoinContractAddress + ",10000,true");
            expect(expected2.toString()).to.be.equal("name2,testBaseURI2,0,2000," + ANTCoinContractAddress + ",20000,true");
        })

        it("setStartLevel: should fail if caller is not the owner", async () => {
            await expect(BasicANTContract.connect(badActor).setStartLevel(0)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
        })

        it("setStartLevel: should work if caller is the owner", async () => {
            await BasicANTContract.setStartLevel(10);
            const expected = await BasicANTContract.startLevel();
            expect(expected).to.be.equal(10);
        })

        it("setLevel: should fail if Caller is not the owner or minter", async () => {
            await expect(BasicANTContract.connect(badActor).setLevel(0, 1)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
        })

        it("setLevel: should work if caller has a minter role", async () => {
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", 1000, ANTCoinContractAddress, 10000);
            await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", 2000, ANTCoinContractAddress, 20000);
            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: 1000 });
            await BasicANTContract.addMinterRole(user1.address);
            await BasicANTContract.setLevel(1, 0);
            const antInfo = await BasicANTContract.getANTInfo(1);
            expect(antInfo.toString()).to.be.equal("0,0,0,1")
        })

        it("ownerMint: should fail if Caller is not the owner or minter", async () => {
            await expect(BasicANTContract.connect(badActor).ownerMint(0, user1.address, 1)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
        })

        it("ownerMint: should work if caller has a minter role", async () => {
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", 1000, ANTCoinContractAddress, 10000);
            await BasicANTContract.addMinterRole(user1.address);
            await expect(BasicANTContract.connect(user1).ownerMint(0, user1.address, 2)).to.be.not.reverted;
            const tokensOfOwner = await BasicANTContract.tokensOfOwner(user1.address);
            expect(tokensOfOwner.toString()).to.be.equal("1,2");
            const batchInfo = await BasicANTContract.getBatchInfo(0);
            expect(batchInfo.toString()).to.be.equal("name1,testBaseURI1,2,1000," + ANTCoinContractAddress + ",10000,true");
            const antInfo = await BasicANTContract.getANTInfo(1);
            expect(antInfo.toString()).to.be.equal("1,0,0,1")
        })

        describe("mint", () => {
            it("should fail if user don't have enough matic for mint", async () => {
                await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", 1000, ANTCoinContractAddress, 10000);
                await expect(BasicANTContract.connect(user1).mint(0, user1.address, 2)).to.be.revertedWith("BasicANT: insufficient Matic")
            })

            it("should fail if user don't have enough token for mint", async () => {
                await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", 1000, ANTCoinContractAddress, 10000);
                await BasicANTContract.setMintMethod(0, false);
                await expect(BasicANTContract.connect(user2).mint(0, user2.address, 2)).to.be.revertedWith("BasicANT: insufficient Tokens");
                await ANTCoinContract.transfer(user2.address, 10000 * 2);
                await expect(BasicANTContract.connect(user2).mint(0, user2.address, 2)).to.be.revertedWith("BasicANT: You should approve tokens for minting");
            })

            it("should work if all conditions are correct", async () => {
                const maticMintPrice = 1000;
                const tokenAmountForMint = 10000;
                await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
                await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
                // matic mint
                await BasicANTContract.connect(user1).mint(0, user1.address, 3, { value: 3 * maticMintPrice });
                const batchInfo1 = await BasicANTContract.getBatchInfo(0);
                expect(batchInfo1.toString()).to.be.equal("name1,testBaseURI1,3," + maticMintPrice + "," + ANTCoinContractAddress + ",10000,true");
                const antInfo1 = await BasicANTContract.getANTInfo(2);
                expect(antInfo1.toString()).to.be.equal("1,0,0,2");
                await BasicANTContract.connect(user1).mint(1, user1.address, 5, { value: 5 * maticMintPrice });
                const batchInfo2 = await BasicANTContract.getBatchInfo(1);
                expect(batchInfo2.toString()).to.be.equal("name2,testBaseURI2,5," + maticMintPrice + "," + ANTCoinContractAddress + ",10000,true");
                const antInfo2 = await BasicANTContract.getANTInfo(6);
                expect(antInfo2.toString()).to.be.equal("1,0,1,3");
                const minted = await BasicANTContract.minted();
                const totalSupply = await BasicANTContract.totalSupply();
                expect(minted).to.be.equal(totalSupply).to.be.equal(8)
            })
        })

        describe("upgradeMint", () => {

            const maticMintPrice = 1000;
            const tokenAmountForMint = 100000;

            beforeEach(async () => {
                // ANT Food
                await ANTCoinContract.transfer(user1.address, 100000000)
                // Leveling Potions
                await ANTShopContract.mint(1, 100, user1.address);
                await ANTShopContract.mint(1, 100, user2.address);
                await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
                await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
                await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
                await BasicANTContract.connect(user2).mint(0, user2.address, 1, { value: maticMintPrice });
            })

            it("should fail if caller is not owner of token for upgrading", async () => {
                await expect(BasicANTContract.connect(badActor).upgradeBasicANT(1, 10)).to.be.revertedWith("BasicANT: you are not owner of this token")
            })

            it("should fail if potion amount is less than zero", async () => {
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 0)).to.be.revertedWith("BasicANT: leveling potion amount must be greater than zero")
            })

            it("should fail if user don't have enough Leveling Potions for upgrading", async () => {
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 101)).to.be.revertedWith("BasicANT: you don't have enough potions for upgrading")
            })

            it("should fail if upgrade level exceeds max level", async () => {
                await BasicANTContract.setMaxLevel(2);
                await BasicANTContract.connect(user1).upgradeBasicANT(1, 5)
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 5)).to.be.revertedWith("BasicANT: ant can no longer be upgraded")
            })

            it("should work if all conditions are correct", async () => {
                await ANTShopContract.mint(1, 100, user1.address);
                // current level 1
                await BasicANTContract.connect(user1).upgradeBasicANT(1, 6);
                // current level 3, remain potion - 1
                const antInfo1 = await BasicANTContract.getANTInfo(1);
                expect(antInfo1.toString()).to.be.equal("3,1,0,1"); // 3 - level, 1 - remain potions, 0 - batchIndex, 1 - tokenIdOfBatch
                await BasicANTContract.setMaxLevel(4);
                const potionBalance1 = await ANTShopContract.balanceOf(user1.address, 1);
                await BasicANTContract.connect(user1).upgradeBasicANT(1, 10);
                // should used only 3 tokens for upgrading to 4 level
                const potionBalance2 = await ANTShopContract.balanceOf(user1.address, 1);
                expect(potionBalance1 - BigInt(3)).to.be.equal(potionBalance2);
                const antInfo2 = await BasicANTContract.getANTInfo(1);
                expect(antInfo2.toString()).to.be.equal("4,0,0,1");
                await expect(BasicANTContract.connect(user1).upgradeBasicANT(1, 10)).to.be.revertedWith("BasicANT: ant can no longer be upgraded");
            })

            it("UpgradeANT Event: should work if upgradeAnt function tx was successful", async () => {
                await ANTShopContract.mint(1, 100, user1.address);
                // current level 1
                const tx = await BasicANTContract.connect(user1).upgradeBasicANT(1, 6);
                expect(tx).to.emit(BasicANTContract, "UpgradeANT").withArgs("1", user1.address, "3")
            })


            it("setUpgradeFee: should fail if caller is not the owner", async () => {
                await expect(BasicANTContract.connect(badActor).setUpgradeFee(100)).to.be.revertedWith("BasicANT: Caller is not the owner or minter");
            })

            it("setUpgradeFee: should work if caller is the owner", async () => {
                await expect(BasicANTContract.setUpgradeFee(100)).to.be.not.reverted;
                const upgradeFee = await BasicANTContract.upgradeANTFee();
                expect(upgradeFee).to.be.equal(100)
            })

            it("should fail if user don't have enough ant coin stake fee", async () => {
                await expect(BasicANTContract.connect(user2).upgradeBasicANT(2, 10)).to.be.revertedWith("BasicANT: insufficient ant coin fee for upgrading")
            })

            it("should burn the ant coin fee when upgrading the ANT", async () => {
                await ANTCoinContract.transfer(user2.address, 1000000000);
                await BasicANTContract.setUpgradeFee(100);
                const userANTCoinBalance1 = await ANTCoinContract.balanceOf(user2.address);
                expect(userANTCoinBalance1).to.be.equal(1000000000)
                await BasicANTContract.connect(user2).upgradeBasicANT(2, 10);
                const expectedANTCoinBalance = userANTCoinBalance1 - BigInt(100) * BigInt(10);
                const userANTCoinBalance2 = await ANTCoinContract.balanceOf(user2.address);
                expect(userANTCoinBalance2).to.be.equal(expectedANTCoinBalance);
            })
        })

        it("tokenURI: should fail if token doesn't exist", async () => {
            await expect(BasicANTContract.connect(user1).tokenURI(1)).to.be.revertedWith("BasicANT: Token does not exist.")
        })

        it("tokenURI: should return the exact batch metadata for token", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            await BasicANTContract.connect(user1).mint(1, user1.address, 2, { value: maticMintPrice * 2 });
            await BasicANTContract.connect(user1).mint(0, user1.address, 1, { value: maticMintPrice });
            const expectedTokenURI1 = await BasicANTContract.tokenURI(1);
            const expectedTokenURI2 = await BasicANTContract.tokenURI(3);
            const expectedTokenURI3 = await BasicANTContract.tokenURI(4);
            expect(expectedTokenURI1).to.be.equal(("testBaseURI1"));
            expect(expectedTokenURI2).to.be.equal(("testBaseURI2"));
            expect(expectedTokenURI3).to.be.equal(("testBaseURI1"));
        })

        it("getANTExperience: should return the experience in token", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            // Leveling Potions
            await ANTShopContract.mint(1, 100, user1.address);
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: maticMintPrice * 2 });
            await BasicANTContract.connect(user1).upgradeBasicANT(1, 6);
            const antInfo = await BasicANTContract.getANTInfo(1);
            expect(antInfo.toString()).to.be.equal("3,1,0,1");
            const experienceResult1 = await BasicANTContract.getANTExperience(1);
            const level = BigInt(3);
            const expectedResult = ((level * (level + BigInt(1)) / BigInt(2)) * BigInt(10)) + BigInt(500) + BigInt((level / BigInt(5)) * (BigInt(100)))
            expect(Number(experienceResult1)).to.be.equal(Number(expectedResult));
        })

        it("transferFrom: should transfer token without approve step if caller has minter role", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.connect(user1).mint(0, user1.address, 2, { value: maticMintPrice * 2 });
            await expect(BasicANTContract.transferFrom(user1.address, BasicANTContractAddress, 1)).to.be.not.reverted
        })

        it("setPaused: should fail if caller is not the owner", async () => {
            await expect(BasicANTContract.connect(badActor).setPaused(true)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("setPaused: should work if caller is the owner", async () => {
            const maticMintPrice = 1000;
            const tokenAmountForMint = 10000;
            // Leveling Potions
            await ANTShopContract.mint(1, 100, user1.address);
            await BasicANTContract.setBatchInfo(0, "name1", "testBaseURI1", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setBatchInfo(1, "name2", "testBaseURI2", maticMintPrice, ANTCoinContractAddress, tokenAmountForMint);
            await BasicANTContract.setPaused(true);
            await expect(BasicANTContract.connect(user1).mint(0, user1.address, 2)).to.be.revertedWith("Pausable: paused");
            await expect(BasicANTContract.connect(user1).upgradeBasicANT(0, 2)).to.be.revertedWith("Pausable: paused");
        })
    })
});