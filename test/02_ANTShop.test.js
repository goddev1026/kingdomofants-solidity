const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat")

describe.skip("ANTShop", function () {
    let ANTShop, ANTShopContract;

    beforeEach(async function () {
        [deployer, controller, badActor, user1, user2, user3, ...user] = await hre.ethers.getSigners();

        ANTShop = await hre.ethers.getContractFactory("ANTShop");
        ANTShopContract = await hre.upgrades.deployProxy(ANTShop, [], {
          initializer: "initialize",
          kind: "transparent",
        });
        await ANTShopContract.waitForDeployment();
    });

    describe("Test Suite", function () {
        it("Should set the right owner", async function () {
            const owner = await ANTShopContract.owner();
            expect(owner).to.be.equal(deployer.address);
        });

        it("addMinterRole: should fail if caller is not owner", async () => {
            await expect(ANTShopContract.connect(user1).addMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("addMinterRole: should work if caller is owner", async () => {
            await ANTShopContract.addMinterRole(user1.address);
            const role = await ANTShopContract.getMinterRole(user1.address);
            expect(role).to.be.equal(true);
        })

        it("revokeMinterRole: should fail if caller is not owner", async () => {
            await expect(ANTShopContract.connect(badActor).revokeMinterRole(user2.address)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("revokeMinterRole: should work if caller is owner", async () => {
            await ANTShopContract.addMinterRole(user1.address);
            const role1 = await ANTShopContract.getMinterRole(user1.address);
            expect(role1).to.be.equal(true);
            await ANTShopContract.revokeMinterRole(user1.address);
            const role2 = await ANTShopContract.getMinterRole(user1.address);
            expect(role2).to.be.equal(false);
        })

        it("setTokenTypeInfo: should fail if caller is not the owner", async () => {
            await expect(ANTShopContract.connect(badActor).setTokenTypeInfo(0, "ANTFood", "")).to.be.revertedWith("ANTShop: Caller is not the owner or minter");
        })

        it("setTokenTypeInfo: should work if caller is owner", async () => {
            await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI1");
            await ANTShopContract.setTokenTypeInfo(1, "Leveling Potions", "testBaseURI2");
            const tokenTypeInfo1 = await ANTShopContract.getInfoForType(0);
            const tokenTypeInfo2 = await ANTShopContract.getInfoForType(1);
            expect(tokenTypeInfo1.mints).to.be.equal(tokenTypeInfo1.burns).to.be.equal(0);
            expect(tokenTypeInfo1.name).to.be.equal("ANTFood");
            expect(tokenTypeInfo2.name).to.be.equal("Leveling Potions");
            expect(tokenTypeInfo2.mints).to.be.equal(tokenTypeInfo2.burns).to.be.equal(0);
            expect(tokenTypeInfo1.isSet).to.be.equal(tokenTypeInfo2.isSet).to.be.equal(true);
            expect(tokenTypeInfo1.baseURI).to.be.equal("testBaseURI1");
            expect(tokenTypeInfo2.baseURI).to.be.equal("testBaseURI2");
            await expect(ANTShopContract.getInfoForType(2)).to.be.revertedWith("ANTShop: invalid type id");
        })

        describe("mint",  () => {
            it("should fail if Caller is not the owner or minter", async () => {
                await expect(ANTShopContract.connect(badActor).mint(0, 1, user1.address)).to.be.revertedWith("ANTShop: Caller is not the owner or minter");
            })

            it("should fail if type info not set", async () => {
                await ANTShopContract.addMinterRole(user1.address);
                await expect(ANTShopContract.connect(user1).mint(0, 1, user1.address)).to.be.revertedWith("ANTShop: invalid type id")
            })

            it("should work if caller is minter", async () => {
                await ANTShopContract.addMinterRole(user1.address);
                await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI");
                await ANTShopContract.connect(user1).mint(0, 2, user2.address);
                const tokenTypeInfo = await ANTShopContract.getInfoForType(0);
                expect(tokenTypeInfo.mints).to.be.equal(2);
                const expectedBalance = await ANTShopContract.balanceOf(user2.address, 0)
                expect(expectedBalance).to.be.equal(2);
            })
        })

        describe("burn",  () => {
            it("should fail if Caller is not the owner or minter", async () => {
                await expect(ANTShopContract.connect(badActor).burn(0, 1, user1.address)).to.be.revertedWith("ANTShop: Caller is not the owner or minter");
            })

            it("should fail if no tokens minted", async () => {
                await ANTShopContract.addMinterRole(user1.address);
                await expect(ANTShopContract.connect(user1).burn(0, 1, user1.address)).to.be.revertedWith("ANTShop: None minted")
            })

            it("should work if caller is minter", async () => {
                await ANTShopContract.addMinterRole(user1.address);
                await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI");
                await ANTShopContract.connect(user1).mint(0, 2, user2.address);
                const tokenTypeInfo = await ANTShopContract.getInfoForType(0);
                expect(tokenTypeInfo.mints).to.be.equal(2);
                const expectedBalance1 = await ANTShopContract.balanceOf(user2.address, 0)
                expect(expectedBalance1).to.be.equal(2);
                await ANTShopContract.connect(user1).burn(0, 1, user2.address);
                const expectedBalance2 = await ANTShopContract.balanceOf(user2.address, 0)
                expect(expectedBalance2).to.be.equal(1);
                await ANTShopContract.connect(user1).burn(0, 1, user2.address);
                const expectedBalance3 = await ANTShopContract.balanceOf(user2.address, 0)
                expect(expectedBalance3).to.be.equal(0);
                await expect(ANTShopContract.connect(user1).burn(0, 1, user2.address)).to.be.revertedWith("ANTShop: None minted");
            })
        })

        it("uri: should fail if any token info is not set", async () => {
            await expect(ANTShopContract.connect(badActor).uri(0)).to.be.revertedWith("ANTShop: invalid type id");
        })

        it("uri: should work if token info is already set", async () => {
            await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI1");
            await ANTShopContract.setTokenTypeInfo(1, "Leveling Potions", "testBaseURI2");
            expect(await ANTShopContract.uri(0)).to.be.equal("testBaseURI1");
            expect(await ANTShopContract.uri(1)).to.be.equal("testBaseURI2");
        })

        it("setPuased: should fail if caller is not owner", async () => {
            await expect(ANTShopContract.connect(user1).setPaused(true)).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("setPaused: should work if caller is owner", async () => {
            await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI");
            await ANTShopContract.addMinterRole(user1.address);
            await ANTShopContract.setPaused(true);
            await expect(ANTShopContract.connect(user1).mint(0, 1, user2.address)).to.be.revertedWith("Pausable: paused");
            await expect(ANTShopContract.connect(user1).burn(0, 1, user2.address)).to.be.revertedWith("Pausable: paused");
            await ANTShopContract.setPaused(false);
            await expect(ANTShopContract.connect(user1).mint(0, 1, user2.address)).to.be.not.reverted;
            await expect(ANTShopContract.connect(user1).burn(0, 1, user2.address)).to.be.not.reverted;
        })

        it("Mint Event: should work Mint Emit", async () => {
            await ANTShopContract.addMinterRole(user1.address);
            await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI");
            const tx = await ANTShopContract.connect(user1).mint(0, 1, user2.address);
            await expect(tx).to.emit(ANTShopContract, 'Mint').withArgs(0, user2.address, 1)
        })

        it("Burn Event: should work Burn Emit", async () => {
            await ANTShopContract.addMinterRole(user1.address);
            await ANTShopContract.setTokenTypeInfo(0, "ANTFood", "testBaseURI");
            await ANTShopContract.connect(user1).mint(0, 1, user2.address);
            const tx = await ANTShopContract.connect(user1).burn(0, 1, user2.address);
            await expect(tx).to.emit(ANTShopContract, 'Burn').withArgs(0, user2.address, 1)
        })
    })
});