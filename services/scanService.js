// services/scanService.js - VERSION COMPLÈTE CORRIGÉE

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const naps2Path = path.join(__dirname, '..', 'bin', 'naps2', 'App', 'NAPS2.Console.exe');
const outputDir = path.join(__dirname, '..', 'output');
const profilesPath = path.join(__dirname, '..', 'data', 'profiles.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * 🔧 Charge la configuration d'un profil depuis profiles.json
 */
function loadProfileConfig(profileName) {
  try {
    if (!fs.existsSync(profilesPath)) {
      console.warn(`⚠️ Fichier profiles.json introuvable: ${profilesPath}`);
      return null;
    }
    
    const profilesData = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    
    if (!profilesData[profileName]) {
      console.warn(`⚠️ Profil "${profileName}" non trouvé dans profiles.json`);
      return null;
    }
    
    console.log(`✅ Profil "${profileName}" chargé depuis profiles.json`);
    return profilesData[profileName];
    
  } catch (error) {
    console.error(`❌ Erreur lecture profiles.json:`, error.message);
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
 * 🔧 Extrait les informations du device depuis le profil
 */
function extractDeviceInfo(profile) {
  let deviceName = null;
  let deviceId = null;
  let driver = null; // ✅ Ne pas forcer de valeur par défaut
  
  console.log(`🔍 Profil brut:`, JSON.stringify(profile, null, 2));
  
  // ✅ PRIORITÉ 1: Lire explicitement le DriverName du profil
  if (profile.DriverName) {
    driver = extractValue(profile.DriverName);
    console.log(`✅ DriverName explicite trouvé: ${driver}`);
  }
  
  // Recherche dans Device (objet)
  if (profile.Device && typeof profile.Device === 'object') {
    deviceName = extractValue(profile.Device.Name);
    deviceId = extractValue(profile.Device.ID);
  }
  
  // Recherche dans Device (string direct)
  if (!deviceName && profile.Device && typeof profile.Device === 'string') {
    deviceName = profile.Device;
  }
  
  // Fallback sur Device.Name et Device.ID (format flat)
  if (!deviceName && profile['Device.Name']) {
    deviceName = extractValue(profile['Device.Name']);
  }
  
  if (!deviceId && profile['Device.ID']) {
    deviceId = extractValue(profile['Device.ID']);
  }
  
  // Fallback sur DeviceName et DeviceID (ancien format)
  if (!deviceName && profile.DeviceName) {
    deviceName = extractValue(profile.DeviceName);
  }
  
  if (!deviceId && profile.DeviceID) {
    deviceId = extractValue(profile.DeviceID);
  }
  
  // ✅ PRIORITÉ 2: Si pas de DriverName explicite, détecter depuis le device
  if (!driver && (deviceName || deviceId)) {
    const name = (deviceName || deviceId).toLowerCase();
    
    console.log(`🔍 Analyse du device pour détecter driver: "${name}"`);
    
    // Pattern WIA : ID hexadécimal style "EPSON9ABE4C" ou contient "wia"
    if (name.match(/[a-f0-9]{6,}/i) || name.includes('wia')) {
      driver = 'wia';
      console.log(`✅ Driver WIA détecté (pattern hexadécimal ou mention 'wia')`);
    }
    // Pattern TWAIN : contient "series" ou "twain"
    else if (name.includes('series') || name.includes('twain')) {
      driver = 'twain';
      console.log(`✅ Driver TWAIN détecté (pattern series/twain)`);
    }
    // Dernier recours: WIA par défaut (plus stable)
    else {
      driver = 'wia';
      console.log(`⚠️ Driver non détecté, utilisation de WIA par défaut`);
    }
  }
  
  // ✅ Sécurité finale
  if (!driver) {
    driver = 'wia';
    console.log(`⚠️ Aucun driver détecté, fallback sur WIA`);
  }
  
  console.log(`📋 Device extrait: Name="${deviceName}", ID="${deviceId}", Driver="${driver}"`);
  
  return { deviceName, deviceId, driver };
}

/**
 * 🔧 Lance un scan avec NAPS2
 */
async function scanFile(profileName, outputPath = null) {
  try {
    console.log(`📠 Démarrage du scan avec le profil: ${profileName}`);
    
    // ✅ Charger la configuration du profil
    const profile = loadProfileConfig(profileName);
    
    let driver = 'wia'; // Par défaut WIA (plus stable)
    let deviceArg = null;
    
    if (profile) {
      const { deviceName, deviceId, driver: detectedDriver } = extractDeviceInfo(profile);
      driver = detectedDriver;
      
      // Priorité : utiliser deviceId si disponible, sinon deviceName
      deviceArg = deviceId || deviceName;
      
      if (deviceArg) {
        console.log(`✅ Configuration chargée: Driver="${driver}", Device="${deviceArg}"`);
      } else {
        console.warn(`⚠️ Aucun device trouvé dans le profil, NAPS2 utilisera le scanner par défaut`);
      }
    } else {
      console.warn(`⚠️ Profil "${profileName}" non trouvé, utilisation de WIA avec scanner par défaut`);
    }
    
    // ✅ CORRECTION CRITIQUE: Générer un nom de fichier COMPLET
    const timestamp = Date.now();
    let outputPattern;
    
    if (outputPath) {
      // Si un chemin est fourni, vérifier s'il contient un nom de fichier
      const ext = path.extname(outputPath);
      if (ext) {
        // C'est un chemin complet avec nom de fichier
        outputPattern = outputPath;
      } else {
        // C'est juste un dossier, ajouter le nom de fichier
        outputPattern = path.join(outputPath, `${profileName}_scan_${timestamp}.pdf`);
      }
    } else {
      // Pas de chemin fourni, utiliser outputDir par défaut
      outputPattern = path.join(outputDir, `${profileName}_scan_${timestamp}.pdf`);
    }
    
    console.log(`📁 Fichier de sortie: ${outputPattern}`);
    
    // ✅ Construire les arguments NAPS2
    const args = [
      '--driver', driver,
      '--profile', profileName
    ];
    
    // Ajouter le device si disponible
    if (deviceArg) {
      args.push('--device', deviceArg);
    }
    
    args.push(
      '--output', outputPattern,
      '--force',
      '-v'
    );
    
    console.log(`📠 Commande NAPS2: ${naps2Path} ${args.join(' ')}`);
    
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
        
        // Filtrer les warnings connus (Qt version)
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
        console.log(`NAPS2 terminé avec le code: ${code}`);
        
        // ✅ CORRECTION: Chercher le fichier généré par NAPS2
        // NAPS2 peut ajouter (1), (2), etc. ou utiliser le pattern exact
        const possibleFiles = [
          outputPattern,
          outputPattern.replace('.pdf', ' (1).pdf'),
          outputPattern.replace('.pdf', '(1).pdf')
        ];
        
        // Chercher aussi tous les PDF créés récemment dans le dossier
        try {
          const searchDir = path.dirname(outputPattern);
          const recentFiles = fs.readdirSync(searchDir)
            .filter(f => f.endsWith('.pdf') && f.includes(profileName))
            .map(f => ({
              name: f,
              path: path.join(searchDir, f),
              time: fs.statSync(path.join(searchDir, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);
          
          if (recentFiles.length > 0) {
            const foundFile = recentFiles[0].path;
            if (fs.statSync(foundFile).size > 0) {
              console.log(`✅ Fichier scanné trouvé: ${foundFile} (${fs.statSync(foundFile).size} bytes)`);
              return resolve(foundFile);
            }
          }
        } catch (searchError) {
          console.error('Erreur recherche fichier:', searchError);
        }
        
        // Fallback: vérifier les chemins possibles
        for (const filePath of possibleFiles) {
          if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
            console.log(`✅ Fichier scanné créé: ${filePath} (${fs.statSync(filePath).size} bytes)`);
            return resolve(filePath);
          }
        }
        
        // ❌ Échec du scan
        if (code !== 0) {
          const errorMsg = stderr || stdout || 'Erreur inconnue';
          
          // Messages d'erreur améliorés avec solutions
          let userMessage = errorMsg;
          
          if (errorMsg.includes('TWAIN session open error')) {
            userMessage = `❌ Impossible d'ouvrir le scanner via TWAIN.\n\n` +
              `🔧 Solutions:\n` +
              `1. Dans votre profil, changez le Device.ID pour "EPSON9ABE4C (L386 Series)" (driver WIA)\n` +
              `2. Fermez toute application utilisant le scanner (HP Smart, Epson Scan, etc.)\n` +
              `3. Redémarrez le scanner\n` +
              `4. Mettez à jour les drivers EPSON`;
          } else if (errorMsg.includes('No scanner found') || errorMsg.includes('No device found')) {
            userMessage = `❌ Aucun scanner détecté.\n\n` +
              `🔧 Solutions:\n` +
              `1. Vérifiez que le scanner est allumé et connecté en USB\n` +
              `2. Testez le scanner avec l'application Epson Scan\n` +
              `3. Réinstallez les drivers du scanner\n` +
              `4. Essayez un autre port USB`;
          } else if (errorMsg.includes('0 page(s) scanned')) {
            userMessage = `❌ Aucune page scannée.\n\n` +
              `🔧 Solutions:\n` +
              `1. Vérifiez qu'il y a du papier dans le chargeur\n` +
              `2. Ouvrez le scanner et vérifiez qu'il n'y a pas de bourrage\n` +
              `3. Essayez de scanner depuis l'application Epson Scan`;
          }
          
          return reject(new Error(`Erreur lors du scan:\n${userMessage}`));
        }
        
        reject(new Error(`Le fichier scanné n'a pas été créé ou est vide. Vérifiez le dossier: ${path.dirname(outputPattern)}`));
      });
      
      naps2Process.on('error', (error) => {
        console.error(`❌ Erreur lancement NAPS2:`, error);
        reject(new Error(`Impossible de lancer NAPS2: ${error.message}\n\nVérifiez que NAPS2.Console.exe existe dans: ${naps2Path}`));
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