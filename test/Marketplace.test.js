const Ganache = require('./helpers/ganache') // development tool for testing long sequences of transactions
const { expect, assert } = require("chai")
const { BigNumber, utils } = require('ethers')
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const ether = require("@openzeppelin/test-helpers/src/ether")
const { ethers } = require("hardhat")


describe("Marketplace", function () {
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString())

    const ganache = new Ganache()
    const baseUnit = 18

    let marketContract
    let payTokenContract
    let nftContract

    const tokenId = 1
    const duration = 7
    const auctionId = 1
    const bidIncrement = utils.parseUnits('50', baseUnit)
    const initialVipPrice = utils.parseUnits('1000', baseUnit)
    const ticketClass = "VIP"
    const tokenURI = ["https://gateway.pinata.cloud/ipfs/QmSiHtv8WofyNTHWcTj5P28ccQk4N3uSn6V84RY7oQobCH"]

    const payTokenAmountToMint = utils.parseUnits('500000', baseUnit)
    const initialPrice = utils.parseUnits('900', baseUnit)
    const amount = utils.parseUnits('1000', baseUnit)

    beforeEach('setup others', async function() {
        [owner, user, userTwo, _] = await ethers.getSigners()

        const MintableERC20 = await ethers.getContractFactory("MintableERC20")
        payTokenContract = await MintableERC20.deploy("ART", "ART")
        await payTokenContract.deployed()

        // payTokenContract.mint(payTokenAmountToMint)
        payTokenContract.connect(user).mint(payTokenAmountToMint)
        payTokenContract.connect(userTwo).mint(payTokenAmountToMint)

        const MarketContract = await ethers.getContractFactory("Marketplace")
        marketContract = await MarketContract.deploy()
        await marketContract.deployed()

        const NFT = await ethers.getContractFactory("NFT")
        nftContract = await NFT.deploy(marketContract.address, owner.address, "1", "20210917", "First Amazing Show", "Kendrick Lamar", "20210925", "20:00", "Big Plaza", "10 E 20 N, Hugeston, TX");
        await nftContract.deployed()

        // const AuctionContract = await ethers.getContractFactory("Auction")
        // auctionContract = await AuctionContract.deploy(payTokenContract.address)
        // await auctionContract.deployed()

        await ganache.snapshot()
    })

    afterEach('revert', function() { return ganache.revert(); })

    it.only('Should be deployed successfully', async () => {
        expect(marketContract).to.not.equal(0x0);
        expect(marketContract).to.not.equal('');
        expect(marketContract).to.not.equal(null);
        expect(marketContract).to.not.equal(undefined);
        expect(await payTokenContract.balanceOf(user.address)).to.equal(payTokenAmountToMint)
        expect(await payTokenContract.balanceOf(userTwo.address)).to.equal(payTokenAmountToMint)
    })

    // it('Should be possible to create NFT', async () => {
    //     await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
    //     expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)
    // })

    it('Should be possible to make initial ticket sale', async () => {
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))
    })

    it('Should revert initialTicketSale if token is already sold from initial ticket sale', async () => {
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await payTokenContract.connect(userTwo).approve(marketContract.address, amount)

        await expect(marketContract.connect(userTwo).initialTicketSale(
            tokenId, 
            amount
        )).to.be.revertedWith('DSMarketplace: This tokenId is already sold from initial ticket sale')

        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
    })

    it('Should revert initialTicketSale if amount is less the initial token price', async () => {
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await expect(marketContract.connect(user).initialTicketSale(
            tokenId, 
            initialPrice
        )).to.be.revertedWith('DSMarketplace: Please submit the asking price in order to complete the purchase')

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore)
    })

    it('Should be possible to create market item and sold', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        const amountItem = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await marketContract.connect(user).createMarketItem(tokenId, marketItemPrice)
        const items = await marketContract.getMarketItem(itemId)

        expect(items[0]).to.be.equal(itemId)
        expect(items[1]).to.be.equal(tokenId)
        expect(items[2]).to.be.equal(user.address)
        expect(items[3]).to.be.equal('0x0000000000000000000000000000000000000000')
        assertBNequal(items[4], marketItemPrice)
        expect(items[5]).to.be.false

        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)


        await payTokenContract.connect(userTwo).approve(marketContract.address, amountItem)
        await marketContract.connect(userTwo).createMarketSale(itemId, amountItem)

        assertBNequal(await nftContract.balanceOf(userTwo.address), 1)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 0)
    })

    it('Should revert createMarketItem if market creator is not the token owner', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        const amountItem = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await expect(marketContract.createMarketItem(
            tokenId, 
            marketItemPrice
        )).to.be.revertedWith('DSMarketplace: Should be the owner of token')
        
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 0)
    })

    it('Should revert createMarketItem if market contract is not approved for transferring nft token', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        const amountItem = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        // await nftContract.connect(user).approve(marketContract.address, tokenId)
        await expect(marketContract.connect(user).createMarketItem(
            tokenId, 
            marketItemPrice
        )).to.be.revertedWith('DSMarketplace: Marketplace should be approved for transferring nft token')
        
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 0)
    })

    it('Should revert createMarketItem if market item price is less or equal to zero', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        const amountItem = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await expect(marketContract.connect(user).createMarketItem(
            tokenId, 
            0
        )).to.be.revertedWith('DSMarketplace: Price must be at least 1 ART')
        
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 0)
    })

    it('Should revert createMarketSale if amount is less then required token price', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        const amountItemLess = utils.parseUnits('2999', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await marketContract.connect(user).createMarketItem(
            tokenId, 
            marketItemPrice
        )
        
        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)

        await payTokenContract.connect(userTwo).approve(marketContract.address, amountItemLess)
        await expect(marketContract.connect(userTwo).createMarketSale(
            itemId, 
            amountItemLess
        )).to.be.revertedWith('DSMarketplace: Please submit the asking price in order to complete the purchase')

        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(userTwo.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)
    })

    it('Should be possible to cancel market item by seller', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await marketContract.connect(user).createMarketItem(tokenId, marketItemPrice)
        const items = await marketContract.getMarketItem(itemId)

        expect(items[0]).to.be.equal(itemId)
        expect(items[1]).to.be.equal(tokenId)
        expect(items[2]).to.be.equal(user.address)
        expect(items[3]).to.be.equal('0x0000000000000000000000000000000000000000')
        assertBNequal(items[4], marketItemPrice)
        expect(items[5]).to.be.false

        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)

        await marketContract.connect(user).cancelMarketItem(itemId)

        // const itemsAfter = await marketContract.getMarketItem(itemId)
        // expect(items[1]).to.be.equal(0)

        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 0)
    })

    it('Should be possible to cancel market item by admin', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await marketContract.connect(user).createMarketItem(tokenId, marketItemPrice)
        const items = await marketContract.getMarketItem(itemId)

        expect(items[0]).to.be.equal(itemId)
        expect(items[1]).to.be.equal(tokenId)
        expect(items[2]).to.be.equal(user.address)
        expect(items[3]).to.be.equal('0x0000000000000000000000000000000000000000')
        assertBNequal(items[4], marketItemPrice)
        expect(items[5]).to.be.false

        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)

        await marketContract.cancelMarketItem(itemId)

        // const itemsAfter = await marketContract.getMarketItem(itemId)
        // expect(items[1]).to.be.equal(0)

        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 0)
    })
    
    it('Should revert cancelMarketItem if call cancel market item by third party', async () => {
        const itemId = 1
        const marketItemPrice = utils.parseUnits('3000', baseUnit)
        await nftContract.createToken(ticketClass, initialVipPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const userBalanceBefore = await payTokenContract.balanceOf(user.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        assertBNequal(await nftContract.balanceOf(user.address), 0)

        await marketContract.setNftContract(nftContract.address)

        await nftContract.approve(marketContract.address, tokenId)
        await payTokenContract.connect(user).approve(marketContract.address, amount)

        await marketContract.connect(user).initialTicketSale(tokenId, amount)

        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        assertBNequal(await nftContract.balanceOf(user.address), 1)
        assertBNequal(await payTokenContract.balanceOf(owner.address), 0)
        assertBNequal(await payTokenContract.balanceOf(user.address), userBalanceBefore.sub(amount))

        await nftContract.connect(user).approve(marketContract.address, tokenId)
        await marketContract.connect(user).createMarketItem(tokenId, marketItemPrice)
        const items = await marketContract.getMarketItem(itemId)

        expect(items[0]).to.be.equal(itemId)
        expect(items[1]).to.be.equal(tokenId)
        expect(items[2]).to.be.equal(user.address)
        expect(items[3]).to.be.equal('0x0000000000000000000000000000000000000000')
        assertBNequal(items[4], marketItemPrice)
        expect(items[5]).to.be.false

        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)

        await expect(marketContract.connect(userTwo).cancelMarketItem(
            itemId
        )).to.be.revertedWith('DSMarketplace: Market item can be cancelled by token seller or admin')

        // const itemsAfter = await marketContract.getMarketItem(itemId)
        // expect(items[1]).to.be.equal(0)

        assertBNequal(await nftContract.balanceOf(user.address), 0)
        assertBNequal(await nftContract.balanceOf(marketContract.address), 1)
    })

})