import { ethers } from "ethers";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const COLLECTOR_URL = import.meta.env.VITE_COLLECTOR_URL || "http://localhost:3000";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
export const SEPOLIA_CHAIN_ID = 11155111;

export const ABI = [
  "function getLot(bytes32 lotId) view returns (tuple(bool exists, bool compromised, uint64 createdAt, int16 minTemp, int16 maxTemp, bytes32 productHash, uint32 anchorCount))",
  "function verifyMeasurement(bytes32 lotId, uint256 anchorIndex, bytes32 leaf, bytes32[] proof) view returns (bool)",
];

export const lotIdOf = (name) => ethers.id(name);

export function publicContract() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

export async function walletContract() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}