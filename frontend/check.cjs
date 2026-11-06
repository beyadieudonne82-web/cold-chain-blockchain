const fs = require("fs");
const { ethers } = require("ethers");

const src = fs.readFileSync("src/contract.js", "utf8");
const m = src.match(/export const ABI\s*=\s*(\[[\s\S]*?\]);/);
if (!m) { console.log("Tableau ABI introuvable dans src/contract.js"); process.exit(1); }

let ABI;
try {
  ABI = eval(m[1]);
  new ethers.Interface(ABI);
  console.log("ABI valide :", ABI.length, "fragments");
} catch (e) {
  console.log("ABI INVALIDE :", e.shortMessage || e.message);
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const c = new ethers.Contract("0x29AE4102f9a2F4394C54366770B92040D309ff90", ABI, provider);

(async () => {
  try {
    const lot = await c.getLot(ethers.id("LOT-2026-001"));
    console.log("getLot OK, racines ancrées :", Number(lot.anchorCount));
  } catch (e) { console.log("getLot ERREUR :", e.shortMessage || e.message); }
  try {
    const ok = await c.hasRole(ethers.id("COLLECTOR_ROLE"), "0xdf7E70581c9aE16C34A6752C0af7528259c77d9B");
    console.log("hasRole OK :", ok);
  } catch (e) { console.log("hasRole ERREUR :", e.shortMessage || e.message); }
})();