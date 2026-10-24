const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { MerkleTree } = require("merkletreejs");

const keccak = (data) => Buffer.from(ethers.keccak256(data).slice(2), "hex");
const LOT = ethers.id("LOT-2026-001");
const PRODUCT = ethers.id("Vaccin-X");

async function deployFixture() {
  const [admin, collector, stranger] = await ethers.getSigners();
  const cc = await ethers.deployContract("ColdChain");
  await cc.grantRole(await cc.COLLECTOR_ROLE(), collector.address);
  return { cc, admin, collector, stranger };
}

describe("ColdChain", function () {
  it("enregistre un lot et émet l'événement", async function () {
    const { cc, collector } = await loadFixture(deployFixture);
    await expect(cc.connect(collector).registerLot(LOT, PRODUCT, 20, 80))
      .to.emit(cc, "LotRegistered")
      .withArgs(LOT, PRODUCT, 20, 80);
    const lot = await cc.getLot(LOT);
    expect(lot.exists).to.equal(true);
    expect(lot.compromised).to.equal(false);
  });

  it("refuse un appelant sans rôle", async function () {
    const { cc, stranger } = await loadFixture(deployFixture);
    await expect(
      cc.connect(stranger).registerLot(LOT, PRODUCT, 20, 80)
    ).to.be.revertedWithCustomError(cc, "AccessControlUnauthorizedAccount");
  });

  it("refuse un lot en double", async function () {
    const { cc, collector } = await loadFixture(deployFixture);
    await cc.connect(collector).registerLot(LOT, PRODUCT, 20, 80);
    await expect(
      cc.connect(collector).registerLot(LOT, PRODUCT, 20, 80)
    ).to.be.revertedWithCustomError(cc, "LotAlreadyExists");
  });

  it("refuse une plage de température invalide", async function () {
    const { cc, collector } = await loadFixture(deployFixture);
    await expect(
      cc.connect(collector).registerLot(LOT, PRODUCT, 80, 20)
    ).to.be.revertedWithCustomError(cc, "InvalidTemperatureRange");
  });

  it("ancre une racine de Merkle et vérifie une mesure", async function () {
    const { cc, collector } = await loadFixture(deployFixture);
    await cc.connect(collector).registerLot(LOT, PRODUCT, 20, 80);

    const leaves = [25, 30, 45, 60].map((t, i) =>
      keccak(ethers.solidityPacked(["bytes32", "int16", "uint64"], [LOT, t, 1000 + i]))
    );
    const tree = new MerkleTree(leaves, keccak, { sortPairs: true });
    await cc.connect(collector).anchorRoot(LOT, tree.getHexRoot(), 4);

    const leafHex = "0x" + leaves[1].toString("hex");
    const proof = tree.getHexProof(leaves[1]);
    expect(await cc.verifyMeasurement(LOT, 0, leafHex, proof)).to.equal(true);

    // mesure falsifiée : la preuve doit échouer
    const fake = ethers.keccak256(
      ethers.solidityPacked(["bytes32", "int16", "uint64"], [LOT, 50, 1001])
    );
    expect(await cc.verifyMeasurement(LOT, 0, fake, proof)).to.equal(false);
  });

  it("marque un lot rompu, et refuse une température normale", async function () {
    const { cc, collector } = await loadFixture(deployFixture);
    await cc.connect(collector).registerLot(LOT, PRODUCT, 20, 80);

    await expect(
      cc.connect(collector).flagBreach(LOT, 50, ethers.id("preuve"))
    ).to.be.revertedWithCustomError(cc, "TemperatureInRange");

    await expect(cc.connect(collector).flagBreach(LOT, 120, ethers.id("preuve")))
      .to.emit(cc, "BreachFlagged")
      .withArgs(LOT, 120, ethers.id("preuve"));
    expect((await cc.getLot(LOT)).compromised).to.equal(true);
  });
});