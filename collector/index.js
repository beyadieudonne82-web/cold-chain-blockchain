require("dotenv").config();
const fs = require("fs");
const http = require("http");
const mqtt = require("mqtt");
const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");

const {
  MQTT_HOST, MQTT_PORT = "8883", MQTT_USER, MQTT_PASSWORD,
  SEPOLIA_RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, DEVICE_ADDRESS,
  BATCH_SIZE = "10", MIN_TEMP = "20", MAX_TEMP = "80", PORT = "3000",
} = process.env;

for (const [k, v] of Object.entries({
  MQTT_HOST, MQTT_USER, MQTT_PASSWORD, SEPOLIA_RPC_URL,
  PRIVATE_KEY, CONTRACT_ADDRESS, DEVICE_ADDRESS,
})) {
  if (!v) { console.error("Variable manquante dans .env :", k); process.exit(1); }
}

const ABI = [
  "function registerLot(bytes32 lotId, bytes32 productHash, int16 minTemp, int16 maxTemp)",
  "function anchorRoot(bytes32 lotId, bytes32 root, uint32 measureCount)",
  "function flagBreach(bytes32 lotId, int16 temperature, bytes32 evidenceHash)",
  "function getLot(bytes32 lotId) view returns (tuple(bool exists, bool compromised, uint64 createdAt, int16 minTemp, int16 maxTemp, bytes32 productHash, uint32 anchorCount))",
];

const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

const keccak = (data) => Buffer.from(ethers.keccak256(data).slice(2), "hex");
const batchSize = Number(BATCH_SIZE);
const minTemp = Number(MIN_TEMP);
const maxTemp = Number(MAX_TEMP);

// --- Stockage local des preuves (pour la DApp) ---
const DATA_DIR = "data";
const BATCH_FILE = `${DATA_DIR}/batches.json`;
fs.mkdirSync(DATA_DIR, { recursive: true });
let batches = fs.existsSync(BATCH_FILE)
  ? JSON.parse(fs.readFileSync(BATCH_FILE, "utf8"))
  : [];

// --- File d'attente : une transaction à la fois (évite les conflits de nonce) ---
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue
    .then(fn)
    .catch((e) => console.error("Erreur transaction :", e.shortMessage || e.message));
  return queue;
}

const lots = new Map(); // lotName -> { lotId, buffer, flagged }

async function ensureLot(lotId, lotName) {
  try {
    await contract.getLot(lotId);
    return;
  } catch (_) { /* lot inconnu : on l'enregistre */ }
  console.log("Enregistrement du lot", lotName);
  const productHash = ethers.id("produit:" + lotName);
  const tx = await contract.registerLot(lotId, productHash, minTemp, maxTemp);
  await tx.wait();
}

async function anchorBatch(lotName, lotId, batch) {
  await ensureLot(lotId, lotName);
  const leaves = batch.map((b) => Buffer.from(b.leaf.slice(2), "hex"));
  const tree = new MerkleTree(leaves, keccak, { sortPairs: true });
  const root = tree.getHexRoot();

  const tx = await contract.anchorRoot(lotId, root, batch.length);
  await tx.wait();
  const lot = await contract.getLot(lotId);
  const anchorIndex = Number(lot.anchorCount) - 1;

  batches.push({
    lotName, lotId, anchorIndex, root, txHash: tx.hash,
    measures: batch.map((b, i) => ({
      temperature: b.temperature,
      timestamp: b.timestamp,
      leaf: b.leaf,
      proof: tree.getHexProof(leaves[i]),
    })),
  });
  fs.writeFileSync(BATCH_FILE, JSON.stringify(batches, null, 2));
  console.log(`Racine ancrée (lot ${lotName}, index ${anchorIndex}) tx: ${tx.hash}`);
}

async function flagLot(lotName, lotId, temperature, leaf) {
  await ensureLot(lotId, lotName);
  const tx = await contract.flagBreach(lotId, temperature, leaf);
  await tx.wait();
  console.log(`RUPTURE signalée (lot ${lotName}, ${temperature / 10} °C) tx: ${tx.hash}`);
}

async function handleMessage(payload) {
  const m = JSON.parse(payload.toString());
  const { lotName, lotId, temperature, timestamp, leaf, signature } = m;
  if (!lotName || !lotId || !signature || !leaf) return console.warn("Message incomplet, ignoré");

  // 1. Recalculer le hash de la mesure
  const expected = ethers.solidityPackedKeccak256(
    ["bytes32", "int16", "uint64"],
    [lotId, temperature, timestamp]
  );
  if (expected !== leaf) return console.warn("Hash incorrect, mesure rejetée");

  // 2. Vérifier la signature de l'appareil
  const signer = ethers.verifyMessage(ethers.getBytes(leaf), signature);
  if (signer.toLowerCase() !== DEVICE_ADDRESS.toLowerCase()) {
    return console.warn("Signature invalide (appareil inconnu), mesure rejetée");
  }

  const state = lots.get(lotName) || { lotId, buffer: [], flagged: false };
  lots.set(lotName, state);
  state.buffer.push({ temperature, timestamp, leaf });
  console.log(`Mesure valide ${temperature / 10} °C (${state.buffer.length}/${batchSize})`);

  // 3. Rupture de la chaîne du froid
  if ((temperature < minTemp || temperature > maxTemp) && !state.flagged) {
    state.flagged = true;
    enqueue(() => flagLot(lotName, lotId, temperature, leaf));
  }

  // 4. Ancrage par paquets
  if (state.buffer.length >= batchSize) {
    const batch = state.buffer.splice(0, state.buffer.length);
    enqueue(() => anchorBatch(lotName, lotId, batch));
  }
}

// --- MQTT ---
const client = mqtt.connect(`mqtts://${MQTT_HOST}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASSWORD,
  clientId: "collecteur-" + Math.random().toString(16).slice(2, 8),
});
client.on("connect", () => {
  console.log("Connecté au broker MQTT");
  client.subscribe("froid/lot/#", { qos: 1 });
});
client.on("error", (e) => console.error("Erreur MQTT :", e.message));
client.on("message", (_topic, payload) =>
  handleMessage(payload).catch((e) => console.error("Erreur message :", e.message))
);

// --- Petit serveur HTTP (santé + preuves pour la DApp) ---
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/batches") return res.end(JSON.stringify(batches));
    res.end(JSON.stringify({ status: "ok", contract: CONTRACT_ADDRESS }));
  })
  .listen(Number(PORT), () => console.log("Serveur HTTP sur le port", PORT));