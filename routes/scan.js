const express = require('express');
const path = require('path');
const router = express.Router();

// Import du contrôleur
const { processFile } = require('../controllers/fileProcessor');

/**
 * @swagger
 * tags:
 *   - name: Scan
 *     description: Opérations de numérisation et traitement Patch
 */
/**
 * @swagger
 * /api/scan/patch:
 *   post:
 *     tags:
 *       - Scan
 *     summary: Traiter un fichier numérisé avec Patch
 *     description: |
 *       Applique le traitement Patch à un fichier PDF déjà numérisé.
 *       
 *       **Fonctionnement:**
 *       - Prend en entrée le chemin d'un fichier PDF existant
 *       - Applique les traitements OCR si configuré
 *       - Sépare le document selon les codes-barres Patch détectés
 *       - Nomme les fichiers selon la stratégie définie
 *       - Peut créer des signets automatiques si `patchType` = "T_with_bookmarks"
 *       
 *       **Stratégies de nommage disponibles:**
 *       - `barcode_ocr_generic`: Essaie code-barres → OCR → nom générique
 *       - `barcode`: Utilise uniquement les codes-barres
 *       - `ocr`: Utilise uniquement l'OCR du texte
 *       - `generic`: Nommage générique (date/heure)
 *       - `vide`: Aucun nommage spécifique
 *       
 *       **Types de traitement:**
 *       - `T_classique`: Traitement standard
 *       - `T_with_bookmarks`: Traitement avec signets automatiques
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchRequest'
 *           examples:
 *             fullProcessing:
 *               summary: Traitement complet avec OCR
 *               value:
 *                 filePath: "C:/temp/scanned_document.pdf"
 *                 profileName: "Production_OCR"
 *                 patchType: "T_with_bookmarks"
 *                 patchNaming: "barcode_ocr_generic"
 *                 ocrMode: true
 *                 lang: "fra"
 *                 modeOcr: "auto"
 *             barcodeOnly:
 *               summary: Traitement par code-barres uniquement
 *               value:
 *                 filePath: "C:/temp/invoice_batch.pdf"
 *                 patchType: "T_classique"
 *                 patchNaming: "barcode"
 *                 ocrMode: false
 *             genericNaming:
 *               summary: Traitement avec nommage générique
 *               value:
 *                 filePath: "C:/temp/documents.pdf"
 *                 patchType: "T_classique"
 *                 patchNaming: "generic"
 *     responses:
 *       200:
 *         description: Traitement Patch terminé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PatchResponse'
 *             examples:
 *               successfulProcessing:
 *                 summary: Traitement réussi
 *                 value:
 *                   success: true
 *                   message: "Traitement Patch terminé avec succès"
 *                   outputFiles:
 *                     - filename: "2025-10-09_Invoice_001.pdf"
 *                       path: "C:/output/2025-10-09_Invoice_001.pdf"
 *                       size: 1048576
 *                     - filename: "2025-10-09_Invoice_002.pdf"
 *                       path: "C:/output/2025-10-09_Invoice_002.pdf"
 *                       size: 2097152
 *                     - filename: "2025-10-09_Report.pdf"
 *                       path: "C:/output/2025-10-09_Report.pdf"
 *                       size: 3145728
 *                   statistics:
 *                     totalPages: 45
 *                     filesCreated: 3
 *                     processingTime: "2.5s"
 *       400:
 *         description: Paramètres invalides ou fichier manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFilePath:
 *                 summary: Chemin de fichier manquant
 *                 value:
 *                   success: false
 *                   error: "filePath manquant"
 *               fileNotFound:
 *                 summary: Fichier introuvable
 *                 value:
 *                   success: false
 *                   error: "Le fichier spécifié n'existe pas"
 *       500:
 *         description: Erreur lors du traitement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               processingError:
 *                 summary: Erreur de traitement
 *                 value:
 *                   success: false
 *                   error: "Erreur lors du traitement Patch"
 *               ocrError:
 *                 summary: Erreur OCR
 *                 value:
 *                   success: false
 *                   error: "Échec de l'OCR du document"
 */
router.post('/patch', async (req, res) => {
  try {
    const { filePath, ...config } = req.body;

    if (!filePath) {
      // ✅ Assurez-vous de toujours renvoyer du JSON
      return res.status(400).json({ 
        success: false, 
        error: 'filePath manquant' 
      });
    }

    req.file = { path: filePath, originalname: path.basename(filePath) };
    req.body = { ...config, scan: "false" };

    return processFile(req, res);
  } catch (error) {
    console.error('Erreur scan/patch:', error);
    // ✅ Toujours renvoyer du JSON en cas d'erreur
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
/**
 * @swagger
 * components:
 *   schemas:
 *     ScanRequest:
 *       type: object
 *       required:
 *         - profileName
 *         - action
 *       properties:
 *         profileName:
 *           type: string
 *           description: Nom du profil de numérisation à utiliser
 *           example: "Production_OCR"
 *         action:
 *           type: string
 *           description: Action à effectuer (doit être "scan")
 *           enum: ["scan"]
 *           example: "scan"
 *     
 *     ScanResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indique si l'opération a réussi
 *           example: true
 *         message:
 *           type: string
 *           description: Message de confirmation
 *           example: "Scan démarré pour Production_OCR"
 *     
 *     PatchRequest:
 *       type: object
 *       required:
 *         - filePath
 *       properties:
 *         filePath:
 *           type: string
 *           description: Chemin complet du fichier PDF à traiter
 *           example: "C:/temp/scanned_document.pdf"
 *         profileName:
 *           type: string
 *           description: Nom du profil de configuration à utiliser
 *           example: "Production_OCR"
 *         patchType:
 *           type: string
 *           description: Type de traitement Patch
 *           enum: ["T_classique", "T_with_bookmarks"]
 *           example: "T_with_bookmarks"
 *         patchNaming:
 *           type: string
 *           description: Stratégie de nommage des fichiers Patch
 *           enum: ["barcode_ocr_generic", "barcode", "ocr", "generic", "vide"]
 *           example: "barcode_ocr_generic"
 *         ocrMode:
 *           type: boolean
 *           description: Activer/désactiver l'OCR
 *           example: true
 *         lang:
 *           type: string
 *           description: Langue pour l'OCR
 *           enum: ["", "fra", "eng", "ara"]
 *           example: "fra"
 *         modeOcr:
 *           type: string
 *           description: Mode d'application de l'OCR
 *           enum: ["auto", "force", "skip"]
 *           example: "auto"
 *     
 *     PatchResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indique si le traitement a réussi
 *           example: true
 *         message:
 *           type: string
 *           description: Message de confirmation
 *           example: "Traitement Patch terminé avec succès"
 *         outputFiles:
 *           type: array
 *           description: Liste des fichiers générés
 *           items:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 example: "2025-10-09_Invoice_001.pdf"
 *               path:
 *                 type: string
 *                 example: "C:/output/2025-10-09_Invoice_001.pdf"
 *               size:
 *                 type: integer
 *                 description: Taille du fichier en octets
 *                 example: 2048576
 *         statistics:
 *           type: object
 *           description: Statistiques du traitement
 *           properties:
 *             totalPages:
 *               type: integer
 *               example: 45
 *             filesCreated:
 *               type: integer
 *               example: 3
 *             processingTime:
 *               type: string
 *               example: "2.5s"
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Message d'erreur
 *           example: "Paramètres invalides"
 */

/**
 * @swagger
 * /api/scan:
 *   post:
 *     tags:
 *       - Scan
 *     summary: Démarrer une numérisation normale
 *     description: |
 *       Lance une opération de numérisation standard en utilisant un profil de configuration spécifié.
 *       
 *       **Fonctionnement:**
 *       - Valide les paramètres de la requête
 *       - Déclenche la numérisation avec le profil spécifié
 *       - Retourne immédiatement une confirmation (opération asynchrone)
 *       
 *       **Note:** Cette route effectue uniquement la numérisation sans traitement Patch.
 *       Pour un scan avec traitement Patch, utilisez la route `/api/scan/patch`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScanRequest'
 *           examples:
 *             standardScan:
 *               summary: Numérisation standard
 *               value:
 *                 profileName: "Production_OCR"
 *                 action: "scan"
 *             archiveScan:
 *               summary: Numérisation pour archivage
 *               value:
 *                 profileName: "Archive_Config"
 *                 action: "scan"
 *     responses:
 *       200:
 *         description: Numérisation démarrée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanResponse'
 *             example:
 *               success: true
 *               message: "Scan démarré pour Production_OCR"
 *       400:
 *         description: Paramètres invalides ou manquants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingProfileName:
 *                 summary: Nom de profil manquant
 *                 value:
 *                   success: false
 *                   error: "Paramètres invalides"
 *               invalidAction:
 *                 summary: Action invalide
 *                 value:
 *                   success: false
 *                   error: "Paramètres invalides"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Erreur lors du démarrage du scan"
 */
router.post('/', async (req, res) => {
    try {
        const { profileName, action } = req.body;
        if (!profileName || action !== 'scan') {
            return res.status(400).json({ success: false, error: 'Paramètres invalides' });
        }
        console.log(`📠 Scan déclenché pour le profil: ${profileName}`);
        // Retour simple (scan normal, pas encore patch)
        res.json({ success: true, message: `Scan démarré pour ${profileName}` });
    } catch (error) {
        console.error('Erreur scan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;