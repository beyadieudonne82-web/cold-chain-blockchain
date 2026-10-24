import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CONTRACT_ADDRESS, COLLECTOR_URL, SEPOLIA_CHAIN_ID,
  lotIdOf, publicContract, walletContract,
} from "./contract";
import "./App.css";

export default function App() {
  const [account, setAccount] = useState("");
  const [lotName, setLotName] = useState("");
  const [lot, setLot] = useState(null);
  const [batches, setBatches] = useState([]);
  const [results, setResults] = useState({});
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lot");
    if (fromUrl) {
      setLotName(fromUrl);
      search(fromUrl);
    }
  }, []);

  async function connectWallet() {
    setError("");
    if (!window.ethereum) return setError("MetaMask n'est pas installé.");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(chainId, 16) !== SEPOLIA_CHAIN_ID) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + SEPOLIA_CHAIN_ID.toString(16) }],
        });
      }
      setAccount(accounts[0]);
    } catch (e) {
      setError("Connexion refusée : " + (e.shortMessage || e.message));
    }
  }

  async function search(name = lotName) {
    const clean = name.trim();
    if (!clean) return;
    setError(""); setNote(""); setLot(null); setBatches([]); setResults({});
    setLoading(true);
    try {
      const contract = publicContract();
      const data = await contract.getLot(lotIdOf(clean));
      setLot({
        compromised: data.compromised,
        minTemp: Number(data.minTemp) / 10,
        maxTemp: Number(data.maxTemp) / 10,
        anchorCount: Number(data.anchorCount),
        createdAt: new Date(Number(data.createdAt) * 1000).toLocaleString(),
      });
    } catch {
      setLoading(false);
      return setError("Lot introuvable sur la blockchain.");
    }
    try {
      const res = await fetch(`${COLLECTOR_URL}/batches`);
      const all = await res.json();
      setBatches(all.filter((b) => b.lotName === clean));
    } catch {
      setNote("Le serveur de preuves est injoignable : l'état du lot reste fiable (lu sur la blockchain), mais les mesures ne peuvent pas être listées.");
    }
    setLoading(false);
  }

  async function verify(batch, measure, key) {
    try {
      const contract = account ? await walletContract() : publicContract();
      const ok = await contract.verifyMeasurement(
        batch.lotId, batch.anchorIndex, measure.leaf, measure.proof
      );
      setResults((r) => ({ ...r, [key]: ok }));
    } catch (e) {
      setError("Vérification impossible : " + (e.shortMessage || e.message));
    }
  }

  const qrValue = `${window.location.origin}/?lot=${encodeURIComponent(lotName.trim())}`;

  return (
    <div className="app">
      <header>
        <h1>Chaîne du froid</h1>
        <p>Vérification de lots de médicaments et vaccins (réseau de test Sepolia)</p>
        <button onClick={connectWallet}>
          {account ? `Connecté : ${account.slice(0, 6)}…${account.slice(-4)}` : "Connecter MetaMask"}
        </button>
      </header>

      <section className="card">
        <label>Code du lot</label>
        <div className="row">
          <input
            value={lotName}
            onChange={(e) => setLotName(e.target.value)}
            placeholder="LOT-2026-001"
          />
          <button onClick={() => search()}>Vérifier</button>
        </div>
        {loading && <p>Lecture de la blockchain…</p>}
        {error && <p className="error">{error}</p>}
        {note && <p className="warn">{note}</p>}
      </section>

      {lot && (
        <section className="card">
          <div className={lot.compromised ? "badge bad" : "badge good"}>
            {lot.compromised ? "CHAÎNE DU FROID ROMPUE — NE PAS UTILISER" : "CHAÎNE DU FROID RESPECTÉE"}
          </div>
          <ul>
            <li>Plage autorisée : {lot.minTemp} °C à {lot.maxTemp} °C</li>
            <li>Racines de Merkle ancrées : {lot.anchorCount}</li>
            <li>Lot enregistré le : {lot.createdAt}</li>
            <li>Contrat : <code>{CONTRACT_ADDRESS}</code></li>
          </ul>
          <div className="qr">
            <QRCodeSVG value={qrValue} size={128} />
            <small>QR code du lot (ouvre cette page)</small>
          </div>
        </section>
      )}

      {batches.map((b) => (
        <section className="card" key={b.txHash}>
          <h3>Paquet n°{b.anchorIndex}</h3>
          <small>Racine : <code>{b.root.slice(0, 18)}…</code></small>
          <table>
            <thead>
              <tr><th>Heure</th><th>Température</th><th>Preuve</th></tr>
            </thead>
            <tbody>
              {b.measures.map((m, i) => {
                const key = `${b.anchorIndex}-${i}`;
                const out = out_(results[key]);
                const abnormal = lot && (m.temperature / 10 < lot.minTemp || m.temperature / 10 > lot.maxTemp);
                return (
                  <tr key={key} className={abnormal ? "row-bad" : ""}>
                    <td>{new Date(m.timestamp * 1000).toLocaleTimeString()}</td>
                    <td>{m.temperature / 10} °C</td>
                    <td>
                      {out ?? <button onClick={() => verify(b, m, key)}>Vérifier</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );S
}

function out_(value) {
  if (value === undefined) return null;
  return value ? <span className="good-text">✔ Authentique</span> : <span className="error">✘ Invalide</span>;
}