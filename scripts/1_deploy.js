const hardhat = require('hardhat');
require('dotenv').config()

const {OWNER_ADDRESS} = process.env;

async function main() {
  console.log("Marketplace is deploying...");
  const Marketplace = await hardhat.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });