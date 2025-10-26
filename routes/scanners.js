// routes/scanner.js
const express = require('express');
const router = express.Router();
const ScannerController = require('../controllers/scannerController');

// Créer une instance du contrôleur
const scannerController = new ScannerController();

/**
 * @swagger
 * tags:
 *   - name: Scanner
 *     description: Gestion des scanners connectés
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Scanner:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Identifiant unique du scanner
 *           example: "scanner_0"
 *         name:
 *           type: string
 *           description: Nom du scanner
 *           example: "fi-7140"
 *         driver:
 *           type: string
 *           description: Driver utilisé (WIA ou TWAIN)
 *           enum: ["wia", "twain"]
 *           example: "wia"
 *         status:
 *           type: string
 *           description: État du scanner
 *           example: "available"
 *         displayName:
 *           type: string
 *           description: Nom d'affichage du scanner
 *           example: "fi-7140"
 *     
 *     ScannerListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indique si la requête a réussi
 *           example: true
 *         scanners:
 *           type: array
 *           description: Liste des scanners détectés
 *           items:
 *             $ref: '#/components/schemas/Scanner'
 *         count:
 *           type: integer
 *           description: Nombre de scanners détectés
 *           example: 1
 *         driver:
 *           type: string
 *           description: Driver utilisé pour la détection
 *           enum: ["wia", "twain"]
 *           example: "wia"
 *         message:
 *           type: string
 *           description: Message optionnel (affiché quand aucun scanner n'est détecté)
 *           example: "Aucun scanner détecté"
 *     
 *     ScannerError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Message d'erreur
 *           example: "Erreur lors de la récupération des scanners"
 *         details:
 *           type: string
 *           description: Détails techniques de l'erreur
 *           example: "Command failed: NAPS2.Console.exe --driver wia --listdevices"
 */

/**
 * @swagger
 * /scanners:
 *   get:
 *     tags:
 *       - Scanner
 *     summary: Récupérer la liste des scanners connectés
 *     description: |
 *       Détecte et retourne la liste de tous les scanners connectés au système en utilisant NAPS2.
 *       
 *       **Fonctionnement:**
 *       - Utilise le driver WIA (Windows Image Acquisition) par défaut
 *       - Exécute la commande NAPS2.Console.exe pour lister les périphériques
 *       - Parse la sortie pour extraire les informations des scanners
 *       - Ignore les avertissements Qt non critiques
 *       
 *       **Codes de réponse:**
 *       - `200`: Succès (avec ou sans scanners détectés)
 *       - `500`: Erreur lors de l'exécution de NAPS2
 *     responses:
 *       200:
 *         description: Liste des scanners récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScannerListResponse'
 *             examples:
 *               withScanners:
 *                 summary: Scanners détectés
 *                 value:
 *                   success: true
 *                   scanners:
 *                     - id: "scanner_0"
 *                       name: "fi-7140"
 *                       driver: "wia"
 *                       status: "available"
 *                       displayName: "fi-7140"
 *                     - id: "scanner_1"
 *                       name: "HP ScanJet Pro 2500"
 *                       driver: "wia"
 *                       status: "available"
 *                       displayName: "HP ScanJet Pro 2500"
 *                   count: 2
 *                   driver: "wia"
 *               noScanners:
 *                 summary: Aucun scanner détecté
 *                 value:
 *                   success: true
 *                   scanners: []
 *                   count: 0
 *                   message: "Aucun scanner détecté"
 *                   driver: "wia"
 *       500:
 *         description: Erreur lors de la récupération des scanners
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScannerError'
 *             examples:
 *               naps2NotFound:
 *                 summary: NAPS2 non trouvé
 *                 value:
 *                   success: false
 *                   error: "Erreur lors de la récupération des scanners"
 *                   details: "Command failed: NAPS2.Console.exe not found"
 *               executionError:
 *                 summary: Erreur d'exécution
 *                 value:
 *                   success: false
 *                   error: "Erreur lors de la récupération des scanners"
 *                   details: "Failed to execute NAPS2 command"
 */
router.get('/', scannerController.getConnectedScanners);

module.exports = router;