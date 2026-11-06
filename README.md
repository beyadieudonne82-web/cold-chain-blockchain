# Traçabilité de la chaîne du froid des médicaments et vaccins

## Université de Kinshasa (UNIKIN)
**Faculté des Sciences et Technologies**  
**Département de Mathématiques, Statistiques et Informatique**

**Niveau :** Master 1  
**Cours :** Blockchain et cryptomonnaie  
**Professeur :** KASENGEDIA  
**Encadrement :** Doctorant Junior Kaningini  
**Groupe 08 :** Blockchain et Internet des objets  
**Année académique :** 2025-2026

### Membres du groupe

| N° | Nom et prénom |
|---:|---|
| 1 | BEYA KADIMA Dieudonne |
| 2 | LUWAWA NAMATA Glody |
| 3 | NKONGOLO NTUMBA TELPH |
| 4 | MUAKA DI MUAKA MARDOCHE |

---

## 1. Présentation et objectifs du projet

Ce projet consiste à concevoir et à développer un système de traçabilité de la chaîne du froid des médicaments et des vaccins à l'aide de la technologie Blockchain et de l'Internet des objets (IoT).

L'objectif principal est de garantir l'intégrité et la traçabilité des informations relatives aux températures enregistrées pendant le transport et le stockage des produits pharmaceutiques.

Le système permet notamment de vérifier si un lot de médicaments ou de vaccins a été conservé dans les conditions de température qui lui sont applicables, et de permettre à une pharmacie de consulter ces informations à partir d'une application décentralisée (DApp).

### Objectifs spécifiques

Le prototype permet de :

- Simuler des capteurs de température à l'aide du langage Python.
- Signer cryptographiquement chaque mesure afin de garantir son authenticité.
- Transmettre les mesures par le protocole MQTT sécurisé (TLS).
- Regrouper périodiquement les mesures en paquets de dix.
- Construire un arbre de Merkle pour garantir l'intégrité des données.
- Ancrer les racines de Merkle sur la blockchain Ethereum.
- Gérer plusieurs types de produits (vaccin, insuline, etc.), chacun avec sa plage de température.
- Détecter et signaler les ruptures de la chaîne du froid.
- Permettre la vérification des lots par une pharmacie grâce à une DApp et à un QR code.
- Visualiser le fonctionnement de l'arbre de Merkle, de la mesure jusqu'à la racine, et comparer la racine recalculée à celle de la blockchain.
- Permettre à un opérateur autorisé de créer de nouveaux lots depuis la DApp avec son portefeuille MetaMask.

## 2. Liens et ressources du projet

| Élément | Adresse |
|---|---|
| Application décentralisée (DApp) | https://cold-chain-blockchain-frontend.vercel.app |
| Dépôt GitHub | https://github.com/beyadieudonne82-web/cold-chain-blockchain |
| Contrat intelligent ColdChain | [Consulter sur Etherscan](https://sepolia.etherscan.io/address/0x29AE4102f9a2F4394C54366770B92040D309ff90) |
| Collecteur de données | https://cold-chain-blockchain.onrender.com |
| API des paquets de mesures | https://cold-chain-blockchain.onrender.com/batches |

**Réseau blockchain utilisé : Ethereum Sepolia (réseau de test, identifiant de chaîne 11155111).**

Le sujet initial mentionnait Polygon Amoy. Cependant, pour des raisons liées aux contraintes d'approvisionnement en jetons de test (les robinets Amoy exigeaient des fonds réels sur le réseau principal, ce qui est interdit par les règles du projet), Ethereum Sepolia a été retenu.

Le contrat intelligent est déployé sur Sepolia. Une migration vers Polygon Amoy reste envisageable en adaptant la configuration et en redéployant le contrat.

### Remarques sur les services

- Le collecteur utilise l'offre gratuite de Render. Il peut être mis en veille après une période d'inactivité. La première requête peut donc prendre environ une minute.
- MetaMask est utilisé pour les interactions nécessitant un portefeuille.
- La consultation publique des informations d'un lot ne nécessite pas de connexion MetaMask.
- Les domaines Vercel récents peuvent afficher un avertissement de sécurité de MetaMask lors de leur première utilisation.

## 3. Architecture technique du système

Le système repose sur cinq composants : les capteurs IoT, le broker MQTT, le collecteur de données, le contrat intelligent et l'application décentralisée.

### 3.1. Schéma architectural

```text
       CAPTEUR SIMULÉ (PYTHON)
       Mesure de température
       Signature cryptographique
                 |
                 |
              MQTT/TLS
                 |
                 v
          EMQX CLOUD
           Broker MQTT
                 |
                 v
       COLLECTEUR NODE.JS
              (Render)
                 |
       Vérification des signatures
       Regroupement des mesures
       Construction de Merkle
                 |
                 v
        CONTRAT INTELLIGENT
        ColdChain (Ethereum)
             Sepolia
                 |
          Racines de Merkle
          État des lots
          Vérification des preuves
                 |
                 v
          DAPP REACT (Vercel)
                 |
             MetaMask
                 |
          PHARMACIE / UTILISATEUR
          Vérification par QR code
```

### 3.2. Fonctionnement général

1. Le capteur simulé collecte périodiquement une température, exprimée en dixièmes de degré Celsius (45 correspond à 4,5 °C).
2. Chaque mesure est associée à un horodatage et à un identifiant de lot.
3. Le capteur génère une empreinte cryptographique (keccak256 du lot, de la température et de l'heure) et signe la mesure.
4. Les données sont transmises au collecteur par MQTT avec TLS.
5. Le collecteur vérifie les signatures, enregistre le lot s'il est nouveau, et regroupe les mesures par paquets de dix.
6. Il construit un arbre de Merkle et calcule sa racine.
7. La racine est enregistrée sur Ethereum Sepolia à travers le contrat intelligent. Si une température sort de la plage du lot, le collecteur signale la rupture.
8. La DApp permet à un utilisateur de consulter les informations du lot et de vérifier les preuves d'intégrité.

### 3.3. Données enregistrées sur la blockchain

- L'identifiant cryptographique du lot et l'empreinte du produit.
- Les limites minimale et maximale de température du lot.
- Les racines de Merkle des paquets de mesures.
- L'état de conformité ou de rupture de la chaîne du froid.
- Les événements `LotRegistered`, `RootAnchored` et `BreachFlagged`.

### 3.4. Données conservées hors blockchain

- Les mesures brutes de température.
- Les horodatages.
- Les signatures des capteurs.
- Les feuilles et les preuves de Merkle.
- Les informations détaillées des paquets.

Le fichier utilisé pour conserver les paquets est `collector/data/batches.json`, servi par l'API `/batches` du collecteur.

### 3.5. Utilité de l'arbre de Merkle

L'arbre de Merkle permet de regrouper plusieurs mesures dans une structure cryptographique unique.

Chaque mesure constitue une feuille de l'arbre. Les feuilles sont combinées deux à deux, progressivement, pour produire une racine de Merkle. Cette racine est ensuite enregistrée sur la blockchain.

L'avantage est de ne pas enregistrer chaque mesure individuellement sur la blockchain, ce qui réduit les coûts en gas tout en conservant la possibilité de vérifier l'intégrité d'une mesure particulière grâce à sa **preuve de Merkle** (les empreintes « voisines » qui permettent de remonter jusqu'à la racine).

## 4. Catalogue des médicaments et plages de température

Le système intègre un catalogue de types de produits pharmaceutiques. Chaque type correspond à une plage de température, enregistrée **sur la blockchain, lot par lot**, au moment de la création du lot.

| Type de produit | Code | Température minimale | Température maximale |
|---|---|---:|---:|
| Vaccin | `VACCIN` | 2 °C | 8 °C |
| Insuline | `INSULINE` | 2 °C | 8 °C |
| Antibiotique (exemple) | `ANTIBIOTIQUE` | 15 °C | 25 °C |
| Vaccin congelé (exemple) | `VACCIN_CONGELE` | -25 °C | -15 °C |

Ces valeurs sont des paramètres de **démonstration** du prototype. Les conditions réelles de conservation doivent toujours être définies selon les recommandations du fabricant et les exigences applicables à chaque produit.

**Comment le type est utilisé :**

- Le capteur indique le type du produit avec la variable d'environnement `MEDICINE` (par défaut `VACCIN`) et le lot avec `LOT_NAME`.
- Le collecteur enregistre un nouveau lot avec la plage correspondant à son type, puis compare chaque température à cette plage.
- Lorsqu'une température sort de la plage, le lot est marqué comme rompu (événement `BreachFlagged`).
- La DApp lit la plage directement sur la blockchain : elle s'adapte donc automatiquement à chaque lot.

Le type de produit doit être **identique** entre le lot et le capteur qui lui envoie des mesures.

## 5. Fonctionnalités de la DApp

### 5.1. Consulter un lot

Saisir le code du lot (par exemple `LOT-2026-001`) ou scanner son QR code. La DApp lit sur la blockchain :

- le bandeau **« chaîne du froid respectée »** (vert) ou **« chaîne du froid rompue »** (rouge) ;
- la plage de température autorisée ;
- le nombre de racines de Merkle ancrées ;
- la date d'enregistrement du lot et l'adresse du contrat.

Cette lecture est publique : elle ne nécessite ni compte ni portefeuille.

### 5.2. Vérifier une mesure : « intègre » n'est pas « conforme »

Pour chaque mesure d'un paquet, le bouton **Vérifier** envoie la mesure et sa preuve de Merkle au contrat, qui recalcule la racine et la compare à celle ancrée. Le résultat combine deux informations indépendantes :

| Message | Signification |
|---|---|
| ✔ **Conforme · intègre** | La mesure n'a pas été modifiée et sa température est dans la plage du lot |
| ⚠ **Hors plage · intègre** | La mesure n'a pas été modifiée, mais sa température sort de la plage du lot |
| ✘ **Invalide : mesure modifiée** | La preuve ne mène pas à la racine ancrée : la mesure a été modifiée après coup |

**À retenir :** la blockchain ne dit pas que la température est bonne, elle prouve que la donnée enregistrée n'a pas été modifiée. Une mesure « hors plage » peut donc être parfaitement intègre : c'est justement elle qui prouve la rupture de la chaîne du froid.

### 5.3. Visualiser l'arbre de Merkle

Sous chaque paquet, le bouton **Voir l'arbre de Merkle de ce paquet** affiche :

- une explication du trajet de la mesure, du capteur jusqu'à la racine ;
- l'arbre complet : mesures (h1, h2, …), niveaux intermédiaires (h12, h34, …) et racine ;
- le **chemin de la mesure choisie** (en vert) et les **voisins fournis comme preuve** (en orange) ;
- le détail du calcul pour la mesure sélectionnée : **la feuille est recalculée dans le navigateur** à partir de la température et de l'heure, puis comparée à celle reçue ;
- la **racine recalculée**, comparée à la racine enregistrée par le collecteur puis, par un bouton, à celle **lue sur la blockchain** ;
- un **mode démonstration à 4 mesures** (h1 à h4, h12, h34) qui correspond au schéma pédagogique du rapport.

Un nœud sans voisin (par exemple h9-10 avec dix mesures) remonte tel quel au niveau suivant.

### 5.4. Mes lots

La carte **Mes lots** permet de garder une liste de lots à suivre :

- **Ajouter** : suivre un lot existant (la DApp vérifie qu'il existe sur la blockchain) ;
- **Ouvrir** : afficher directement le lot ;
- **Retirer de ma liste** : masquer le lot de la liste.

La liste est enregistrée **dans le navigateur de l'utilisateur**. Retirer un lot de la liste **ne supprime rien sur la blockchain** : un lot enregistré y reste, ce qui garantit la traçabilité. Le contrat ne propose volontairement aucune fonction de suppression.

### 5.5. Espace opérateur : créer un lot

Lorsqu'un portefeuille disposant du **rôle collecteur** (`COLLECTOR_ROLE`) est connecté, la DApp affiche un formulaire de création de lot :

1. saisir le nom du lot (3 à 40 caractères : lettres, chiffres et tirets) ;
2. choisir le type de médicament (la plage de température correspondante s'affiche) ;
3. cliquer sur **Créer le lot** et confirmer la transaction dans MetaMask (le gas est payé en ETH de test par le portefeuille de l'opérateur).

Une fois le lot créé, la DApp affiche le lien de la transaction sur Etherscan et la commande du capteur à lancer pour lui envoyer des mesures. Un portefeuille **sans** le rôle collecteur peut consulter les lots mais pas en créer.

**Attribuer le rôle collecteur** (opération réservée à l'administrateur du contrat, sans modifier le code) : sur la page Etherscan du contrat, onglet *Write Contract*, connecter le compte administrateur et appeler `grantRole` avec :

- `role` : la valeur de `COLLECTOR_ROLE` (visible dans l'onglet *Read Contract*) ;
- `account` : l'adresse du portefeuille à autoriser.

Le droit se retire avec `revokeRole`. Le rôle collecteur permet aussi d'ancrer des racines et de signaler des ruptures : il ne doit être donné qu'à des personnes de confiance.

## 6. Structure du dépôt GitHub

| Dossier | Description |
|---|---|
| `blockchain/` | Contrat intelligent Solidity, tests Hardhat et scripts de déploiement. |
| `iot/` | Simulateur de capteur Python, génération des mesures et signatures cryptographiques. |
| `collector/` | Collecteur Node.js, communication MQTT, vérification des signatures, catalogue de médicaments et construction des arbres de Merkle. |
| `frontend/` | Application décentralisée React avec Vite (consultation, arbre de Merkle, Mes lots, espace opérateur). |
| `docs/` | Rapports techniques et captures d'écran du projet. |

## 7. Technologies, bibliothèques et services utilisés

### 7.1. Technologies principales

| Technologie | Utilisation |
|---|---|
| Solidity | Développement du contrat intelligent. |
| Ethereum Sepolia | Réseau blockchain de test. |
| Python | Simulation des capteurs IoT. |
| Node.js | Développement du collecteur. |
| React | Interface utilisateur de la DApp. |
| Vite | Environnement de développement frontend. |
| MQTT | Transmission des mesures. |
| TLS | Sécurisation des communications. |
| Arbre de Merkle | Vérification de l'intégrité des données. |

### 7.2. Bibliothèques utilisées

- OpenZeppelin Contracts : `AccessControl`, `ReentrancyGuard`, `MerkleProof`.
- Hardhat : compilation, tests et déploiement du contrat.
- ethers.js : interaction avec la blockchain (collecteur et DApp).
- merkletreejs : construction des arbres de Merkle dans le collecteur.
- MQTT.js : communication MQTT côté collecteur.
- paho-mqtt : communication MQTT côté capteur Python.
- eth-account et eth-utils : comptes, signatures et fonctions cryptographiques côté capteur.
- dotenv : gestion des variables d'environnement.
- React et Vite : interface utilisateur.
- qrcode.react : génération des QR codes.
- Slither : analyse statique du contrat intelligent.

### 7.3. Services externes

- EMQX Cloud : broker MQTT (offre Serverless).
- Alchemy : fournisseur d'accès RPC Ethereum.
- Etherscan : consultation des transactions et du contrat.
- Render : hébergement du collecteur.
- Vercel : hébergement de la DApp.
- MetaMask : connexion au portefeuille Ethereum.

## 8. Installation et lancement en environnement local

### 8.1. Prérequis

- Node.js version 20 ou supérieure.
- npm.
- Python 3.
- Git.
- MetaMask.
- Un accès à Ethereum Sepolia et quelques ETH de test.
- Un compte et une configuration MQTT sur EMQX Cloud.

### 8.2. Configuration des variables d'environnement

Chaque composant possède un fichier `.env.example`. Il faut le copier vers `.env`, puis renseigner les variables nécessaires.

Les clés privées, mots de passe et autres informations confidentielles ne doivent **jamais** être publiés sur GitHub (les fichiers `.env` sont exclus par le `.gitignore`).

### 8.3. Installation du contrat intelligent

```bash
cd blockchain
npm install
npx hardhat test
```

### 8.4. Démarrage du collecteur

```bash
cd collector
npm install
node index.js
```

Le collecteur doit être configuré avec les informations de connexion au broker MQTT et les paramètres blockchain. **Ne lancer qu'un seul collecteur à la fois** : deux collecteurs utilisant le même compte enverraient des transactions en double.

### 8.5. Démarrage du capteur IoT

```powershell
cd iot
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install paho-mqtt eth-account python-dotenv
```

Lancer le capteur :

```bash
python sensor.py
```

Simuler une rupture de la chaîne du froid :

```bash
python sensor.py --breach
```

Envoyer des mesures pour un lot et un type de médicament précis (PowerShell) :

```powershell
$env:LOT_NAME="LOT-INSULINE-001"
$env:MEDICINE="INSULINE"
python sensor.py
```

Les types disponibles sont `VACCIN`, `INSULINE`, `ANTIBIOTIQUE` et `VACCIN_CONGELE`. Le collecteur enregistre automatiquement un lot inconnu, avec la plage de son type.

### 8.6. Démarrage de la DApp

```bash
cd frontend
npm install
npm run dev
```

L'application est alors accessible à l'adresse locale fournie par Vite, généralement `http://localhost:5173`.

## 9. Déploiement

### 9.1. Déploiement du contrat intelligent

Depuis le dossier `blockchain` :

```bash
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat verify --network sepolia ADRESSE_DU_CONTRAT
```

### 9.2. Déploiement du collecteur

Le collecteur est hébergé sur Render. Le dossier racine du service est `collector/`. Les variables d'environnement sont configurées directement dans les paramètres du service Render.

### 9.3. Déploiement de la DApp

L'application est hébergée sur Vercel. Le dossier racine du projet est `frontend/`. Trois variables publiques sont configurées dans Vercel : `VITE_CONTRACT_ADDRESS`, `VITE_COLLECTOR_URL` et `VITE_RPC_URL`. Elles sont visibles dans le navigateur : aucune clé privée ni clé d'accès ne doit y figurer.

## 10. Tests et sécurité

### 10.1. Tests automatisés

Le contrat intelligent a fait l'objet de six tests automatisés avec Hardhat. Les scénarios couverts sont :

1. L'enregistrement d'un lot.
2. Le refus d'un appelant sans rôle (contrôle d'accès).
3. Le refus d'un lot en double.
4. Le rejet d'une plage de température invalide.
5. L'ancrage d'une racine de Merkle et la vérification d'une mesure, avec rejet d'une mesure falsifiée.
6. Le signalement d'une rupture, et son refus lorsque la température est normale.

### 10.2. Analyse statique avec Slither

Une analyse statique a été réalisée avec Slither version 0.11.6.

| Indicateur | Résultat |
|---|---:|
| Détecteurs utilisés | 102 |
| Contrats analysés | 10 |
| Alertes signalées | 0 |

L'absence d'alerte ne constitue pas une garantie absolue de sécurité. Le contrat n'a pas fait l'objet d'un audit professionnel indépendant.

### 10.3. Mesures de sécurité appliquées

- Contrôle d'accès basé sur les rôles (`COLLECTOR_ROLE`), vérifié aussi côté DApp avant d'afficher la création de lots.
- Protection contre la réentrance (mesure de principe : le contrat ne fait aucun appel externe ni transfert d'ETH).
- Validation des entrées et erreurs personnalisées.
- Émission d'événements pour assurer la traçabilité.
- Signatures cryptographiques des mesures, vérifiées par le collecteur.
- Aucune donnée personnelle sur la blockchain : seulement des empreintes.
- Communications MQTT sécurisées par TLS.
- Secrets exclus de GitHub, stockés dans les variables d'environnement des services.

## 11. Analyse des coûts en gas

Les mesures de consommation de gas ont été réalisées avec Hardhat, Solidity 0.8.28 et l'optimiseur activé avec 200 exécutions.

| Opération | Consommation moyenne en gas | Nombre d'appels dans les tests |
|---|---:|---:|
| Déploiement de `ColdChain` | 1 044 771 | 1 |
| `registerLot` | 78 266 | 5 |
| `anchorRoot` | 121 137 | 1 |
| `flagBreach` | 34 996 | 2 |
| `grantRole` | 51 485 | 1 |

L'ancrage d'une racine de Merkle (environ 121 000 gas) représente un paquet entier de dix mesures, au lieu d'enregistrer chaque mesure séparément. La vérification d'une preuve est un appel en lecture seule, donc gratuite pour l'utilisateur.

Le coût réel en ETH dépend du prix du gas au moment de l'exécution. La création d'un lot depuis la DApp utilise `registerLot` et est payée par le portefeuille de l'opérateur.

## 12. Tokenomics

Le projet n'utilise aucun jeton numérique spécifique : aucune émission de cryptomonnaie, aucune vente de jetons, aucune promesse de rendement financier. Les ETH utilisés sur Sepolia sont uniquement des jetons de test sans valeur monétaire réelle.

## 13. Menaces, limites et perspectives d'amélioration

### 13.1. Limites techniques

**Fiabilité des capteurs (problème de l'oracle) :** un capteur compromis peut transmettre de fausses mesures, même correctement signées. La blockchain garantit l'intégrité des données enregistrées, pas leur exactitude physique.

**Simulation des capteurs :** les capteurs sont simulés en Python. Une mise en production nécessiterait des équipements physiques certifiés et des clés protégées par du matériel sécurisé.

**Confiance dans le collecteur :** la vérification des signatures des capteurs est faite hors chaîne, par le collecteur, et non par le contrat. Le type de produit transmis par le capteur n'est pas couvert par la signature ; seule la plage du lot, enregistrée sur la blockchain, fait foi.

**Gestion des rôles :** le prototype utilise un nombre limité de comptes. Une production réelle devrait séparer les responsabilités entre fabricants, transporteurs, collecteurs et pharmacies.

**Pas de suppression ni de clôture de lot :** un lot enregistré reste sur la blockchain. C'est un avantage pour la traçabilité, mais une fonction de clôture serait une évolution à prévoir dans un nouveau contrat.

**Stockage hors chaîne :** les mesures et les preuves sont conservées par le collecteur dans un fichier JSON. Le disque de l'offre gratuite de Render est temporaire : après un redémarrage, le collecteur retrouve le fichier du dépôt GitHub, et les paquets créés entre-temps sont perdus. L'état des lots (conforme ou rompu, racines ancrées) reste, lui, permanent sur la blockchain.

**Dépendance au collecteur :** la consultation détaillée des mesures dépend de la disponibilité du serveur qui fournit les preuves de Merkle.

**Réseau de test :** le système utilise Ethereum Sepolia et ne constitue pas encore une solution de production.

### 13.2. Perspectives d'amélioration

- Intégration de capteurs physiques certifiés.
- Stockage persistant (base de données) ou décentralisé (IPFS) pour les preuves.
- Rôles séparés (fabricant, transporteur, pharmacie) et signature multiple pour les opérations sensibles.
- Vérification des signatures des capteurs directement dans le contrat.
- Fonction de clôture d'un lot.
- Audit professionnel du contrat intelligent.
- Déploiement sur un réseau blockchain de production à faibles frais.
- Respect des réglementations pharmaceutiques applicables.

## 14. Données de démonstration

Toutes les données utilisées dans le prototype sont fictives et synthétiques.

### 14.1. Lots de démonstration

| Identifiant du lot | Scénario |
|---|---|
| `LOT-2026-001` | Lot conforme à la plage autorisée (2 à 8 °C). |
| `LOT-2026-002` | Lot présentant une rupture de la chaîne du froid. |
| `LOT-INSULINE-001` | Lot d'insuline (2 à 8 °C), illustrant le catalogue de médicaments. |
| `LOT-CONGELE-003` | Lot de vaccin congelé (-25 à -15 °C) dont la chaîne du froid est rompue. |

Le tableau détaillé des mesures et l'arbre de Merkle d'un lot ne s'affichent que si les paquets correspondants sont présents dans le collecteur (voir la limite sur le stockage temporaire de Render). L'état du lot, lui, est toujours lu sur la blockchain.

### 14.2. Adresses blockchain

**Adresse du contrat intelligent :**

`0x29AE4102f9a2F4394C54366770B92040D309ff90`

**Adresse du compte de déploiement Sepolia (administrateur et collecteur) :**

`0xdf7E70581c9aE16C34A6752C0af7528259c77d9B`

**Adresse du capteur simulé :**

`0x0572A79098B1FA9d417d5744f52E115A3760418f`

Aucune clé privée n'est publiée dans le dépôt.

## 15. Captures d'écran et illustrations

### DApp : lot conforme
![DApp : lot conforme](docs/dapp-conforme.png)

### DApp : lot avec rupture de la chaîne du froid
![DApp : lot avec rupture de la chaîne du froid](docs/dapp-rompu.png)

### Transactions sur Etherscan
![Transactions sur Etherscan](docs/etherscan-transactions.png)

### Contrat intelligent vérifié
![Contrat intelligent vérifié](docs/etherscan-contrat-verifie.png)

### Collecteur en ligne sur Render
![Collecteur en ligne sur Render](docs/render-live.png)

### Résultats des tests Hardhat
![Résultats des tests Hardhat](docs/tests-hardhat.png)

<!--
Captures supplémentaires : enregistrer les deux images dans le dossier docs/ avec ces noms exacts,
puis retirer la balise de commentaire ouvrante (au-dessus de ce texte) et la balise fermante
(sous les deux images ci-dessous), pour que les images s'affichent.

### Visualisation de l'arbre de Merkle
![Arbre de Merkle](docs/arbre-merkle.png)

### Espace opérateur : création d'un lot
![Espace opérateur](docs/espace-operateur.png)
-->

## 16. Licence

Ce projet est distribué sous licence MIT.

---

**Université de Kinshasa (UNIKIN)**  
**Faculté des Sciences et Technologies**  
**Département de Mathématiques, Statistiques et Informatique**

**Master 1 – Blockchain et cryptomonnaie**  
**Groupe 08 – Blockchain et Internet des objets**  
**Année académique : 2025-2026**

*Projet académique réalisé dans le cadre du cours de Blockchain et cryptomonnaie.*