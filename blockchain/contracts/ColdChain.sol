// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ColdChain - Traçabilité de la chaîne du froid (médicaments et vaccins)
/// @notice Les mesures restent hors chaîne ; seules les racines de Merkle sont ancrées.
/// @dev Températures en dixièmes de degré Celsius (ex: 25 = 2,5 °C). Aucune donnée personnelle.
contract ColdChain is AccessControl, ReentrancyGuard {
    bytes32 public constant COLLECTOR_ROLE = keccak256("COLLECTOR_ROLE");

    struct Lot {
        bool exists;
        bool compromised;
        uint64 createdAt;
        int16 minTemp;
        int16 maxTemp;
        bytes32 productHash; // hash des infos produit (jamais de texte en clair)
        uint32 anchorCount;
    }

    struct Anchor {
        bytes32 root;
        uint32 measureCount;
        uint64 timestamp;
    }

    mapping(bytes32 => Lot) private _lots;
    mapping(bytes32 => Anchor[]) private _anchors;

    event LotRegistered(bytes32 indexed lotId, bytes32 productHash, int16 minTemp, int16 maxTemp);
    event RootAnchored(bytes32 indexed lotId, uint256 indexed index, bytes32 root, uint32 measureCount);
    event BreachFlagged(bytes32 indexed lotId, int16 temperature, bytes32 evidenceHash);

    error InvalidInput();
    error LotAlreadyExists();
    error LotNotFound();
    error InvalidTemperatureRange();
    error AnchorNotFound();
    error TemperatureInRange();
    error AlreadyCompromised();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COLLECTOR_ROLE, msg.sender);
    }

    /// @notice Enregistre un nouveau lot avec sa plage de température autorisée.
    function registerLot(
        bytes32 lotId,
        bytes32 productHash,
        int16 minTemp,
        int16 maxTemp
    ) external onlyRole(COLLECTOR_ROLE) nonReentrant {
        if (lotId == bytes32(0) || productHash == bytes32(0)) revert InvalidInput();
        if (_lots[lotId].exists) revert LotAlreadyExists();
        if (minTemp >= maxTemp) revert InvalidTemperatureRange();

        _lots[lotId] = Lot({
            exists: true,
            compromised: false,
            createdAt: uint64(block.timestamp),
            minTemp: minTemp,
            maxTemp: maxTemp,
            productHash: productHash,
            anchorCount: 0
        });

        emit LotRegistered(lotId, productHash, minTemp, maxTemp);
    }

    /// @notice Ancre la racine de Merkle d'un lot de mesures signées.
    function anchorRoot(
        bytes32 lotId,
        bytes32 root,
        uint32 measureCount
    ) external onlyRole(COLLECTOR_ROLE) nonReentrant {
        Lot storage lot = _lots[lotId];
        if (!lot.exists) revert LotNotFound();
        if (root == bytes32(0) || measureCount == 0) revert InvalidInput();

        _anchors[lotId].push(
            Anchor({root: root, measureCount: measureCount, timestamp: uint64(block.timestamp)})
        );
        lot.anchorCount += 1;

        emit RootAnchored(lotId, _anchors[lotId].length - 1, root, measureCount);
    }

    /// @notice Marque un lot dont la chaîne du froid est rompue.
    function flagBreach(
        bytes32 lotId,
        int16 temperature,
        bytes32 evidenceHash
    ) external onlyRole(COLLECTOR_ROLE) nonReentrant {
        Lot storage lot = _lots[lotId];
        if (!lot.exists) revert LotNotFound();
        if (lot.compromised) revert AlreadyCompromised();
        if (evidenceHash == bytes32(0)) revert InvalidInput();
        if (temperature >= lot.minTemp && temperature <= lot.maxTemp) revert TemperatureInRange();

        lot.compromised = true;
        emit BreachFlagged(lotId, temperature, evidenceHash);
    }

    /// @notice Vérifie qu'une mesure (feuille) appartient à une racine ancrée.
    function verifyMeasurement(
        bytes32 lotId,
        uint256 anchorIndex,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        if (!_lots[lotId].exists) revert LotNotFound();
        if (anchorIndex >= _anchors[lotId].length) revert AnchorNotFound();
        return MerkleProof.verify(proof, _anchors[lotId][anchorIndex].root, leaf);
    }

    function getLot(bytes32 lotId) external view returns (Lot memory) {
        if (!_lots[lotId].exists) revert LotNotFound();
        return _lots[lotId];
    }

    function getAnchor(bytes32 lotId, uint256 index) external view returns (Anchor memory) {
        if (index >= _anchors[lotId].length) revert AnchorNotFound();
        return _anchors[lotId][index];
    }
}