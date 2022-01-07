const hardhat = require('hardhat');
require('dotenv').config()

const {OWNER_ADDRESS} = process.env;

async function main() {
  const Auction = await hardhat.ethers.getContractFactory("Auction");
  const auction = await Auction.deploy();
  await auction.deployed();
  console.log("auction deployed to: ", auction.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });