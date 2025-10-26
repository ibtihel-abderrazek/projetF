// services/fileService.js - Complete Implementation (FINAL CORRECTED)
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");

const pdfService = require("./pdfService");
const ocrPdfService = require("./ocrPdfService");
const ocrService = require("./ocrService");
const langDetect = require("./langDetect");
const pdfImageExtractor = require("./pdfImageExtractor");
const patchService = require("./patchService");
const scanService = require("./scanService");
const { applyNamingPattern, cleanUploadsFolder } = require("../utils/fileutils");

const tempFiles = [];

// --- Validation PDF ---
async function validatePDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 1000) throw new Error("Fichier PDF trop petit ou vide");
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith("%PDF")) throw new Error("Fichier PDF invalide");
    await PDFDocument.load(buffer, { ignoreEncryption: true, throwOnInvalidObject: false });
    return true;
  } catch (error) {
    throw new Error(`PDF invalide ou corrompu: ${error.message}`);
  }
}

// --- Process File - Main Route ---
async function processFile(req, res) {
  let filePath, fileName;
  const ocrMode = req.body.ocrMode !== "false";
  
  console.log("===== REQUÊTE REÇUE =====");
  console.log("Body :", req.body);
  console.log("Fichier :", req.file);
  console.log("==========================");
  
  try {
    let pdfBlocks = [];
    const outputDir = req.body.outputDir || path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // ------------- SCAN MODE -------------
   if (req.body.scan === "true") {
  if (!req.body.profileName) {
    return res.status(400).json({ 
      success: false,
      error: "Le paramètre 'profileName' est requis pour effectuer un scan" 
    });
  }

  try {
    console.log(`📠 Démarrage du scan avec le profil: ${req.body.profileName}`);
    const scanResult = await scanService.scanFile(req.body.profileName, outputDir);

    if (typeof scanResult === "string" && fs.existsSync(scanResult)) {
      const scannedFilePath = scanResult;
      const scannedExt = path.extname(scannedFilePath).toLowerCase();
      
      console.log(`✅ Fichier scanné: ${scannedFilePath}`);
      console.log(`📄 Extension détectée: ${scannedExt}`);

      // ✅ CORRECTION : Si scanOnly = true, retourner directement le fichier
      if (req.body.scanOnly === "true") {
        console.log("📤 Mode Scan Only - Retour direct du fichier");
        
        const fileBuffer = fs.readFileSync(scannedFilePath);
        const base64Content = fileBuffer.toString("base64");
        
        return res.json({
          success: true,
          status: "success",
          message: "Scan terminé avec succès",
          files: [{
            name: path.basename(scannedFilePath),
            content: base64Content,
            mimeType: scannedExt === ".pdf" ? "application/pdf" : "image/jpeg"
          }]
        });
      }

      // ✅ Si scanOnly n'est pas activé, continuer avec le traitement
      if (scannedExt === ".pdf") {
        // PDF scanné : utiliser directement sans conversion
        filePath = scannedFilePath;
        fileName = path.basename(filePath);
        
        try {
          await validatePDF(filePath);
          console.log(`✅ PDF scanné validé: ${fileName}`);
        } catch (validationError) {
          console.error("❌ PDF scanné invalide:", validationError);
          return res.status(500).json({
            success: false,
            error: "Le fichier scanné est corrompu ou invalide",
            details: validationError.message,
            suggestions: [
              "Essayez de rescanner le document",
              "Vérifiez les paramètres du scanner",
              "Vérifiez que NAPS2 fonctionne correctement"
            ]
          });
        }
        
      } else if ([".png", ".jpg", ".jpeg", ".tiff", ".tif"].includes(scannedExt)) {
        // Image scannée : convertir en PDF
        console.log("🖼️ Image scannée détectée, conversion en PDF...");
        
        try {
          const jpegPath = path.join(
            outputDir, 
            path.basename(scannedFilePath, scannedExt) + "_temp.jpg"
          );
          
          console.log(`📸 Conversion de l'image en JPEG: ${jpegPath}`);
          
          const imageInfo = await sharp(scannedFilePath)
            .jpeg({ 
              quality: 95,
              chromaSubsampling: '4:4:4'
            })
            .toFile(jpegPath);
          
          console.log(`✅ Image convertie: ${imageInfo.width}x${imageInfo.height}px`);
          
          const jpegBuffer = fs.readFileSync(jpegPath);
          const pdfDoc = await PDFDocument.create();
          
          const jpegImage = await pdfDoc.embedJpg(jpegBuffer);
          const page = pdfDoc.addPage([jpegImage.width, jpegImage.height]);
          
          page.drawImage(jpegImage, {
            x: 0,
            y: 0,
            width: jpegImage.width,
            height: jpegImage.height,
          });
          
          const pdfBytes = await pdfDoc.save();
          const pdfPath = path.join(
            outputDir, 
            path.basename(scannedFilePath, scannedExt) + ".pdf"
          );
          
          fs.writeFileSync(pdfPath, pdfBytes);
          console.log(`✅ PDF créé depuis l'image scannée: ${pdfPath}`);
          
          filePath = pdfPath;
          fileName = path.basename(pdfPath);
          
          // Nettoyer les fichiers temporaires
          try {
            if (fs.existsSync(jpegPath)) {
              fs.unlinkSync(jpegPath);
              console.log(`🗑️ Fichier JPEG temporaire supprimé`);
            }
          } catch (cleanupError) {
            console.warn("⚠️ Erreur nettoyage fichiers temporaires:", cleanupError.message);
          }
          
        } catch (conversionError) {
          console.error("❌ Erreur conversion image → PDF:", conversionError);
          return res.status(500).json({
            success: false,
            error: "Erreur lors de la conversion de l'image scannée en PDF",
            details: conversionError.message,
            suggestions: [
              "Vérifiez que Sharp est correctement installé",
              "Vérifiez que pdf-lib est installé",
              "Vérifiez l'espace disque disponible",
              "Essayez de rescanner le document"
            ]
          });
        }
        
      } else {
        console.error("❌ Format scanné non supporté:", scannedExt);
        return res.status(400).json({
          success: false,
          error: "Format de fichier scanné non supporté",
          receivedFormat: scannedExt,
          supportedFormats: [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif"]
        });
      }

    } else {
      console.error("❌ Structure de retour scan invalide:", scanResult);
      return res.status(500).json({ 
        success: false,
        error: "Erreur lors du scan - structure de retour invalide",
        suggestions: [
          "Vérifiez que NAPS2 est correctement configuré",
          "Vérifiez les logs de NAPS2",
          "Vérifiez que le profil de scan existe"
        ]
      });
    }
  } catch (scanError) {
    console.error("❌ Erreur scan:", scanError);
    return res.status(500).json({
      success: false,
      error: "Erreur lors du scan",
      details: scanError.message,
      suggestions: [
        "Vérifiez que le scanner est connecté et allumé",
        "Vérifiez que le profil existe dans la configuration",
        "Assurez-vous que NAPS2 est correctement installé",
        "Vérifiez les permissions d'écriture dans le dossier de sortie",
        "Redémarrez le scanner et réessayez"
      ]
    });
  }

} else if (req.file) {
  filePath = req.file.path;
  fileName = req.file.originalname;
  console.log(`📄 Fichier reçu: ${fileName}`);
} else {
  return res.status(400).json({ 
    success: false,
    error: "Aucun fichier reçu et mode scan non activé." 
  });
}

// ✅ À partir d'ici, la suite du traitement continue normalement
console.log(`📋 Fichier à traiter: ${fileName} (${filePath})`);
    const ext = path.extname(fileName).toLowerCase();

    // ------------- PDF MODE -------------
    if (ext === ".pdf") {
      try {
        await validatePDF(filePath);
        console.log("✅ PDF validé");
        
        const hasText = await pdfService.extractText(filePath);
        let lang = req.body.lang;

        // Language detection
        if (!lang || lang.length < 2) {
          console.log("🔍 Détection automatique de la langue...");
          
          if (hasText && hasText.trim().length > 0) {
            lang = langDetect.detectLang(hasText.trim().slice(0, 1000)) || "eng";
            console.log(`Langue détectée depuis texte: ${lang}`);
          } else {
            console.log("Pas de texte trouvé, extraction d'images pour détection...");
            let quickText = "";
            const pagesForLangDetection = 3;
            const totalPages = await pdfService.getPageCount(filePath);
            
            for (let i = 0; i < Math.min(pagesForLangDetection, totalPages); i++) {
              try {
                const imagePath = await pdfImageExtractor.extractPageAsImage(filePath, i + 1);
                tempFiles.push(imagePath);
                const pageText = await ocrService.ocrImage(imagePath);
                if (pageText) quickText += pageText + "\n";
              } catch (pageError) {
                console.warn(`⚠️ Erreur extraction page ${i + 1}:`, pageError.message);
              }
            }
            
            lang = langDetect.detectLang(quickText || "") || "eng";
            console.log(`Langue détectée depuis OCR: ${lang}`);
          }
        }

        const containsPatch = req.body.containsPatch === "true";
        const patchMode = req.body.patchMode || "T_classique";
        const naming = req.body.naming || "generic";
        const namingPattern = req.body.namingPattern;
        const pdfaOnly = req.body.pdfaOnly === "true";

        console.log("📋 Paramètres de traitement:", {
          containsPatch,
          patchMode,
          naming,
          namingPattern,
          ocrMode,
          pdfaOnly,
          lang
        });

        pdfBlocks = [filePath];

        // ------------- PATCH SPLIT MODE -------------
        if (containsPatch) {
          console.log("✂️ Mode Patch activé - Découpage du PDF...");
          
          const patchOptions = { 
            patchMode, 
            lang, 
            naming, 
            namingPattern, 
            ocrMode, 
            containsPatch: true 
          };
          
          try {
            pdfBlocks = await patchService.splitByPatch(filePath, patchOptions, outputDir);
            console.log(`✅ Découpage Patch terminé: ${pdfBlocks.length} blocs créés`);
            
            tempFiles.push(...pdfBlocks.map(f => (typeof f === "string" ? f : f.file)));
          } catch (patchError) {
            console.error("❌ Erreur patch:", patchError);
            return res.status(500).json({ 
              success: false,
              error: "Erreur lors de la division par patch", 
              details: patchError.message,
              suggestions: [
                "Vérifiez que le PDF contient des codes-barres Patch",
                "Vérifiez la qualité des codes-barres",
                "Essayez avec un DPI plus élevé"
              ]
            });
          }
        }

        // ------------- PDF/A ONLY MODE (No OCR, No Patch) -------------
        if (pdfaOnly && !ocrMode && !containsPatch) {
          console.log("📄 PDF/A seul détecté - Conversion sans OCR");
          
          try {
            const dpi = req.body.dpi ? parseInt(req.body.dpi, 10) : 300;
            
            console.log(`Conversion PDF/A: DPI=${dpi}, Pattern=${namingPattern}`);
            
            const pdfaPath = await ocrPdfService.convertToPdfA(filePath, outputDir, {
              dpi: dpi,
              namingPattern: namingPattern,
              fileCounter: 1,
              pdfMode: 'pdfa',
              modeOcr: 'skip'
            });
            
            console.log(`✅ PDF/A créé: ${pdfaPath}`);
            
            const fileBuffer = fs.readFileSync(pdfaPath);
            const base64Content = fileBuffer.toString("base64");
            
            cleanUploadsFolder();
            
            // ✅ Retour JSON cohérent
            return res.json({
              success: true,
              status: "success",
              message: "Conversion PDF/A terminée",
              files: [{
                name: path.basename(pdfaPath),
                content: base64Content,
                mimeType: "application/pdf"
              }]
            });
            
          } catch (pdfaError) {
            console.error("❌ Erreur conversion PDF/A:", pdfaError);
            return res.status(500).json({ 
              success: false,
              error: "Erreur lors de la conversion en PDF/A", 
              details: pdfaError.message 
            });
          }
        }

        // ------------- NO OCR MODE - PATCH SPLIT ONLY OR SINGLE FILE -------------
        if (!ocrMode) {
          console.log("📄 Mode sans OCR");
          
          if (containsPatch) {
            // Multiple files from patch split
            const filesInfo = pdfBlocks.map((f, index) => {
              const fPath = typeof f === "string" ? f : f.file;
              const finalName = f.name || path.basename(fPath);
              
              const fileBuffer = fs.readFileSync(fPath);
              const base64Content = fileBuffer.toString("base64");
              
              console.log(`📄 Fichier ${index + 1}: ${finalName}`);
              
              return {
                name: finalName,
                content: base64Content,
                mimeType: "application/pdf",
                pages: f.pages || [],
                barcode: f.barcode || null
              };
            });
            
            console.log(`✅ Résultats patch (sans OCR): ${filesInfo.length} fichiers`);
            
            return res.json({ 
              success: true,
              status: "success", 
              message: "PDF découpés par blocs (mode patch sans OCR)", 
              files: filesInfo 
            });
            
          } else {
            // Single file
            const fileBuffer = fs.readFileSync(pdfBlocks[0]);
            const base64Content = fileBuffer.toString("base64");
            
            console.log("✅ Fichier unique retourné");
            
            return res.json({
              success: true,
              status: "success",
              message: "Traitement terminé",
              files: [{
                name: path.basename(pdfBlocks[0]),
                content: base64Content,
                mimeType: "application/pdf"
              }]
            });
          }
        }

        // ------------- OCR MODE (with or without patch) -------------
        else {
          console.log("🔤 Mode OCR activé");
          
          const filesInfo = [];
          
          for (const [blockIndex, pdfBlock] of pdfBlocks.entries()) {
            const blockPath = typeof pdfBlock === "string" ? pdfBlock : pdfBlock.file;
            
            if (!blockPath || !fs.existsSync(blockPath)) {
              console.warn(`⚠️ Bloc ${blockIndex + 1} invalide ou introuvable`);
              continue;
            }
            
            try {
              const modeOcr = req.body.modeOcr || 'auto';
              const pdfMode = req.body.pdfMode || req.body.mode || "pdfa";
              const dpi = req.body.dpi ? parseInt(req.body.dpi, 10) : 150;
              
              console.log(`🔤 Traitement OCR bloc ${blockIndex + 1}:`, {
                modeOcr,
                pdfMode,
                dpi,
                lang,
                namingPattern
              });
              
              let ocrPath = await ocrPdfService.ocrPdfFile(blockPath, lang, outputDir, {
                modeOcr: modeOcr,
                pdfMode: pdfMode,
                dpi: dpi,
                namingPattern: namingPattern,
                fileCounter: blockIndex + 1
              });

              console.log(`✅ Fichier OCR créé: ${ocrPath}`);

              const fileBuffer = fs.readFileSync(ocrPath);
              const base64Content = fileBuffer.toString("base64");
              
              const finalName = path.basename(ocrPath);

              filesInfo.push({
                name: finalName,
                content: base64Content,
                mimeType: "application/pdf",
                pages: typeof pdfBlock === "object" ? pdfBlock.pages || [] : [],
                barcode: typeof pdfBlock === "object" ? pdfBlock.barcode || null : null
              });

              tempFiles.push(ocrPath);
              
            } catch (ocrError) {
              console.error(`❌ Erreur OCR bloc ${blockIndex + 1}:`, ocrError);
              return res.status(500).json({ 
                success: false,
                error: `Erreur OCR bloc ${blockIndex + 1}`, 
                details: ocrError.message,
                suggestions: [
                  "Vérifiez que Tesseract OCR est installé",
                  "Vérifiez que Ghostscript est installé",
                  "Essayez avec un DPI différent"
                ]
              });
            }
          }

          // Cleanup temporary files
          tempFiles.forEach(f => {
            const fPath = typeof f === "string" ? f : f.path;
            try {
              if (fs.existsSync(fPath) && !filesInfo.find(info => info.name === path.basename(fPath))) {
                fs.unlinkSync(fPath);
              }
            } catch (cleanupError) {
              console.warn("⚠️ Erreur nettoyage:", cleanupError.message);
            }
          });

          // Return results
          console.log(`✅ Résultats ${containsPatch ? 'patch+OCR' : 'OCR'}: ${filesInfo.length} fichiers`);
          
          return res.json({
            success: true,
            status: "success",
            message: `${containsPatch ? "PDF découpés par blocs et " : ""}OCRisés avec succès`,
            files: filesInfo
          });
        }

      } catch (pdfProcessError) {
        console.error("❌ Erreur traitement PDF:", pdfProcessError);
        return res.status(500).json({
          success: false,
          error: "Erreur lors du traitement du PDF",
          details: pdfProcessError.message,
          suggestions: [
            "Vérifiez que le fichier PDF n'est pas corrompu",
            "Essayez avec un fichier PDF plus simple",
            "Vérifiez l'espace disque disponible",
            "Redémarrez l'application si le problème persiste"
          ]
        });
      }

    // ------------- IMAGE MODE (.jpg, .jpeg, .png, .tiff, .tif) -------------
    } else if ([".jpg", ".jpeg", ".png", ".tiff", ".tif"].includes(ext)) {
      console.log("🖼️ Mode Image détecté");
      
      try {
        let lang = req.body.lang;
        
        if (!lang) {
          console.log("🔍 Détection de langue depuis image...");
          const ocrText = await ocrService.ocrImage(filePath);
          lang = langDetect.detectLang(ocrText || "") || "eng";
          console.log(`Langue détectée: ${lang}`);
        }

        const cleanImagePath = path.join(outputDir, `clean_${fileName}`);
        await sharp(filePath).removeAlpha().toFile(cleanImagePath);
        console.log(`✅ Image nettoyée: ${cleanImagePath}`);

        const modeOcr = req.body.modeOcr || 'auto';
        const pdfMode = req.body.pdfMode || req.body.mode || 'pdfa';
        const dpi = req.body.dpi ? parseInt(req.body.dpi, 10) : 150;
        const namingPattern = req.body.namingPattern;
        
        console.log(`Image vers PDF - ModeOcr: ${modeOcr}, PdfMode: ${pdfMode}, DPI: ${dpi}`);

        let finalPdf = await ocrPdfService.imageToPdf(cleanImagePath, lang, outputDir, {
          modeOcr: modeOcr,
          pdfMode: pdfMode,
          dpi: dpi,
          namingPattern: namingPattern,
          fileCounter: 1
        });

        console.log(`✅ PDF créé depuis image: ${finalPdf}`);

        const fileBuffer = fs.readFileSync(finalPdf);
        const base64Content = fileBuffer.toString("base64");

        cleanUploadsFolder();
        
        return res.json({
          success: true,
          status: "success",
          message: "Image convertie en PDF avec OCR",
          files: [{
            name: path.basename(finalPdf),
            content: base64Content,
            mimeType: "application/pdf"
          }]
        });

      } catch (imageError) {
        console.error("❌ Erreur traitement image:", imageError);
        return res.status(500).json({ 
          success: false,
          error: "Erreur lors du traitement de l'image", 
          details: imageError.message,
          suggestions: [
            "Vérifiez que l'image n'est pas corrompue",
            "Essayez avec un format d'image différent",
            "Vérifiez que Sharp est correctement installé"
          ]
        });
      }

    // ------------- UNSUPPORTED FORMAT -------------
    } else {
      console.error(`❌ Format non supporté: ${ext}`);
      return res.status(400).json({ 
        success: false,
        error: "Type de fichier non supporté", 
        receivedFormat: ext,
        supportedFormats: [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"] 
      });
    }

  } catch (err) {
    console.error("❌ Erreur globale:", err);
    
    // Cleanup temporary files
    tempFiles.forEach(f => {
      const fPath = typeof f === "string" ? f : f.path;
      try { 
        if (fs.existsSync(fPath)) {
          fs.unlinkSync(fPath);
          console.log(`🗑️ Fichier temporaire supprimé: ${fPath}`);
        }
      } catch (cleanupError) {
        console.warn("⚠️ Erreur nettoyage:", cleanupError.message);
      }
    });

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: "Erreur lors du traitement du fichier",
        details: err.message,
        timestamp: new Date().toISOString(),
        suggestions: [
          "Vérifiez que tous les services requis sont démarrés",
          "Vérifiez l'espace disque disponible",
          "Essayez avec un fichier plus petit",
          "Contactez l'administrateur si le problème persiste"
        ]
      });
    }
  }
}

// --- Generate Patch Only ---
async function generatePatchOnly(req, res) {
  try {
    const { patchData } = req.body;
    
    if (!patchData) {
      return res.status(400).json({ 
        success: false,
        error: "Le paramètre 'patchData' est requis pour générer un patch",
        example: { patchData: "INV-2025-001" }
      });
    }

    if (typeof patchData !== 'string' || patchData.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "Le paramètre 'patchData' doit être une chaîne non vide"
      });
    }

    console.log("🏷️ Génération de patch:", patchData);

    const templatePath = path.join(__dirname, "..", "patchT", "patchT_template.png");
    
    if (!fs.existsSync(templatePath)) {
      console.error("❌ Template de patch non trouvé:", templatePath);
      return res.status(500).json({ 
        success: false,
        error: "Template de patch non trouvé", 
        path: templatePath 
      });
    }

    const result = await patchService.generatePatchFromData(patchData, templatePath);
    
    console.log("✅ Patch généré:", result.name);
    
    return res.json({ 
      success: true,
      status: "success", 
      message: "Patch généré avec succès", 
      results: [result] 
    });

  } catch (err) {
    console.error("❌ Erreur génération patch:", err);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
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
}

module.exports = { 
  processFile, 
  generatePatchOnly, 
  validatePDF 
};