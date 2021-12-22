const hardhat = require('hardhat');
require('dotenv').config()

const {OWNER_ADDRESS} = process.env;

async function main() {
  console.log("NFT is deploying...");
  const NFT = await hardhat.ethers.getContractFactory("NFT");
  const nft = await NFT.deploy("<DEPLOYED_Market_ADDRESS>", OWNER_ADDRESS, "1", "20212512", "World’s 2d Live NFT Experience", "Dow Jones", "December 21, 2021", "8pm", "Rise Rooftop", "2600 Travis St Suite R, Houston, TX 77006");
  await nft.deployed();
  console.log("NFT deployed to: ", nft.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });