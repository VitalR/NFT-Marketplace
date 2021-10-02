const { expect } = require("chai")
const { ethers } = require("hardhat")
require("dotenv").config();

describe("NFTMarket", function() {
    it("Should create and execute market sales", async function () {
        const Market = await ethers.getContractFactory("NFTMarket")
        const market = await Market.deploy()
        await market.deployed()
        const marketAddress = market.address

        const NFT = await ethers.getContractFactory("NFT")
        const nft = await NFT.deploy(marketAddress)
        await nft.deployed()
        const nftContractAddress = nft.address

        let listingPrice = await market.getListingPrice()
        listingPrice = listingPrice.toString()

        const auctionPrice = ethers.utils.parseUnits('100', 'ether')

        await nft.createToken("https://gateway.pinata.cloud/ipfs/QmSiHtv8WofyNTHWcTj5P28ccQk4N3uSn6V84RY7oQobCH")
        await nft.createToken("https://gateway.pinata.cloud/ipfs/QmTnQ7TQuDgVMkHcjoJyu7QnLLX8wJPopmU284JLJYp6a4")

        await market.createMarketItem(nftContractAddress, 1, auctionPrice, { value: listingPrice })
        await market.createMarketItem(nftContractAddress, 2, auctionPrice, { value: listingPrice })

        const [_, buyerAddress] = await ethers.getSigners()

        await market.connect(buyerAddress).createMarketSale(nftContractAddress, 1, { value: auctionPrice })

        const items = await market.fetchMarketItems()

        console.log('items: ', items)

    })
})