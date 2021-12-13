const hardhat = require('hardhat');
require('dotenv').config()

const {OWNER_ADDRESS} = process.env;

async function main() {
  const DSMarket = await hardhat.ethers.getContractFactory("DSMarket");
  const dsMarket = await DSMarket.deploy(OWNER_ADDRESS, "0xcda8DF73fFA90c151879F0E5A46B2ad659502C73");
  await dsMarket.deployed();
  console.log("nftMarket deployed to:", dsMarket.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });