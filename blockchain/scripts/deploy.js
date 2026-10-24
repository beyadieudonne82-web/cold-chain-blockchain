const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Déploiement avec :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Solde :", ethers.formatEther(balance), "ETH");

  const contract = await ethers.deployContract("ColdChain");
  await contract.waitForDeployment();

  console.log("ColdChain déployé à :", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});