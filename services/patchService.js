// services/patchService.js - CORRECTION COMPLÈTE
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 📌 Constantes globales
const exePath = path.join(__dirname, "..", "bin", "patchsplitter.exe");
const outputDir = path.join(__dirname, "../output");
const templatePath = path.join(__dirname, "..", "patchT", "patchT_template.png");

// Création du dossier output si manquant
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Utilitaire pour lancer patchsplitter.exe
function spawnProcess(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, args, { cwd: outputDir, stdio: ["ignore", "pipe", "pipe"] });

    let error = "";
    let stdout = "";

    child.stderr.on("data", d => error += d.toString());
    child.stdout.on("data", d => stdout += d.toString());

    child.on("close", code => {
      if (code !== 0) reject(new Error(`patchsplitter.exe failed (code ${code}): ${error}`));
      else resolve(stdout);
    });

    child.on("error", err => reject(new Error(`Impossible de lancer patchsplitter.exe: ${err.message}`)));
  });
}

// 🟢 Découpage PDF
exports.splitByPatch = async (pdfPath, options = {}) => {
  const pdfAbsolutePath = path.resolve(pdfPath);

  if (!fs.existsSync(templatePath)) throw new Error("Template introuvable : " + templatePath);
  if (!fs.existsSync(pdfAbsolutePath)) throw new Error("PDF introuvable : " + pdfAbsolutePath);

  // FIX: Si naming est "vide" ou "aucun", utiliser "generic" à la place
  let naming = options.naming || "barcode_ocr_generic";
  console.log(`🔍 Naming reçu: "${naming}"`);
  
  if (naming === "vide" || naming === "aucun" || naming === "" || !naming) {
    console.log(`⚠️ Naming '${naming}' détecté, remplacement par 'generic'`);
    naming = "generic";
  }

  const args = [
    "--pdf_path", pdfAbsolutePath,
    "--template_path", templatePath,
    "--mode", options.patchMode || "T_classique",
    "--lang", options.lang || "fra",
    "--naming", naming
  ];

  console.log("📋 Arguments patchsplitter:", args);

  await spawnProcess(args);

  const jsonFile = path.join(outputDir, "results.json");
  if (!fs.existsSync(jsonFile)) throw new Error("JSON de sortie introuvable : " + jsonFile);

  const files = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));

  // ✅ CORRECTION : Renommer physiquement les fichiers selon le pattern
  return files.map((f, index) => {
    if (!f || !f.file) {
      console.error(`Fichier invalide à l'index ${index}:`, f);
      return null;
    }
    
    const originalFilePath = path.join(outputDir, path.basename(f.file));
    
    // Vérifier que le fichier source existe
    if (!fs.existsSync(originalFilePath)) {
      console.error(`❌ Fichier source introuvable: ${originalFilePath}`);
      return null;
    }
    
    const originalBaseName = path.basename(f.file);
    const ext = path.extname(originalBaseName);
    let newFileName;
    
    // ✅ Cas 1: naming="generic" + pattern personnalisé → Utiliser UNIQUEMENT le pattern
    if (naming === "generic" && options.namingPattern && options.namingPattern.includes("$")) {
      try {
        const { applyNamingPattern } = require("../utils/fileutils");
        
        // Générer le nom depuis le pattern seul
        const patternResult = applyNamingPattern("", options.namingPattern, index + 1);
        
        // Assurer qu'on a une extension PDF
        newFileName = patternResult.endsWith('.pdf') ? patternResult : `${patternResult}.pdf`;
        
        console.log(`✅ Pattern seul: "${originalBaseName}" → "${newFileName}"`);
      } catch (error) {
        console.warn(`⚠️ Erreur naming pattern: ${error.message}`);
        newFileName = f.name || originalBaseName;
      }
    } 
    // ✅ Cas 2: Autre stratégie + pattern → Base + pattern
    else if (options.namingPattern && options.namingPattern.includes("$")) {
      try {
        const { applyNamingPattern } = require("../utils/fileutils");
        
        // Enlever l'extension du nom de base pour éviter les doublons
        const baseWithoutExt = path.basename(originalBaseName, ext);
        const patternResult = applyNamingPattern(baseWithoutExt, options.namingPattern, index + 1);
        
        newFileName = patternResult.endsWith('.pdf') ? patternResult : `${patternResult}.pdf`;
        
        console.log(`✅ Pattern avec base: "${originalBaseName}" → "${newFileName}"`);
      } catch (error) {
        console.warn(`⚠️ Erreur naming pattern: ${error.message}`);
        newFileName = f.name || originalBaseName;
      }
    } 
    // ✅ Cas 3: Pas de pattern → Utiliser le nom par défaut
    else {
      newFileName = f.name || originalBaseName;
      console.log(`📝 Nom par défaut: "${newFileName}"`);
    }
    
    // ✅ RENOMMAGE PHYSIQUE du fichier
    const newFilePath = path.join(outputDir, newFileName);
    
    try {
      // Si le nouveau chemin est différent, renommer le fichier
      if (originalFilePath !== newFilePath) {
        // Vérifier si le fichier de destination existe déjà
        if (fs.existsSync(newFilePath)) {
          console.warn(`⚠️ Le fichier ${newFileName} existe déjà, génération d'un nom unique...`);
          const timestamp = Date.now();
          const baseNameNoExt = path.basename(newFileName, '.pdf');
          newFileName = `${baseNameNoExt}_${timestamp}.pdf`;
          const uniqueFilePath = path.join(outputDir, newFileName);
          fs.renameSync(originalFilePath, uniqueFilePath);
          console.log(`✅ Fichier renommé (unique): ${originalBaseName} → ${newFileName}`);
          
          return {
            ...f,
            name: newFileName,
            file: uniqueFilePath
          };
        }
        
        fs.renameSync(originalFilePath, newFilePath);
        console.log(`✅ Fichier renommé: ${originalBaseName} → ${newFileName}`);
      } else {
        console.log(`ℹ️ Pas de renommage nécessaire pour: ${newFileName}`);
      }
      
      return {
        ...f,
        name: newFileName,
        file: newFilePath
      };
      
    } catch (renameError) {
      console.error(`❌ Erreur renommage ${originalBaseName}:`, renameError);
      // En cas d'erreur, retourner le fichier original
      return {
        ...f,
        name: originalBaseName,
        file: originalFilePath
      };
    }
  }).filter(f => f !== null);
};

// 🟢 Génération de patch
exports.generatePatchFromData = async (data) => {
  const args = [
    "--template_path", templatePath,
    "--generate_patch",
    "--data", data
  ];

  const stdout = await spawnProcess(args);

  const fileMatch = stdout.match(/Patch généré\s*:\s*(.+?\.(pdf|png))/i);
  if (!fileMatch) throw new Error("Aucun fichier patch trouvé dans la sortie");

  const generatedPatch = fileMatch[1];
  if (!fs.existsSync(generatedPatch)) throw new Error("Fichier patch introuvable : " + generatedPatch);

  const destPath = path.join(outputDir, path.basename(generatedPatch));
  if (generatedPatch !== destPath) fs.copyFileSync(generatedPatch, destPath);

  const fileBuffer = fs.readFileSync(destPath);
  const base64Content = fileBuffer.toString("base64");
  const ext = path.extname(destPath).toLowerCase();
  const mimeType = ext === ".pdf" ? "application/pdf" : "image/png";

  return {
    name: path.basename(destPath),
    base64: base64Content,
    mimeType,
    path: destPath
  };
};