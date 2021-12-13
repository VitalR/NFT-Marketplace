const hardhat = require('hardhat');
require('dotenv').config()

async function main() {
  const ArtToken = await hardhat.ethers.getContractFactory("ArtToken");
  const artToken = await ArtToken.deploy();
  await artToken.deployed();
  console.log("ArtToken deployed to:", artToken.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });