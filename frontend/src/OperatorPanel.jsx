import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { SEPOLIA_CHAIN_ID, lotIdOf, publicContract, walletContract } from "./contract";

const COLLECTOR_ROLE = ethers.id("COLLECTOR_ROLE");

// Types de médicaments : plages en dixièmes de °C (valeurs d'illustration, comme dans le collecteur)
const TYPES = {
  VACCIN: { label: "Vaccin", min: 20, max: 80 },
  INSULINE: { label: "Insuline", min: 20, max: 80 },
  ANTIBIOTIQUE: { label: "Antibiotique (exemple)", min: 150, max: 250 },
  VACCIN_CONGELE: { label: "Vaccin congelé (exemple)", min: -250, max: -150 },
};
const NAME_RE = /^[A-Za-z0-9-]{3,40}$/;
const KEY = "mes-lots-v1";

function loadList() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveList(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* stockage indisponible */ }
}

export default function OperatorPanel({ account, onOpenLot }) {
  const [list, setList] = useState(loadList);
  const [follow, setFollow] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("VACCIN");
  const [isCollector, setIsCollector] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  // Le portefeuille connecté a-t-il le rôle collecteur ?
  useEffect(() => {
    let alive = true;
    setIsCollector(false);
    if (!account) return undefined;
    publicContract()
      .hasRole(COLLECTOR_ROLE, account)
      .then((ok) => { if (alive) setIsCollector(ok); })
      .catch(() => { if (alive) setIsCollector(false); });
    return () => { alive = false; };
  }, [account]);

  const update = (next) => { setList(next); saveList(next); };

  async function lotExists(n) {
    try {
      await publicContract().getLot(lotIdOf(n));
      return true;
    } catch {
      return false;
    }
  }

  async function followLot() {
    setErr(""); setMsg("");
    const n = follow.trim();
    if (!NAME_RE.test(n)) return setErr("Nom invalide : 3 à 40 caractères, lettres, chiffres et tirets.");
    if (list.some((l) => l.name === n)) return setErr("Ce lot est déjà dans votre liste.");
    if (!(await lotExists(n))) return setErr("Lot introuvable sur la blockchain.");
    update([{ name: n, type: "" }, ...list]);
    setFollow("");
    return setMsg(`Lot ${n} ajouté à votre liste.`);
  }

  async function createLot() {
    setErr(""); setMsg(""); setCreated(null);
    const n = name.trim();
    if (!NAME_RE.test(n)) return setErr("Nom invalide : 3 à 40 caractères, lettres, chiffres et tirets.");
    setBusy(true);
    try {
      if (await lotExists(n)) {
        setErr("Ce nom de lot existe déjà sur la blockchain.");
        return undefined;
      }
      const net = await new ethers.BrowserProvider(window.ethereum).getNetwork();
      if (Number(net.chainId) !== SEPOLIA_CHAIN_ID) {
        setErr("Passez MetaMask sur le réseau Ethereum Sepolia, puis réessayez.");
        return undefined;
      }
      const t = TYPES[type];
      const c = await walletContract();
      const tx = await c.registerLot(lotIdOf(n), ethers.id(`produit:${type}:${n}`), t.min, t.max);
      setMsg("Transaction envoyée, en attente de confirmation…");
      await tx.wait();
      update([{ name: n, type }, ...list.filter((l) => l.name !== n)]);
      setCreated({ name: n, type, hash: tx.hash });
      setMsg("");
      setName("");
    } catch (e) {
      setMsg("");
      setErr("Création impossible : " + (e.shortMessage || e.message));
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  const t = TYPES[type];

  return (
    <section className="card">
      <h3>Mes lots</h3>
      <p className="hint">
        Cette liste est enregistrée dans ce navigateur. « Retirer » ne supprime rien sur la blockchain :
        un lot enregistré y reste, ce qui garantit la traçabilité.
      </p>
      <div className="row">
        <input value={follow} onChange={(e) => setFollow(e.target.value)} placeholder="Suivre un lot existant (ex. LOT-2026-001)" />
        <button onClick={followLot}>Ajouter</button>
      </div>
      {list.length === 0 && <p className="hint">Aucun lot dans votre liste.</p>}
      <ul className="lots">
        {list.map((l) => (
          <li key={l.name}>
            <span><b>{l.name}</b>{l.type ? ` · ${TYPES[l.type]?.label || l.type}` : ""}</span>
            <span>
              <button className="link" onClick={() => onOpenLot(l.name)}>Ouvrir</button>
              <button className="link" onClick={() => update(list.filter((x) => x.name !== l.name))}>Retirer de ma liste</button>
            </span>
          </li>
        ))}
      </ul>

      <h3>Espace opérateur : créer un lot</h3>
      {!account && <p className="hint">Connectez votre portefeuille pour accéder à la création de lots.</p>}
      {account && !isCollector && (
        <p className="warn">
          Le portefeuille {account.slice(0, 6)}…{account.slice(-4)} n'a pas le rôle collecteur : il peut consulter les lots
          mais pas en créer. L'administrateur du contrat peut l'autoriser.
        </p>
      )}
      {account && isCollector && (
        <div className="op-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du lot (ex. LOT-INSULINE-002)" />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <small>Plage autorisée pour ce type : {t.min / 10} °C à {t.max / 10} °C</small>
          <button onClick={createLot} disabled={busy}>{busy ? "En cours…" : "Créer le lot"}</button>
        </div>
      )}
      {msg && <p className="hint">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {created && (
        <div>
          <p className="good-text">Lot {created.name} créé sur la blockchain.</p>
          <p className="hint">
            <a href={`https://sepolia.etherscan.io/tx/${created.hash}`} target="_blank" rel="noreferrer">Voir la transaction sur Etherscan</a>
          </p>
          <p className="hint">Pour lui envoyer des mesures, lancez le capteur avec exactement ce type :</p>
          <pre className="cmd">{`$env:LOT_NAME="${created.name}"\n$env:MEDICINE="${created.type}"\npython sensor.py`}</pre>
        </div>
      )}
    </section>
  );
}