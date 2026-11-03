import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { publicContract } from "./contract";

const short = (h) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const tiny = (h) => `${h.slice(0, 6)}…${h.slice(-3)}`;

// Paires triées avant hachage, comme OpenZeppelin et merkletreejs (sortPairs)
function pairHash(a, b) {
  const [x, y] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([x, y]));
}

// Un nœud sans voisin remonte tel quel au niveau suivant
function buildLayers(leaves) {
  const layers = [leaves];
  let cur = leaves;
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(i + 1 === cur.length ? cur[i] : pairHash(cur[i], cur[i + 1]));
    }
    layers.push(next);
    cur = next;
  }
  return layers;
}

function nodeLabel(layer, idx, n, top) {
  if (layer === 0) return `h${idx + 1}`;
  if (layer === top) return "Racine";
  const a = idx * 2 ** layer + 1;
  const b = Math.min((idx + 1) * 2 ** layer, n);
  if (a === b) return `h${a}`;
  return layer === 1 ? `h${a}${b}` : `h${a}-${b}`;
}

// Dimensions du dessin
const NW = 72, NH = 40, GX = 8, RG = 74, LM = 96;

export default function MerkleExplorer({ batch }) {
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState(false);
  const [sel, setSel] = useState(0);
  const [chainRoot, setChainRoot] = useState("");

  const measures = useMemo(() => (demo ? batch.measures.slice(0, 4) : batch.measures), [demo, batch]);
  const layers = useMemo(() => buildLayers(measures.map((m) => m.leaf)), [measures]);

  if (!open) {
    return <button className="secondary" onClick={() => setOpen(true)}>Voir l'arbre de Merkle de ce paquet</button>;
  }

  const n = measures.length;
  const top = layers.length - 1;
  const root = layers[top][0];
  const i0 = Math.min(sel, n - 1);
  const lab = (l, i) => nodeLabel(l, i, n, top);

  // Chemin de la mesure choisie et voisins fournis comme preuve
  const pathSet = new Set();
  const sibSet = new Set();
  const steps = [];
  let idx = i0;
  for (let l = 0; l < top; l++) {
    const sib = idx ^ 1;
    const hasSib = sib < layers[l].length;
    pathSet.add(`${l}:${idx}`);
    if (hasSib) sibSet.add(`${l}:${sib}`);
    steps.push({ l, idx, sib: hasSib ? sib : null });
    idx >>= 1;
  }
  pathSet.add(`${top}:${idx}`);

  // Positions : feuilles réparties, parents centrés au-dessus de leurs enfants
  const pos = [];
  for (let l = 0; l <= top; l++) {
    pos[l] = layers[l].map((_, i) => {
      const y = 8 + (top - l) * RG;
      if (l === 0) return { x: LM + i * (NW + GX) + NW / 2, y };
      const kids = [2 * i, 2 * i + 1].filter((k) => k < layers[l - 1].length);
      const x = kids.reduce((s, k) => s + pos[l - 1][k].x, 0) / kids.length;
      return { x, y };
    });
  }
  const svgW = LM + n * (NW + GX) + 8;
  const svgH = top * RG + NH + 16;

  const m = measures[i0];
  const recomputed = ethers.solidityPackedKeccak256(
    ["bytes32", "int16", "uint64"],
    [batch.lotId, m.temperature, m.timestamp]
  );
  const leafOk = recomputed.toLowerCase() === m.leaf.toLowerCase();
  const rootOk = !demo && root.toLowerCase() === batch.root.toLowerCase();

  async function checkChain() {
    try {
      const a = await publicContract().getAnchor(batch.lotId, batch.anchorIndex);
      setChainRoot(a.root);
    } catch {
      setChainRoot("erreur");
    }
  }

  return (
    <div className="merkle">
      <h4>Du capteur à la racine de Merkle</h4>
      <ol className="m-intro">
        <li>Le capteur simulé tire une température entre 3,0 et 7,0 °C et l'écrit en dixièmes de degré (45 = 4,5 °C).</li>
        <li>Il calcule l'empreinte (la feuille) : keccak256(lot, température, heure), puis la signe avec sa clé privée.</li>
        <li>Il publie le message par MQTT. Le collecteur vérifie la signature et regroupe 10 mesures.</li>
        <li>Les feuilles sont combinées deux à deux jusqu'à une racine unique, ancrée sur la blockchain.</li>
      </ol>

      <label className="m-toggle">
        <input type="checkbox" checked={demo} onChange={(e) => { setDemo(e.target.checked); setSel(0); }} />
        {" "}Mode démonstration : seulement 4 mesures (h1 à h4, h12, h34)
      </label>
      {demo && <p className="warn">Arbre pédagogique : sa racine n'est pas celle ancrée sur la blockchain.</p>}

      <div className="m-scroll">
        <svg width={svgW} height={svgH} role="img" aria-label="Arbre de Merkle">
          {/* traits entre parents et enfants */}
          {layers.map((layer, l) =>
            l === 0 ? null : layer.map((_, i) =>
              [2 * i, 2 * i + 1].filter((k) => k < layers[l - 1].length).map((k) => {
                const c = pos[l - 1][k];
                const p = pos[l][i];
                const onPath = pathSet.has(`${l - 1}:${k}`) && pathSet.has(`${l}:${i}`);
                const isSib = sibSet.has(`${l - 1}:${k}`);
                return (
                  <line key={`e${l}-${i}-${k}`} x1={c.x} y1={c.y} x2={p.x} y2={p.y + NH}
                    stroke={onPath ? "#11602D" : isSib ? "#8A5A00" : "#9AA8B5"} strokeWidth={onPath || isSib ? 2.2 : 1.2} />
                );
              })
            )
          )}
          {/* nœuds */}
          {layers.map((layer, l) =>
            layer.map((h, i) => {
              const { x, y } = pos[l][i];
              const key = `${l}:${i}`;
              const onPath = pathSet.has(key);
              const isSib = sibSet.has(key);
              return (
                <g key={`n${key}`} onClick={l === 0 ? () => setSel(i) : undefined} style={{ cursor: l === 0 ? "pointer" : "default" }}>
                  <title>{h}</title>
                  <rect x={x - NW / 2} y={y} width={NW} height={NH} rx="8"
                    fill={onPath || l === top ? "#D7F5E0" : isSib ? "#FFE9B8" : "#EAF1F7"}
                    stroke={onPath || l === top ? "#11602D" : isSib ? "#8A5A00" : "#B8C4D0"}
                    strokeWidth={onPath || isSib ? 2.2 : 1.2} />
                  <text x={x} y={y + 16} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1B2733">{lab(l, i)}</text>
                  <text x={x} y={y + 31} textAnchor="middle" fontSize="10" fill="#1B2733">
                    {l === 0 ? `${measures[i].temperature / 10} °C` : tiny(h)}
                  </text>
                </g>
              );
            })
          )}
          {/* noms des niveaux */}
          {Array.from({ length: top + 1 }, (_, r) => {
            const l = top - r;
            return (
              <text key={`t${l}`} x={4} y={8 + r * RG + NH / 2 + 4} fontSize="11" fill="#4B5B6B">
                {l === 0 ? "Mesures" : l === top ? "Racine" : `Niveau ${l}`}
              </text>
            );
          })}
        </svg>
      </div>
      <p className="legend">
        Cliquez sur une mesure. Vert : chemin jusqu'à la racine. Orange : voisins fournis comme preuve.
        Un nœud sans voisin (par exemple h9-10 avec 10 mesures) remonte tel quel au niveau suivant.
      </p>

      <h4>Calcul pour la mesure {lab(0, i0)} ({m.temperature / 10} °C)</h4>
      <ul className="m-steps">
        <li>
          Feuille recalculée dans votre navigateur : <code>{short(recomputed)}</code>{" "}
          {leafOk ? "✔ identique à celle reçue" : "✘ différente"}
        </li>
        {steps.map((s) => {
          if (s.sib === null) {
            return <li key={s.l}>{lab(s.l, s.idx)} n'a pas de voisin à ce niveau : il remonte tel quel.</li>;
          }
          const parent = layers[s.l + 1][s.idx >> 1];
          return (
            <li key={s.l}>
              keccak256 des deux hash triés ({lab(s.l, s.idx)} et {lab(s.l, s.sib)}) donne {lab(s.l + 1, s.idx >> 1)} : <code>{short(parent)}</code>
            </li>
          );
        })}
        <li>Racine recalculée : <code>{short(root)}</code></li>
        {!demo && (
          <li>
            {rootOk ? "✔ Identique à la racine enregistrée par le collecteur." : "✘ Différente de la racine du collecteur."}{" "}
            <button className="link" onClick={checkChain}>Comparer avec la blockchain</button>
            {chainRoot && chainRoot !== "erreur" && (
              <span> : racine sur la blockchain <code>{short(chainRoot)}</code> {chainRoot.toLowerCase() === root.toLowerCase() ? "✔ identique" : "✘ différente"}</span>
            )}
            {chainRoot === "erreur" && <span> : lecture impossible, réessayez.</span>}
          </li>
        )}
      </ul>
      <button className="secondary" onClick={() => setOpen(false)}>Masquer l'arbre</button>
    </div>
  );
}