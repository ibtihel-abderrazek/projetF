const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const ocrmypdfExe = path.join(__dirname, "..", "bin", "ocrmypdf_runner.exe"); 
const tesseractDir = path.resolve("bin/tesseract");
const ghostscriptDir = path.resolve("bin/ghostscript/gs10.05.1/bin");
const popplerDir = path.resolve("bin/poppler/library/bin");

// ---------------- Extraction texte PDF ----------------
exports.extractText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    console.error("❌ Erreur lecture PDF :", err);
    return "";
  }
};

// ---------------- OCR PDF ----------------
// Modifier la fonction ocrPdfFile pour supporter le mode PDF/A seul
exports.ocrPdfFile = async (inputPath, lang = "eng", outputDir, options = {}) => {
  return new Promise((resolve, reject) => {
    const absoluteInputPath = path.resolve(inputPath);
    if (!outputDir) outputDir = path.dirname(inputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    // Utiliser le naming pattern s'il est fourni
    let outputFileName;
    if (options.namingPattern) {
      outputFileName = applyNamingPattern(options.namingPattern, options.fileCounter || 1);
      console.log(`📝 Naming pattern appliqué: ${outputFileName}`);
    } else {
      console.log('⚠️ Aucun naming pattern fourni, utilisation du nom par défaut');
      outputFileName = path.basename(inputPath, path.extname(inputPath)) + "_ocr.pdf";
    }

    const outputPath = path.join(outputDir, outputFileName);

    // Utiliser le DPI du profil s'il est fourni
    const dpi = options.dpi || 150;
    console.log(`📐 DPI utilisé: ${dpi}`);
    
    // NOUVEAU: Gérer le mode PDF/A seul
    const pdfaOnly = options.pdfaOnly || false;
    const modeOcr = pdfaOnly ? "skip" : (options.modeOcr || "auto");
    
    // Utiliser le pdfMode du profil s'il est fourni
    const pdfMode = options.pdfMode || "pdf";
    console.log(`📄 Mode PDF utilisé: ${pdfMode}`);
    console.log(`🔧 Mode OCR: ${modeOcr}, PDF/A seul: ${pdfaOnly}`);
    
    const optimize = options.optimize || 1;
    const tesseractTimeout = options.tesseractTimeout;

    const env = {
      ...process.env,
      PATH: `${tesseractDir};${ghostscriptDir};${popplerDir};${process.env.PATH}`,
      TESSDATA_PREFIX: path.join(tesseractDir, "tessdata"),
    };

    const args = [
      absoluteInputPath,
      outputPath,
      "--dpi", dpi.toString(),
      "--mode-ocr", modeOcr,
      "--mode", pdfMode,
      "--optimize", optimize.toString()
    ];

    // NOUVEAU: Si c'est juste une conversion PDF/A, ne pas ajouter de langue
    if (!pdfaOnly && lang) {
      args.splice(4, 0, "--lang", lang);
    }

    if (typeof tesseractTimeout !== "undefined" && !pdfaOnly) {
      args.push("--tesseract-timeout", tesseractTimeout.toString());
    }

    console.log("📎 Commande OCR complète:", ocrmypdfExe, args.join(" "));

    execFile(ocrmypdfExe, args, { env }, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Erreur ocrmypdf :", stderr || err);
        return reject(stderr || err.message);
      }
      
      if (pdfaOnly) {
        console.log("✅ PDF converti en PDF/A :", outputPath);
      } else {
        console.log("✅ PDF OCRisé créé :", outputPath);
      }
      
      resolve(outputPath);
    });
  });
};

// NOUVEAU: Fonction dédiée pour convertir en PDF/A sans OCR
exports.convertToPdfA = async (inputPath, outputDir, options = {}) => {
  
  return exports.ocrPdfFile(inputPath, "", outputDir, {
    ...options,
    pdfaOnly: true,
    modeOcr: "skip",
    pdfMode: "pdfa"
  });
};

// ---------------- OCR Image -> PDF ----------------
exports.imageToPdf = (imagePath, lang = "eng", outputDir, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(imagePath)) return reject(new Error("Fichier image introuvable"));

    if (!outputDir) outputDir = path.dirname(imagePath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Utiliser le naming pattern s'il est fourni
    let outputFileName;
    if (options.namingPattern) {
      outputFileName = applyNamingPattern(options.namingPattern, options.fileCounter || 1);
      console.log(`📝 Naming pattern appliqué: ${outputFileName}`);
    } else {
      const baseName = path.basename(imagePath, path.extname(imagePath));
      outputFileName = baseName + "_ocr.pdf";
    }

    const outputPdf = path.join(outputDir, outputFileName);

    const env = {
      ...process.env,
      PATH: `${tesseractDir};${ghostscriptDir};${popplerDir};${process.env.PATH}`,
      TESSDATA_PREFIX: path.join(tesseractDir, "tessdata")
    };

    // Utiliser le DPI du profil
    const dpi = options.dpi || 150;
    console.log(`📐 DPI utilisé: ${dpi}`);
    
    // Utiliser le pdfMode du profil
    const pdfMode = options.pdfMode || "pdf";
    console.log(`📄 Mode PDF utilisé: ${pdfMode}`);

    const args = [
      path.resolve(imagePath),
      outputPdf,
      "--lang", lang,
      "--mode-ocr", options.modeOcr || "auto",
      "--dpi", dpi.toString(),
      "--mode", pdfMode
    ];

    console.log("📎 Commande OCR Image complète:", ocrmypdfExe, args.join(" "));

    execFile(ocrmypdfExe, args, { env }, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Erreur ocrmypdf :", stderr || err);
        return reject(stderr || err.message);
      }
      console.log("✅ PDF créé depuis image:", outputPdf);
      resolve(outputPdf);
    });
  });
};

// ---------------- Fonction utilitaire pour appliquer le naming pattern ----------------
// Fonction à remplacer COMPLÈTEMENT dans votre ocrService.js

function applyNamingPattern(pattern, counter = 1) {
  
  const now = new Date();
  
  // Créer l'objet de remplacements
  const replacements = {
    '$(YYYY)': now.getFullYear().toString(),
    '$(YY)': now.getFullYear().toString().slice(-2),
    '$(MM)': (now.getMonth() + 1).toString().padStart(2, '0'),
    '$(DD)': now.getDate().toString().padStart(2, '0'),
    '$(HH)': now.getHours().toString().padStart(2, '0'),
    '$(mm)': now.getMinutes().toString().padStart(2, '0'),
    '$(ss)': now.getSeconds().toString().padStart(2, '0'),
    '$(nnn)': counter.toString().padStart(3, '0'),
    '$(nn)': counter.toString().padStart(2, '0'),
    '$(n)': counter.toString()
  };

  
  let result = pattern;
  
  // Liste des tokens dans l'ordre (les plus longs d'abord pour éviter les conflits)
  const tokens = [
    '$(YYYY)',
    '$(nnn)',
    '$(YY)',
    '$(MM)',
    '$(DD)',
    '$(HH)',
    '$(mm)',
    '$(ss)',
    '$(nn)',
    '$(n)'
  ];
  
  // Remplacer chaque token
  for (const token of tokens) {
    if (result.includes(token)) {
      const value = replacements[token];
      console.log(`Remplacement: ${token} -> ${value}`);
      
      // Utiliser split/join pour remplacer TOUTES les occurrences
      result = result.split(token).join(value);
      
      console.log(`Resultat apres ${token}:`, result);
    }
  }
  
  // Ajouter .pdf si absent
  if (!result.endsWith('.pdf')) {
    result += '.pdf';
  }
  
  // Vérifier s'il reste des tokens non remplacés
  const remaining = result.match(/\$\([^)]+\)/g);
  if (remaining) {
    console.error('ERREUR: Tokens non remplaces:', remaining);
  }
 
  
  return result;
}

// Export
exports.applyNamingPattern = applyNamingPattern;
