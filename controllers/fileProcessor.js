// controllers/fileController.js - Correction complète

const fileService = require('../services/fileService');

// ==================== ROUTE PRINCIPALE (UTILISÉE PAR LE FRONTEND) ====================

/**
 * Route générique qui gère TOUS les types de traitement
 * ✅ Support du mode scan+patch en une seule requête
 */
exports.processFile = async (req, res) => {
    try {

        // Validation pour le mode scan
        if (req.body.scan === "true") {
            if (!req.body.profileName) {
                return res.status(400).json({ 
                    success: false,
                    error: "Le paramètre 'profileName' est requis pour effectuer un scan" 
                });
            }
        } else if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: "Aucun fichier reçu et mode scan non activé." 
            });
        }

        // ✅ Déléguer au service principal
        await fileService.processFile(req, res);
        
    } catch (err) {
        console.error("❌ Erreur processFile (controller):", err);
        
        // ✅ Toujours retourner du JSON en cas d'erreur
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: "Erreur lors du traitement du fichier", 
                details: err.message,
                suggestions: [
                    "Vérifiez que tous les services requis sont démarrés",
                    "Vérifiez l'espace disque disponible",
                    "Contactez l'administrateur si le problème persiste"
                ]
            });
        }
    }
};

// ==================== ROUTES SPÉCIFIQUES (POUR SWAGGER/API DIRECTE) ====================

/**
 * OCR uniquement - wrapper vers la route principale
 */
exports.processPdfOcr = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: "Aucun fichier reçu",
                suggestion: "Envoyez un fichier PDF ou image avec la clé 'file'"
            });
        }

        // Force le mode OCR et délègue à processFile
        req.body.ocrMode = "true";
        req.body.pdfaOnly = "false";
        req.body.containsPatch = "false";
        req.body.modeOcr = req.body.modeOcr || "auto";
        req.body.pdfMode = req.body.pdfMode || "pdfa";
        req.body.dpi = req.body.dpi || "300";
        
        console.log("📝 OCR via route spécifique:", {
            file: req.file.originalname,
            lang: req.body.lang || "auto"
        });
        
        await fileService.processFile(req, res);
        
    } catch (err) {
        console.error("❌ Erreur processPdfOcr:", err);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: "Erreur lors de l'OCR du fichier", 
                details: err.message,
                suggestions: [
                    "Vérifiez que le fichier n'est pas corrompu",
                    "Vérifiez que Tesseract OCR est installé",
                    "Essayez avec un DPI plus faible (150)"
                ]
            });
        }
    }
};

/**
 * Conversion PDF/A uniquement - wrapper vers la route principale
 */
exports.convertToPdfA = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: "Aucun fichier reçu",
                suggestion: "Envoyez un fichier PDF avec la clé 'file'"
            });
        }

        const path = require('path');
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        if (ext !== ".pdf") {
            return res.status(400).json({ 
                success: false,
                error: "Seuls les fichiers PDF sont supportés pour la conversion PDF/A",
                receivedFormat: ext
            });
        }

        // Force la conversion PDF/A seule
        req.body.ocrMode = "false";
        req.body.pdfaOnly = "true";
        req.body.containsPatch = "false";
        req.body.pdfMode = "pdfa";
        req.body.dpi = req.body.dpi || "300";
        
        console.log("🔄 PDF/A via route spécifique:", {
            file: req.file.originalname,
            dpi: req.body.dpi
        });
        
        await fileService.processFile(req, res);
        
    } catch (err) {
        console.error("❌ Erreur convertToPdfA:", err);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: "Erreur lors de la conversion PDF/A", 
                details: err.message,
                suggestions: [
                    "Vérifiez que Ghostscript est installé",
                    "Vérifiez que le PDF source n'est pas corrompu",
                    "Essayez avec un PDF plus simple"
                ]
            });
        }
    }
};

/**
 * Séparation Patch - wrapper vers la route principale
 */
exports.splitByPatch = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: "Aucun fichier reçu",
                suggestion: "Envoyez un fichier PDF avec la clé 'file'"
            });
        }

        const path = require('path');
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        if (ext !== ".pdf") {
            return res.status(400).json({ 
                success: false,
                error: "Seuls les fichiers PDF sont supportés pour la séparation Patch",
                receivedFormat: ext
            });
        }

        // Force le mode Patch
        req.body.containsPatch = "true";
        req.body.patchMode = req.body.patchMode || "T_classique";
        req.body.naming = req.body.naming || "generic";
        req.body.ocrMode = req.body.ocrMode || "true";
        req.body.modeOcr = req.body.modeOcr || "auto";
        req.body.pdfMode = req.body.pdfMode || "pdfa";
        req.body.dpi = req.body.dpi || "300";
        
        console.log("✂️ Patch via route spécifique:", {
            file: req.file.originalname,
            patchMode: req.body.patchMode,
            naming: req.body.naming
        });
        
        await fileService.processFile(req, res);
        
    } catch (err) {
        console.error("❌ Erreur splitByPatch:", err);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: "Erreur lors de la séparation par Patch", 
                details: err.message,
                suggestions: [
                    "Vérifiez que le PDF contient des codes-barres Patch",
                    "Vérifiez la qualité des codes-barres (impression nette)",
                    "Essayez avec un DPI plus élevé (300-600)",
                    "Vérifiez que les bibliothèques de détection sont installées"
                ]
            });
        }
    }
};

/**
 * Génération Patch - utilise le service dédié
 */
exports.generatePatchOnly = async (req, res) => {
    try {
        if (!req.body.patchData) {
            return res.status(400).json({ 
                success: false,
                error: "Le paramètre 'patchData' est requis",
                example: { patchData: "INV-2025-001" }
            });
        }

        if (typeof req.body.patchData !== 'string' || req.body.patchData.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                error: "Le paramètre 'patchData' doit être une chaîne non vide"
            });
        }

        console.log("🏷️ Génération Patch:", req.body.patchData);

        await fileService.generatePatchOnly(req, res);
        
    } catch (err) {
        console.error("❌ Erreur génération patch:", err);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: "Erreur lors de la génération du patch", 
                details: err.message,
                suggestions: [
                    "Vérifiez que le template de patch existe",
                    "Vérifiez que les données sont valides",
                    "Vérifiez les permissions d'écriture"
                ]
            });
        }
    }
};