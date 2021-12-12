const Ganache = require('./helpers/ganache') // development tool for testing long sequences of transactions
const { expect, assert } = require("chai")
const { BigNumber, utils } = require('ethers')
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const ether = require("@openzeppelin/test-helpers/src/ether")
const { ethers } = require("hardhat")


describe("NFT", function () {
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString())

    const ganache = new Ganache()
    const baseUnit = 18

    let marketContract
    let nftContract
    let payTokenContract

    const ticketId = 1
    const mintingDate = "20211110"
    const showName = "World’s 1st Live NFT Experience"
    const artistName = "DaBaby, Paul Wall, Slim Thug, Lil Keke, Kim Lee"
    const showDate = "November 21, 2021"
    const showTime = "8pm"
    const showVenue = "Rise Roofstop"
    const showLocation = "2600 Travis St Houston TX"
    const ticketClass = "VIP"
    const initialPrice = utils.parseUnits('3000', baseUnit)
    const tokenURI = ["https://gateway.pinata.cloud/ipfs/QmSiHtv8WofyNTHWcTj5P28ccQk4N3uSn6V84RY7oQobCH"]

    const tokenId = 1
    const duration = 7
    const auctionId = 1
    const initialVipPrice = utils.parseUnits('500', baseUnit)
    const initialGeneralPrice = utils.parseUnits('150', baseUnit)

    let tokenUriBundle = ["tokenURI_1", "tokenURI_2", "tokenURI_3", "tokenURI_4", "tokenURI_5", "tokenURI_6", "tokenURI_7", "tokenURI_8", "tokenURI_9", "tokenURI_10",
                          "tokenURI_11", "tokenURI_12", "tokenURI_13", "tokenURI_14", "tokenURI_15", "tokenURI_16", "tokenURI_17", "tokenURI_18", "tokenURI_19", "tokenURI_20"]
    let tokenUriBundle2 = ["tokenURI_21", "tokenURI_22", "tokenURI_23", "tokenURI_24", "tokenURI_25", "tokenURI_26", "tokenURI_27", "tokenURI_28", "tokenURI_29", "tokenURI_30"]
    const ARTamountToMint = utils.parseUnits('500000', baseUnit)
    const initialPriceDiamondTicket = utils.parseUnits('450000', baseUnit)
    const amount = utils.parseUnits('1000', baseUnit)

    beforeEach('setup others', async function() {
        [owner, user, userTwo, _] = await ethers.getSigners()

        const MintableERC20 = await ethers.getContractFactory("MintableERC20")
        payTokenContract = await MintableERC20.deploy("ART", "ART")
        await payTokenContract.deployed()

        // nftContract.mint(ARTamountToMint)
        payTokenContract.connect(user).mint(ARTamountToMint)
        payTokenContract.connect(userTwo).mint(ARTamountToMint)

        const MarketContract = await ethers.getContractFactory("Market")
        marketContract = await MarketContract.deploy(/*owner.address, nftContract.address*/)
        await marketContract.deployed()

        const NFT = await ethers.getContractFactory("NFT")
        nftContract = await NFT.deploy(marketContract.address, owner.address, "1", "20211110", "World’s 1st Live NFT Experience", "DaBaby, Paul Wall, Slim Thug, Lil Keke, Kim Lee", "November 21, 2021", "8pm", "Rise Roofstop", "2600 Travis St Houston TX");
        await nftContract.deployed()

        await ganache.snapshot()
    })

    afterEach('revert', function() { return ganache.revert(); })

    it('Should be deployed successfully', async () => {
        expect(nftContract).to.not.equal(0x0);
        expect(nftContract).to.not.equal('');
        expect(nftContract).to.not.equal(null);
        expect(nftContract).to.not.equal(undefined);
        // expect(await nftContract.balanceOf(user.address)).to.equal(ARTamountToMint)
        // expect(await nftContract.balanceOf(userTwo.address)).to.equal(ARTamountToMint)
    })

    it('Should be possible to create one NFT', async () => {
        const expectedTokenURI = "https://gateway.pinata.cloud/ipfs/QmSiHtv8WofyNTHWcTj5P28ccQk4N3uSn6V84RY7oQobCH"
        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        
        await nftContract.createToken(owner.address, ticketClass, initialPriceDiamondTicket, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 1)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const tickets = await nftContract.getTicket(1)
        
        expect(tickets[0]).to.be.equal(ticketId)
        expect(tickets[1]).to.be.equal(mintingDate)
        expect(tickets[2]).to.be.equal(showName)
        expect(tickets[3]).to.be.equal(artistName)
        expect(tickets[4]).to.be.equal(showDate)
        expect(tickets[5]).to.be.equal(showTime)
        expect(tickets[6]).to.be.equal(showVenue)
        expect(tickets[7]).to.be.equal(showLocation)
        expect(tickets[8]).to.be.equal(ticketClass)
        assertBNequal(tickets[9], initialPriceDiamondTicket)
        expect(tickets[10]).to.be.equal(expectedTokenURI)
    })

    it('Should be possible to create batch NFTs', async () => {
        const expectedTicketId = 20
        const expectedTokenURI = "tokenURI_20"
        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        
        await nftContract.createToken(ticketClass, initialVipPrice, tokenUriBundle)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 20)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const tickets = await nftContract.getTicket(20)
        
        expect(tickets[0]).to.be.equal(expectedTicketId)
        expect(tickets[1]).to.be.equal(mintingDate)
        expect(tickets[2]).to.be.equal(showName)
        expect(tickets[3]).to.be.equal(artistName)
        expect(tickets[4]).to.be.equal(showDate)
        expect(tickets[5]).to.be.equal(showTime)
        expect(tickets[6]).to.be.equal(showVenue)
        expect(tickets[7]).to.be.equal(showLocation)
        expect(tickets[8]).to.be.equal(ticketClass)
        assertBNequal(tickets[9], initialVipPrice)
        expect(tickets[10]).to.be.equal(expectedTokenURI)
    })

    it('Should be possible to create NFT tokens in several batches', async () => {
        const expectedTicketId = 20
        const expectedTicketId2 = 30
        const expectedTokenURI = "tokenURI_20"
        const expectedTokenURI2 = "tokenURI_30"
        assertBNequal(await nftContract.balanceOf(owner.address), 0)
        
        await nftContract.createToken(ticketClass, initialVipPrice, tokenUriBundle)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        assertBNequal(await nftContract.balanceOf(owner.address), 20)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const tickets = await nftContract.getTicket(20)
        // console.log((tickets[0]).toString())
        expect(tickets[0]).to.be.equal(expectedTicketId)
        expect(tickets[1]).to.be.equal(mintingDate)
        expect(tickets[2]).to.be.equal(showName)
        expect(tickets[3]).to.be.equal(artistName)
        expect(tickets[4]).to.be.equal(showDate)
        expect(tickets[5]).to.be.equal(showTime)
        expect(tickets[6]).to.be.equal(showVenue)
        expect(tickets[7]).to.be.equal(showLocation)
        expect(tickets[8]).to.be.equal(ticketClass)
        assertBNequal(tickets[9], initialVipPrice)
        expect(tickets[10]).to.be.equal(expectedTokenURI)

        await nftContract.createToken(ticketClass, initialPrice, tokenUriBundle2)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        const tickets2 = await nftContract.getTicket(30)
        expect(tickets2[0]).to.be.equal(expectedTicketId2)
        expect(tickets2[1]).to.be.equal(mintingDate)
        expect(tickets2[2]).to.be.equal(showName)
        expect(tickets2[3]).to.be.equal(artistName)
        expect(tickets2[4]).to.be.equal(showDate)
        expect(tickets2[5]).to.be.equal(showTime)
        expect(tickets2[6]).to.be.equal(showVenue)
        expect(tickets2[7]).to.be.equal(showLocation)
        expect(tickets2[8]).to.be.equal(ticketClass)
        assertBNequal(tickets2[9], initialPrice)
        expect(tickets2[10]).to.be.equal(expectedTokenURI2)
    })

    it('Should be possible to update initial ticket price', async () => {
        await nftContract.createToken(ticketClass, initialPrice, tokenURI)
        expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

        assertBNequal(await nftContract.getTicketInitialPrice(tokenId), initialPrice)

        await nftContract.setTicketInitialPrice(tokenId, initialPriceDiamondTicket)
        assertBNequal(await nftContract.getTicketInitialPrice(tokenId), initialPriceDiamondTicket)
    })

    // it('Should be possible to make initial ticket sale', async () => {
    //     await nftContract.createToken(ticketClass, tokenURI)
    //     expect((await nftContract.ownerOf(tokenId)).toString()).to.equal(owner.address)

    //     const userBalanceBefore = await nftContract.balanceOf(user.address)

    //     assertBNequal(await nftContract.balanceOf(owner.address), 1)
    //     assertBNequal(await nftContract.balanceOf(user.address), 0)

    //     await nftContract.approve(marketContract.address, tokenId)
    //     await nftContract.connect(user).approve(marketContract.address, amount)

    //     await marketContract.connect(user).initialTicketSale(
    //         nftContract.address, 
    //         tokenId,
    //         initialPrice,
    //         amount
    //     )

    //     assertBNequal(await nftContract.balanceOf(owner.address), 0)
    //     assertBNequal(await nftContract.balanceOf(user.address), 1)
    //     assertBNequal(await nftContract.balanceOf(owner.address), 0)
    //     assertBNequal(await nftContract.balanceOf(user.address), userBalanceBefore.sub(amount))
    // })

})