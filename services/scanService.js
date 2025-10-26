// services/scanService.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js'); // ✅ Ajouter xml2js

const naps2Path = path.join(__dirname, '..', 'bin', 'naps2', 'App', 'NAPS2.Console.exe');
const outputDir = path.join(__dirname, '..', 'output');
const profilesPath = path.join(__dirname, '..', 'bin', 'naps2', 'Data', 'profiles.xml'); // ✅ CORRECTION

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * 🔧 Charge la configuration d'un profil depuis profiles.xml (VERSION CORRIGÉE)
 */
async function loadProfileConfig(profileName) {
  try {
    if (!fs.existsSync(profilesPath)) {
      console.warn(`⚠️ Fichier profiles.xml introuvable: ${profilesPath}`);
      return null;
    }
    
    // ✅ Lire et parser le fichier XML
    const xmlContent = fs.readFileSync(profilesPath, 'utf-8');
    const xmlObj = await xml2js.parseStringPromise(xmlContent, { explicitArray: true });
    
    // ✅ Trouver le profil par DisplayName
    const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
    const profile = profiles.find(p => p?.DisplayName?.[0] === profileName);
    
    if (!profile) {
      console.warn(`⚠️ Profil "${profileName}" non trouvé dans profiles.xml`);
      return null;
    }
    
    console.log(`✅ Profil "${profileName}" chargé depuis profiles.xml`);
    return profile;
    
  } catch (error) {
    console.error(`❌ Erreur lecture profiles.xml:`, error.message);
    return null;
  }
}

/**
 * 🔧 Extrait la valeur d'un champ qui peut être un tableau ou une valeur simple
 */
function extractValue(value) {
  if (Array.isArray(value) && value.length > 0) {
    // Si c'est un tableau avec un objet xsi:nil, retourner undefined
    if (typeof value[0] === 'object' && value[0].$ && value[0].$.hasOwnProperty('xsi:nil')) {
      return undefined;
    }
    return extractValue(value[0]);
  }
  
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  return value;
}

/**
 * 🔧 Extrait les informations du device depuis le profil (VERSION AMÉLIORÉE)
 */
function extractDeviceInfo(profile) {
  let deviceName = null;
  let deviceId = null;
  let driver = null;
  
  console.log(`🔍 === EXTRACTION DEVICE INFO ===`);
  
  // ✅ PRIORITÉ 1: Lire le DriverName du profil
  if (profile.DriverName) {
    driver = extractValue(profile.DriverName);
    console.log(`✅ DriverName du profil: "${driver}"`);
  }
  
  // ✅ PRIORITÉ 2: Extraire Device.Name et Device.ID
  if (profile.Device && profile.Device[0]) {
    if (profile.Device[0].Name) {
      deviceName = extractValue(profile.Device[0].Name);
      console.log(`✅ Device.Name: "${deviceName}"`);
    }
    
    if (profile.Device[0].ID) {
      deviceId = extractValue(profile.Device[0].ID);
      console.log(`✅ Device.ID: "${deviceId}"`);
    }
  }
  
  // ✅ Si pas de driver explicite, essayer de le détecter
  if (!driver && (deviceName || deviceId)) {
    const name = (deviceName || deviceId).toLowerCase();
    console.log(`🔍 Tentative de détection du driver depuis: "${name}"`);
    
    // Pattern WIA : ID hexadécimal ou contient "wia"
    if (name.match(/[a-f0-9]{6,}/i) || name.includes('wia')) {
      driver = 'wia';
      console.log(`✅ Driver WIA détecté`);
    }
    // Pattern TWAIN : contient "series" ou "twain"
    else if (name.includes('series') || name.includes('twain')) {
      driver = 'twain';
      console.log(`✅ Driver TWAIN détecté`);
    }
    else {
      driver = 'wia';
      console.log(`⚠️ Driver non détecté, utilisation de WIA par défaut`);
    }
  }
  
  // ✅ Fallback final
  if (!driver) {
    driver = 'wia';
    console.log(`⚠️ Fallback final sur WIA`);
  }
  
  console.log(`📋 === RÉSULTAT EXTRACTION ===`);
  console.log(`   Device.Name: "${deviceName}"`);
  console.log(`   Device.ID: "${deviceId}"`);
  console.log(`   Driver: "${driver}"`);
  
  return { deviceName, deviceId, driver };
}

/**
 * 🔧 Lance un scan avec NAPS2 (VERSION FINALE)
 */
async function scanFile(profileName, outputPath = null) {
  try {
    console.log(`\n📠 === DÉMARRAGE DU SCAN ===`);
    console.log(`📋 Profil demandé: "${profileName}"`);
    
    // ✅ Charger la configuration du profil depuis XML
    const profile = await loadProfileConfig(profileName);
    
    if (!profile) {
      console.warn(`⚠️ Profil "${profileName}" non trouvé dans profiles.xml`);
      console.warn(`⚠️ NAPS2 va essayer d'utiliser le scanner par défaut`);
    }
    
    let driver = 'wia';
    let deviceArg = null;
    
    if (profile) {
      const { deviceName, deviceId, driver: detectedDriver } = extractDeviceInfo(profile);
      driver = detectedDriver;
      
      // ✅ Utiliser deviceId en priorité
      deviceArg = deviceId || deviceName;
      
      console.log(`📋 Configuration du profil:`, {
        driver: driver,
        deviceName: deviceName,
        deviceId: deviceId,
        deviceArgUsed: deviceArg
      });
      
      if (!deviceArg) {
        console.warn(`⚠️ Aucun device trouvé dans le profil, NAPS2 utilisera le scanner par défaut`);
      }
    }
    
    // ✅ Générer un nom de fichier
    const timestamp = Date.now();
    let outputPattern;
    
    if (outputPath) {
      const ext = path.extname(outputPath);
      if (ext) {
        outputPattern = outputPath;
      } else {
        outputPattern = path.join(outputPath, `${profileName}_scan_${timestamp}.pdf`);
      }
    } else {
      outputPattern = path.join(outputDir, `${profileName}_scan_${timestamp}.pdf`);
    }
    
    console.log(`📁 Fichier de sortie: ${outputPattern}`);
    
    // ✅ Construire les arguments NAPS2
    const args = [
      '--driver', driver,
      '--profile', profileName
    ];
    
    // ✅ Ajouter le device s'il est défini
    if (deviceArg) {
      args.push('--device', deviceArg);
      console.log(`📡 Device spécifié: "${deviceArg}"`);
    } else {
      console.log(`📡 Pas de device spécifié, NAPS2 utilisera le scanner par défaut`);
    }
    
    args.push(
      '--output', outputPattern,
      '--force',
      '-v'
    );
    
    console.log(`\n🚀 Commande NAPS2:`);
    console.log(`   ${naps2Path}`);
    console.log(`   Arguments: ${args.join(' ')}`);
    console.log(``);
    
    // Lancer NAPS2
    return new Promise((resolve, reject) => {
      const naps2Process = spawn(naps2Path, args, {
        cwd: outputDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      naps2Process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        if (output.includes('Untested Windows version')) {
          console.log(`⚠️ NAPS2 warning (ignoré): ${output.trim()}`);
        } else {
          console.log(`NAPS2 stdout: ${output.trim()}`);
        }
      });
      
      naps2Process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        if (output.includes('Untested Windows version')) {
          console.log(`⚠️ NAPS2 warning (ignoré): ${output.trim()}`);
        } else {
          console.error(`NAPS2 stderr: ${output.trim()}`);
        }
      });
      
      naps2Process.on('close', (code) => {
        console.log(`\n📊 NAPS2 terminé avec le code: ${code}`);
        
        if (code !== 0) {
          console.error(`❌ Erreur NAPS2 (code ${code})`);
          console.error(`📋 stdout:`, stdout);
          console.error(`📋 stderr:`, stderr);
        }
        
        // ✅ Chercher le fichier généré
        const searchDir = path.dirname(outputPattern);
        
        try {
          const recentFiles = fs.readdirSync(searchDir)
            .filter(f => f.endsWith('.pdf') && f.includes(profileName))
            .map(f => ({
              name: f,
              path: path.join(searchDir, f),
              time: fs.statSync(path.join(searchDir, f)).mtime,
              size: fs.statSync(path.join(searchDir, f)).size
            }))
            .sort((a, b) => b.time - a.time);
          
          console.log(`\n🔍 Recherche de fichiers PDF dans: ${searchDir}`);
          console.log(`   Critère: fichiers contenant "${profileName}"`);
          console.log(`   Fichiers trouvés: ${recentFiles.length}`);
          
          if (recentFiles.length > 0) {
            recentFiles.forEach((f, i) => {
              console.log(`   ${i + 1}. ${f.name} (${f.size} bytes, ${f.time})`);
            });
            
            const foundFile = recentFiles[0].path;
            if (recentFiles[0].size > 0) {
              console.log(`\n✅ Fichier scanné trouvé: ${foundFile} (${recentFiles[0].size} bytes)`);
              return resolve(foundFile);
            } else {
              console.warn(`⚠️ Fichier trouvé mais vide: ${foundFile}`);
            }
          } else {
            console.warn(`⚠️ Aucun fichier PDF trouvé avec le critère "${profileName}"`);
          }
        } catch (searchError) {
          console.error('❌ Erreur recherche fichier:', searchError);
        }
        
        // ❌ Échec du scan
        if (code !== 0) {
          const errorMsg = stderr || stdout || 'Erreur inconnue';
          
          let userMessage = `❌ Erreur lors du scan:\n${errorMsg}\n\n`;
          
          if (errorMsg.includes('scanner') && errorMsg.includes('introuvable')) {
            userMessage += `🔧 Le scanner n'a pas été trouvé. Vérifications:\n`;
            userMessage += `   1. Driver configuré: ${driver}\n`;
            userMessage += `   2. Device configuré: ${deviceArg || '(par défaut)'}\n`;
            userMessage += `   3. Vérifiez que le scanner est allumé et connecté\n`;
            userMessage += `   4. Testez avec NAPS2 directement\n`;
            userMessage += `   5. Comparez Device.ID avec un profil qui fonctionne\n`;
          } else if (errorMsg.includes('0 page(s) scanned')) {
            userMessage += `🔧 Solutions:\n`;
            userMessage += `   1. Vérifiez qu'il y a du papier\n`;
            userMessage += `   2. Vérifiez qu'il n'y a pas de bourrage\n`;
            userMessage += `   3. Testez avec Epson Scan\n`;
          }
          
          return reject(new Error(userMessage));
        }
        
        reject(new Error(`Le fichier scanné n'a pas été créé. Dossier: ${searchDir}`));
      });
      
      naps2Process.on('error', (error) => {
        console.error(`❌ Erreur lancement NAPS2:`, error);
        reject(new Error(`Impossible de lancer NAPS2: ${error.message}\n\nVérifiez: ${naps2Path}`));
      });
    });
    
  } catch (error) {
    console.error(`❌ Erreur scan:`, error);
    throw error;
  }
}

/**
 * Liste les scanners disponibles via NAPS2 (WIA et TWAIN)
 */
async function listScanners() {
  const scanners = [];

  try {
    // Test WIA
    const wiaOutput = await new Promise((resolve, reject) => {
      const child = spawn(naps2Path, ['--listdevices', '--driver', 'wia'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      child.stdout.on('data', d => output += d.toString());
      child.stderr.on('data', d => output += d.toString());

      child.on('close', code => {
        if (code === 0) resolve(output);
        else reject(new Error(`WIA listdevices failed: ${output}`));
      });

      child.on('error', err => reject(err));
    });

    console.log(`Sortie brute NAPS2 (wia): ${wiaOutput.trim()}`);

    const wiaLines = wiaOutput.split('\n').filter(l => l.trim() && !l.includes('Qt:'));
    wiaLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        scanners.push({
          id: trimmed,
          name: trimmed,
          driver: 'wia'
        });
        console.log(`  ✅ Scanner ajouté: "${trimmed}" avec driver="wia" et id="${trimmed}"`);
      }
    });

    console.log(`${wiaLines.length} scanner(s) trouvé(s) avec wia`);

  } catch (err) {
    console.warn('Impossible de lister les scanners WIA:', err.message);
  }

  try {
    // Test TWAIN
    const twainOutput = await new Promise((resolve, reject) => {
      const child = spawn(naps2Path, ['--listdevices', '--driver', 'twain'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      child.stdout.on('data', d => output += d.toString());
      child.stderr.on('data', d => output += d.toString());

      child.on('close', code => {
        if (code === 0) resolve(output);
        else reject(new Error(`TWAIN listdevices failed: ${output}`));
      });

      child.on('error', err => reject(err));
    });

    console.log(`Sortie brute NAPS2 (twain): ${twainOutput.trim()}`);

    const twainLines = twainOutput.split('\n').filter(l => l.trim() && !l.includes('Qt:'));
    twainLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        scanners.push({
          id: trimmed,
          name: trimmed,
          driver: 'twain'
        });
        console.log(`  ✅ Scanner ajouté: "${trimmed}" avec driver="twain" et id="${trimmed}"`);
      }
    });

    console.log(`${twainLines.length} scanner(s) trouvé(s) avec twain`);

  } catch (err) {
    console.warn('Impossible de lister les scanners TWAIN:', err.message);
  }

  return scanners;
}

module.exports = {
  scanFile,
  listScanners
};