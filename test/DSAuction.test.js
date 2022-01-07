const { expect } = require("chai");
const { BigNumber, utils } = require('ethers');
const { expectRevert } = require('@openzeppelin/test-helpers');
const ether = require("@openzeppelin/test-helpers/src/ether");
const { ethers } = require("hardhat");

describe("DSAuction", function () {

    let marketContract, marketAddress
    let DBZContract, DBZContractAddress
    let NFTContract, NFTContractAddress

    const baseUnit = 18
    const DBZamountToMint = utils.parseUnits('500000', baseUnit)
    const DBZamount = utils.parseUnits('1000', baseUnit)

    before(async () => {
        [NFTContractOwner, buyerAddress, buyerAddress2, _] = await ethers.getSigners()
        
        const MintableERC20 = await ethers.getContractFactory("MintableERC20")
        DBZContract = await MintableERC20.deploy("DBZ", "DBZ")
        await DBZContract.deployed()
        DBZContractAddress = DBZContract.address

        DBZContract.mint(DBZamountToMint)
        DBZContract.connect(buyerAddress).mint(DBZamountToMint)
        DBZContract.connect(buyerAddress2).mint(DBZamountToMint)

        const MarketContract = await ethers.getContractFactory("DSMarket")
        marketContract = await MarketContract.deploy(NFTContractOwner.address)
        await marketContract.deployed()
        marketContract.setPaymentToken(DBZContractAddress)
        marketAddress = marketContract.address

        const NFT = await ethers.getContractFactory("DSNFT")
        NFTContract = await NFT.deploy(marketAddress, NFTContractOwner.address, "1", "20210917", "First Amazing Show", "Kendrick Lamar", "20210925", "20:00", "Big Plaza", "10 E 20 N, Hugeston, TX");
        await NFTContract.deployed()
        NFTContractAddress = NFTContract.address

        const AuctionContract = await ethers.getContractFactory("DSAuction")
        auctionContract = await AuctionContract.deploy()
        await auctionContract.deployed()
        DSAuctionContractAddress = auctionContract.address 
        auctionContract.setPaymentToken(DBZContractAddress)
    })

    it('Should be deployed successfully', async () => {
        expect(marketAddress).to.not.equal(0x0);
        expect(marketAddress).to.not.equal('');
        expect(marketAddress).to.not.equal(null);
        expect(marketAddress).to.not.equal(undefined);
        expect(await DBZContract.balanceOf(buyerAddress.address)).to.equal(DBZamountToMint)
    })

    it('Should be possible to create NFT', async () => {
        await NFTContract.createToken("General", "https://gateway.pinata.cloud/ipfs/QmSiHtv8WofyNTHWcTj5P28ccQk4N3uSn6V84RY7oQobCH")
        expect((await NFTContract.ownerOf(1)).toString()).to.equal(NFTContractOwner.address)
     })

    //  it('Should create Market item', async () => {
    //     await marketContract.createMarketItem(NFTContractAddress, 1, DBZamount)
    //     await DBZContract.connect(buyerAddress).approve(marketContract.address, DBZamount)
    //  })

    // it('Should execute market sale', async () => {

    //     await marketContract.connect(buyerAddress).createMarketSale(DBZContractAddress, NFTContractAddress, 1, { value: DBZamount })
    //     expect((await NFTContract.ownerOf(1)).toString()).to.equal(buyerAddress.address);
    //     expect((await DBZContract.balanceOf(NFTContractOwner.address)).toString()).to.equal(DBZamount.toString());
    //     expect((await DBZContract.balanceOf(buyerAddress.address)).toString()).to.equal((DBZamountToMint-DBZamount).toString());
        
    //     // check flag of market item sold=true when item sold
    //     const items = await marketContract.fetchItemsCreated()
    //     expect(items[0].sold).to.equal(true);
    // })

    it('Should be possible to create auction', async () => {
        const duration = 10
        const tokenId = 1
        const bidIncrement = utils.parseUnits('50', baseUnit)

        await NFTContract.approve(auctionContract.address, tokenId)
        await auctionContract.createAuction(NFTContractAddress, tokenId, DBZamount, duration, bidIncrement)

        const auction = await auctionContract.getAuction(0)
        console.log(auction.nftContract)
        console.log(auction)
        
        expect(auction.nftContract).to.equal(NFTContractAddress)
        expect(auction.tokenId).to.equal(tokenId)
        expect(auction.seller).to.equal(NFTContractOwner.address)
        expect(auction.price).to.equal(DBZamount)
        expect(auction.duration).to.equal(duration)
        expect(auction.bidIncrement).to.equal(bidIncrement)
    })

    it('Should be possible to place bid', async () => {
        const auctionId = 0
        console.log((await DBZContract.balanceOf(auctionContract.address)).toString())
        console.log((await ethers.provider.getBalance(auctionContract.address)).toString())

        let auctionBeforeBid = await auctionContract.getAuction(auctionId)
        console.log("auctionBeforeBid.highestBidder", auctionBeforeBid.highestBidder)
        expect(auctionBeforeBid.highestBid).to.equal(0)
        expect(auctionBeforeBid.highestBidder).to.equal('0x0000000000000000000000000000000000000000')

        const bid_1 = utils.parseUnits('1100', baseUnit)
        const bid_2 = utils.parseUnits('1200', baseUnit)
        // let bid = 600
        await DBZContract.approve(auctionContract.address, bid_1)
        await DBZContract.connect(buyerAddress).approve(auctionContract.address, bid_2)

        await auctionContract.connect(buyerAddress).placeBid(auctionId, bid_1)

        // const bid_2 = utils.parseUnits('1200', baseUnit)
        // await DBZContract.connect(buyerAddress2).approve(auctionContract.address, bid_2)
        // await auctionContract.connect(buyerAddress2).placeBid(auctionId, bid_2)

        let auctionAfterBid = await auctionContract.getAuction(auctionId)
        console.log("auctionAfterBid.highestBidder ", auctionAfterBid.highestBidder)
        expect(auctionAfterBid.highestBid).to.equal(bid_1)
        expect(auctionAfterBid.highestBidder).to.equal(buyerAddress.address)

        console.log((auctionAfterBid.highestBid).toString())
        console.log("auctionAfterBid.highestBidder ", auctionAfterBid.highestBidder)
        console.log((await ethers.provider.getBalance(auctionContract.address)).toString())
    })

    it('Should be possible to withdraw balances', async () => {
        // this.timeout(70000)
        // const delay = ms => new Promise(res => setTimeout(res, ms));
        // await delay(60000)

        // const bid = utils.parseUnits('20000', baseUnit)

        // await DBZContract.approve(auctionContract.address, bid)
        // await DBZContract.connect(buyerAddress).approve(auctionContract.address, bid)

        console.log("allowance ", (await DBZContract.connect(buyerAddress).allowance(buyerAddress.address, auctionContract.address)).toString())

        function wait(ms){
            var start = new Date().getTime();
            var end = start;
            while(end < start + ms) {
              end = new Date().getTime();
           }
         }
        wait(10000)
        // done();

        await auctionContract.withdrawBalance(0)
        // await auctionContract.connect(buyerAddress).withdrawBalance(0)

        // package.json -> scripts:
        // "start": "SET NODE_ENV=dev && node ./bin/www",
        // "devstart": "SET NODE_ENV=dev && nodemon ./bin/www",
        // "test": "mocha --timeout 10000",
    })//.timeout(10000);

})