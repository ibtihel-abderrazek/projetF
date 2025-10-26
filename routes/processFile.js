// routes/processFile.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const fileProcessor = require("../controllers/fileProcessor");

const upload = multer({ dest: "uploads/" });

/**
 * @swagger
 * tags:
 *   - name: PDF Operations
 *     description: Opérations OCR et conversion PDF
 *   - name: Patch Operations
 *     description: Génération et traitement de codes-barres Patch
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ProcessedFile:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "2025-10-09_Document_001.pdf"
 *         content:
 *           type: string
 *           format: base64
 *         pages:
 *           type: array
 *           items:
 *             type: integer
 *         barcode:
 *           type: string
 *           nullable: true
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         details:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         suggestions:
 *           type: array
 *           items:
 *             type: string
 */

// ==================== ROUTES SPÉCIFIQUES (SWAGGER) ====================

/**
 * @swagger
 * /api/upload/ocr:
 *   post:
 *     tags:
 *       - PDF Operations
 *     summary: Appliquer l'OCR sur un fichier (PDF ou Image)
 *     description: |
 *       OCRise un PDF ou une image avec détection automatique de langue.
 *       
 *       **Fonctionnalités:**
 *       - Détection automatique de langue (si non spécifiée)
 *       - Support PDF et images (JPG, PNG, TIFF)
 *       - Modes OCR: auto (recommandé), force, skip
 *       - Sortie: PDF standard ou PDF/A
 *       
 *       **Modes OCR:**
 *       - `auto`: Détecte si l'OCR est nécessaire
 *       - `force`: Force l'OCR même si du texte existe
 *       - `skip`: Pas d'OCR
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier PDF ou Image à OCRiser
 *               lang:
 *                 type: string
 *                 enum: ["", "fra", "eng", "ara"]
 *                 default: ""
 *                 description: Langue pour l'OCR (auto-détection si vide)
 *               modeOcr:
 *                 type: string
 *                 enum: ["auto", "force", "skip"]
 *                 default: "auto"
 *                 description: Mode d'application de l'OCR
 *               pdfMode:
 *                 type: string
 *                 enum: ["pdf", "pdfa"]
 *                 default: "pdfa"
 *                 description: Format de sortie
 *               dpi:
 *                 type: integer
 *                 default: 300
 *                 description: Résolution DPI pour l'OCR
 *               namingPattern:
 *                 type: string
 *                 example: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *                 description: Modèle de nommage du fichier
 *     responses:
 *       200:
 *         description: OCR appliqué avec succès
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur OCR
 */
router.post("/ocr", upload.single("file"), fileProcessor.processPdfOcr);

/**
 * @swagger
 * /api/upload/convert-pdfa:
 *   post:
 *     tags:
 *       - PDF Operations
 *     summary: Convertir un PDF en PDF/A (sans OCR)
 *     description: |
 *       Convertit un PDF existant en format PDF/A (norme ISO 19005) pour l'archivage longue durée.
 *       Cette opération ne fait PAS d'OCR, elle conserve le texte existant.
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               dpi:
 *                 type: integer
 *                 default: 300
 *               namingPattern:
 *                 type: string
 *                 example: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *     responses:
 *       200:
 *         description: Conversion réussie
 *       400:
 *         description: Fichier invalide
 *       500:
 *         description: Erreur de conversion
 */
router.post("/convert-pdfa", upload.single("file"), fileProcessor.convertToPdfA);

/**
 * @swagger
 * /api/upload/patch/split:
 *   post:
 *     tags:
 *       - Patch Operations
 *     summary: Séparer un PDF par codes-barres Patch
 *     description: |
 *       Détecte les codes-barres Patch dans un PDF et le sépare en plusieurs documents.
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               ocrMode:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 default: "true"
 *               lang:
 *                 type: string
 *                 enum: ["", "fra", "eng", "ara"]
 *               patchMode:
 *                 type: string
 *                 enum: ["T_classique", "T_with_bookmarks"]
 *                 default: "T_classique"
 *               naming:
 *                 type: string
 *                 enum: ["barcode_ocr_generic", "barcode", "ocr", "generic", "vide"]
 *                 default: "generic"
 *               namingPattern:
 *                 type: string
 *               modeOcr:
 *                 type: string
 *                 enum: ["auto", "force", "skip"]
 *                 default: "auto"
 *               pdfMode:
 *                 type: string
 *                 enum: ["pdf", "pdfa"]
 *                 default: "pdfa"
 *               dpi:
 *                 type: integer
 *                 default: 300
 *     responses:
 *       200:
 *         description: Séparation réussie
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur de traitement
 */
router.post("/patch/split", upload.single("file"), fileProcessor.splitByPatch);

/**
 * @swagger
 * /api/upload/patch/generate:
 *   post:
 *     tags:
 *       - Patch Operations
 *     summary: Générer un code-barres Patch
 *     description: Crée un code-barres Patch à partir de données textuelles
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patchData
 *             properties:
 *               patchData:
 *                 type: string
 *                 example: "INV-2025-001"
 *     responses:
 *       200:
 *         description: Patch généré
 *       400:
 *         description: Données manquantes
 *       500:
 *         description: Erreur de génération
 */
router.post("/patch/generate", fileProcessor.generatePatchOnly);

// ==================== ROUTE PRINCIPALE (COMPATIBLE AVEC TOUT) ====================

/**
 * @swagger
 * /api/upload:
 *   post:
 *     tags:
 *       - PDF Operations
 *     summary: Route principale - Traitement universel
 *     description: |
 *       Route principale qui gère tous les types de traitement selon les paramètres fournis.
 *       Cette route est utilisée par le frontend et supporte:
 *       - OCR seul
 *       - Conversion PDF/A seule
 *       - Séparation Patch
 *       - Scan
 *       - Combinaisons multiples
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               ocrMode:
 *                 type: string
 *               lang:
 *                 type: string
 *               modeOcr:
 *                 type: string
 *               pdfMode:
 *                 type: string
 *               pdfaOnly:
 *                 type: string
 *               dpi:
 *                 type: integer
 *               namingPattern:
 *                 type: string
 *               containsPatch:
 *                 type: string
 *               patchMode:
 *                 type: string
 *               naming:
 *                 type: string
 *               scan:
 *                 type: string
 *               profileName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Traitement réussi
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur de traitement
 */
router.post("/", upload.single("file"), fileProcessor.processFile);

module.exports = router;