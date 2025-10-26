const express = require('express');
const router = express.Router();
const OcrConfigController = require('../controllers/ocrConfigController');
const ocrController = new OcrConfigController();
const { isValidPatchStrategy, strategies } = require('../utils/patchStrategies');

/**
 * @swagger
 * tags:
 *   - name: OCR Configuration
 *     description: Gestion des configurations OCR
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OcrConfig:
 *       type: object
 *       required:
 *         - profileName
 *       properties:
 *         profileName:
 *           type: string
 *           description: Nom du profil de configuration
 *           example: "Production_OCR"
 *         ocrMode:
 *           type: boolean
 *           description: Active/désactive le mode OCR
 *           default: false
 *           example: true
 *         lang:
 *           type: string
 *           description: Code de langue pour l'OCR
 *           enum: ["", "fra", "eng", "ara"]
 *           default: "fra"
 *           example: "fra"
 *         namingPattern:
 *           type: string
 *           description: Modèle de nommage des fichiers
 *           default: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *           example: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *         pdfMode:
 *           type: string
 *           description: Mode de génération PDF
 *           enum: ["pdf", "pdfa"]
 *           default: "pdfa"
 *           example: "pdfa"
 *         modeOcr:
 *           type: string
 *           description: Mode d'application de l'OCR
 *           enum: ["auto", "force", "skip"]
 *           default: "auto"
 *           example: "auto"
 *         pdfaOnly:
 *           type: boolean
 *           description: Limiter au format PDF/A uniquement
 *           default: false
 *           example: false
 *         patchType:
 *           type: string
 *           description: Type de traitement Patch
 *           enum: ["T_classique", "T_with_bookmarks"]
 *           default: "T_classique"
 *           example: "T_classique"
 *         patchNaming:
 *           type: string
 *           description: Stratégie de nommage Patch
 *           enum: ["barcode_ocr_generic", "barcode", "ocr", "generic", "vide"]
 *           default: "barcode_ocr_generic"
 *           example: "barcode_ocr_generic"
 *         patchEnabled:
 *           type: boolean
 *           description: Active/désactive le patch
 *           default: false
 *           example: false
 *     
 *     OcrConfigResponse:
 *       type: object
 *       properties:
 *         profileName:
 *           type: string
 *           example: "Production_OCR"
 *         ocrMode:
 *           type: boolean
 *           example: true
 *         lang:
 *           type: string
 *           example: "fra"
 *         namingPattern:
 *           type: string
 *           example: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *         pdfMode:
 *           type: string
 *           example: "pdfa"
 *         modeOcr:
 *           type: string
 *           example: "auto"
 *         pdfaOnly:
 *           type: boolean
 *           example: false
 *         patchType:
 *           type: string
 *           example: "T_classique"
 *         patchNaming:
 *           type: string
 *           example: "barcode_ocr_generic"
 *         patchEnabled:
 *           type: boolean
 *           example: false
 *         lastModified:
 *           type: string
 *           format: date-time
 *           example: "2025-10-09T14:30:00.000Z"
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Message d'erreur
 *           example: "Erreur serveur"
 *         details:
 *           type: string
 *           description: Détails techniques de l'erreur
 *           example: "Message d'erreur détaillé"
 *     
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Configuration OCR sauvegardée avec succès"
 *         filePath:
 *           type: string
 *           example: "OcrProfiles/Production_OCR.xml"
 *         modeOcr:
 *           type: string
 *           example: "auto"
 *         patchType:
 *           type: string
 *           example: "T_classique"
 *         patchNaming:
 *           type: string
 *           example: "barcode_ocr_generic"
 *         patchEnabled:
 *           type: boolean
 *           example: false
 */

// Routes spécifiques Patch et utilitaires
router.get('/patch/strategies', async (req, res) => {
    try {
        res.json({ success: true, strategies, count: strategies.length });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

router.post('/validate', async (req, res) => {
    try {
        const config = req.body;
        const errors = [];
        const warnings = [];
        if (!config) return res.status(400).json({ error: 'Configuration manquante' });

        if (config.lang && !['', 'fra', 'eng', 'ara'].includes(config.lang)) warnings.push(`Langue OCR "${config.lang}" non standard`);
        if (config.pdfMode && !['pdf','pdfa'].includes(config.pdfMode)) errors.push(`Mode PDF "${config.pdfMode}" invalide`);
        if (config.patchNaming && !isValidPatchStrategy(config.patchNaming)) errors.push(`Stratégie Patch "${config.patchNaming}" invalide`);
        if (config.patchMode === true && !config.patchNaming) warnings.push('Mode Patch activé mais aucune stratégie de nommage définie');
        if (config.ocrMode === false && config.patchMode === true) warnings.push('Mode Patch activé sans OCR peut limiter les options de nommage');

        res.json({ isValid: errors.length === 0, errors, warnings, validatedConfig: config });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

// Routes OCR CRUD

/**
 * @swagger
 * /profile/ocr:
 *   post:
 *     tags:
 *       - OCR Configuration
 *     summary: Créer ou mettre à jour une configuration OCR
 *     description: Enregistre une nouvelle configuration OCR ou met à jour une configuration existante pour un profil donné
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OcrConfig'
 *           examples:
 *             completeConfig:
 *               summary: Configuration complète
 *               value:
 *                 profileName: "Production_OCR"
 *                 ocrMode: true
 *                 lang: "fra"
 *                 namingPattern: "$(DD)-$(MM)-$(YYYY)-$(n)"
 *                 pdfMode: "pdfa"
 *                 modeOcr: "auto"
 *                 pdfaOnly: false
 *                 patchType: "T_with_bookmarks"
 *                 patchNaming: "barcode_ocr_generic"
 *                 patchEnabled: true
 *             minimalConfig:
 *               summary: Configuration minimale
 *               value:
 *                 profileName: "Simple_Profile"
 *                 ocrMode: true
 *     responses:
 *       200:
 *         description: Configuration sauvegardée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Requête invalide (nom de profil manquant ou valeurs invalides)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingProfileName:
 *                 summary: Nom de profil manquant
 *                 value:
 *                   error: "Le nom du profil est obligatoire"
 *               invalidPatchType:
 *                 summary: Type de patch invalide
 *                 value:
 *                   error: "Mode de traitement Patch invalide. Valeurs autorisées: T_classique, T_with_bookmarks"
 *               invalidPatchNaming:
 *                 summary: Stratégie de nommage invalide
 *                 value:
 *                   error: "Stratégie de nommage Patch invalide. Valeurs autorisées: barcode_ocr_generic, barcode, ocr, generic, aucun"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', ocrController.saveOcrConfig.bind(ocrController));

/**
 * @swagger
 * /profile/ocr:
 *   get:
 *     tags:
 *       - OCR Configuration
 *     summary: Récupérer tous les profils OCR
 *     description: Liste tous les noms de profils de configuration OCR disponibles dans le système
 *     responses:
 *       200:
 *         description: Liste des profils récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 profiles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Production_OCR", "Test_Profile", "Archive_Config"]
 *                 count:
 *                   type: integer
 *                   example: 3
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', ocrController.getAllOcrConfigs.bind(ocrController));

/**
 * @swagger
 * /profile/ocr/{profileName}:
 *   get:
 *     tags:
 *       - OCR Configuration
 *     summary: Récupérer une configuration OCR spécifique
 *     description: Charge la configuration OCR complète pour un profil donné. La migration automatique des anciennes configurations est effectuée si nécessaire.
 *     parameters:
 *       - name: profileName
 *         in: path
 *         required: true
 *         description: Nom du profil de configuration à récupérer
 *         schema:
 *           type: string
 *         example: "Production_OCR"
 *     responses:
 *       200:
 *         description: Configuration récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OcrConfigResponse'
 *       400:
 *         description: Nom de profil manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Le nom du profil est obligatoire"
 *       404:
 *         description: Configuration non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Configuration OCR non trouvée pour ce profil"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:profileName', ocrController.getOcrConfig.bind(ocrController));

/**
 * @swagger
 * /profile/ocr/{profileName}:
 *   delete:
 *     tags:
 *       - OCR Configuration
 *     summary: Supprimer une configuration OCR
 *     description: Supprime définitivement la configuration OCR pour un profil donné. Cette action est irréversible.
 *     parameters:
 *       - name: profileName
 *         in: path
 *         required: true
 *         description: Nom du profil de configuration à supprimer
 *         schema:
 *           type: string
 *         example: "Old_Profile"
 *     responses:
 *       200:
 *         description: Configuration supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Configuration OCR supprimée avec succès"
 *       400:
 *         description: Nom de profil manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Le nom du profil est obligatoire"
 *       404:
 *         description: Configuration non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Configuration OCR non trouvée pour ce profil"
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:profileName', ocrController.deleteOcrConfig.bind(ocrController));

module.exports = router;