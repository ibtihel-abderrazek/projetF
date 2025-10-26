const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

// Chemins
const profilesFile = path.join(__dirname, "..", "bin", "naps2", "Data", "profiles.xml");
const backupDir = path.join(__dirname, "..", "data", "deleted");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// --- UTILITAIRES ---
async function readProfilesXml() {
  const data = await fs.promises.readFile(profilesFile, "utf-8");
  return xml2js.parseStringPromise(data, { explicitArray: true });
}

async function writeProfilesXml(xmlObj) {
  const builder = new xml2js.Builder({
    xmldec: { version: "1.0", encoding: "utf-8" },
    renderOpts: { pretty: true },
  });
  await fs.promises.writeFile(profilesFile, builder.buildObject(xmlObj), "utf-8");
}

// --- MÉTHODES PRINCIPALES ---

async function getAllProfiles() {
  const xmlObj = await readProfilesXml();
  return xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
}

async function getProfileByDisplayName(displayName) {
  const profiles = await getAllProfiles();
  const profile = profiles.find((p) => p?.DisplayName?.[0] === displayName);
  if (!profile) return null;

  // Normalisation DeviceID / DeviceName
  if (profile.Device && profile.Device[0]) {
    profile.DeviceID = profile.Device[0].ID ? profile.Device[0].ID[0] : null;
    profile.DeviceName = profile.Device[0].Name ? profile.Device[0].Name[0] : null;
  }

  return profile;
}

async function addProfile(profileData) {
  try { 
    const existingProfile = await getProfileByDisplayName(profileData.DisplayName);
    if (existingProfile) {
      throw new Error("Un profil avec ce nom existe déjà");
    }

    // ✅ DEBUG: Afficher toutes les données reçues
    console.log('📋 Données profileData reçues:', JSON.stringify(profileData, null, 2));

    // ✅ CORRECTION 1: Récupérer le driver depuis les données du formulaire
    const driverName = profileData.DriverName || 'twain';
    console.log(`📋 Driver sélectionné pour le nouveau profil: "${driverName}"`);

    // Device.Name et Device.ID ont maintenant la même valeur (nom du scanner)
    const deviceName = profileData['Device.Name'] || profileData.DeviceName || 'TWAIN2 FreeImage Software Scanner';
    const deviceID = profileData['Device.ID'] || deviceName;

    console.log(`📋 Device.Name: "${deviceName}"`);
    console.log(`📋 Device.ID: "${deviceID}"`);
    console.log(`📋 DriverName final: "${driverName}"`);

    const newProfile = {
      Version: [profileData.Version || '5'],
      Device: [{
        ID: [deviceID],
        Name: [deviceName],
        IconUri: [{ $: { 'xsi:nil': 'true' } }],
        ConnectionUri: [{ $: { 'xsi:nil': 'true' } }]
      }],
      Caps: [{
        PaperSources: [profileData.PaperSources || 'Glass,Feeder'],
        FeederCheck: [profileData.FeederCheck || 'true'],
        Glass: [{ 
          ScanArea: [profileData['Glass.ScanArea'] || '8,5x14 in'],
          Resolutions: [profileData['Glass.Resolutions'] || '50,100,150,200,300,400,600'] 
        }],
        Feeder: [{ 
          ScanArea: [profileData['Feeder.ScanArea'] || '8,5x14 in'],
          Resolutions: [profileData['Feeder.Resolutions'] || '50,100,150,200,300,400,600'] 
        }],
        Duplex: [profileData.Duplex || '']
      }],
      // ✅ CORRECTION 2: Utiliser le driver sélectionné
      DriverName: [driverName],
      DisplayName: [profileData.DisplayName],
      IconID: [profileData.IconID || '0'],
      MaxQuality: [profileData.MaxQuality === 'on' ? 'true' : (profileData.MaxQuality || 'false')],
      IsDefault: [profileData.IsDefault === 'on' ? 'true' : (profileData.IsDefault || 'false')],
      UseNativeUI: [profileData.UseNativeUI === 'on' ? 'true' : (profileData.UseNativeUI || 'false')],
      AfterScanScale: [profileData.AfterScanScale || 'OneToOne'],
      Brightness: [profileData.Brightness || '0'],
      Contrast: [profileData.Contrast || '0'],
      BitDepth: [profileData.BitDepth || 'C24Bit'],
      PageAlign: [profileData.PageAlign || 'Right'],
      PageSize: [profileData.PageSize || 'Letter'],
      CustomPageSizeName: [{ $: { 'xsi:nil': 'true' } }],
      CustomPageSize: [{ $: { 'xsi:nil': 'true' } }],
      Resolution: [profileData.Resolution || 'Dpi100'],
      PaperSource: [profileData.PaperSource || 'Glass'],
      EnableAutoSave: [profileData.EnableAutoSave === 'on' ? 'true' : (profileData.EnableAutoSave || 'false')],
      AutoSaveSettings: profileData.AutoSaveSettings && Object.keys(profileData.AutoSaveSettings).length > 0 
      ? [{
          FilePath: [profileData.AutoSaveSettings.FilePath || '$(DD)-$(MM)-$(YYYY)-$(n)'],
          PromptForFilePath: [profileData.AutoSaveSettings.PromptForFilePath || 'false'],
          ClearImagesAfterSaving: [profileData.AutoSaveSettings.ClearImagesAfterSaving || 'false'],
          Separator: [profileData.AutoSaveSettings.Separator || 'FilePerPage']
        }]
      : [{ $: { 'xsi:nil': 'true' } }],
      Quality: [profileData.Quality || '75'],
      AutoDeskew: [profileData.AutoDeskew === 'on' ? 'true' : (profileData.AutoDeskew || 'false')],
      RotateDegrees: [profileData.RotateDegrees || '0'],
      BrightnessContrastAfterScan: [profileData.BrightnessContrastAfterScan === 'on' ? 'true' : (profileData.BrightnessContrastAfterScan || 'false')],
      ForcePageSize: [profileData.ForcePageSize === 'on' ? 'true' : (profileData.ForcePageSize || 'false')],
      ForcePageSizeCrop: [profileData.ForcePageSizeCrop === 'on' ? 'true' : (profileData.ForcePageSizeCrop || 'false')],
      TwainImpl: [profileData.TwainImpl || 'Default'],
      TwainProgress: [profileData.TwainProgress === 'on' ? 'true' : (profileData.TwainProgress || 'false')],
      ExcludeBlankPages: [profileData.ExcludeBlankPages === 'on' ? 'true' : (profileData.ExcludeBlankPages || 'false')],
      BlankPageWhiteThreshold: [profileData.BlankPageWhiteThreshold || '70'],
      BlankPageCoverageThreshold: [profileData.BlankPageCoverageThreshold || '25'],
      WiaOffsetWidth: [profileData.WiaOffsetWidth === 'on' ? 'true' : (profileData.WiaOffsetWidth || 'false')],
      WiaRetryOnFailure: [profileData.WiaRetryOnFailure === 'on' ? 'true' : (profileData.WiaRetryOnFailure || 'false')],
      WiaDelayBetweenScans: [profileData.WiaDelayBetweenScans === 'on' ? 'true' : (profileData.WiaDelayBetweenScans || 'false')],
      WiaDelayBetweenScansSeconds: [profileData.WiaDelayBetweenScansSeconds || '2'],
      WiaVersion: [profileData.WiaVersion || 'Default'],
      FlipDuplexedPages: [profileData.FlipDuplexedPages === 'on' ? 'true' : (profileData.FlipDuplexedPages || 'false')],
      KeyValueOptions: [{ $: { 'xsi:nil': 'true' } }]
    };

    console.log("✅ Profil construit avec succès");
    console.log(`📋 DriverName dans le profil: "${newProfile.DriverName[0]}"`);

    const xmlObj = await readProfilesXml();
    const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
    profiles.push(newProfile);
    xmlObj.ArrayOfScanProfile.ScanProfile = profiles;
    await writeProfilesXml(xmlObj);

    console.log(`✅ Profil "${profileData.DisplayName}" créé avec driver="${driverName}"`);

    return newProfile;
  } catch (error) {
    console.error("❌ Erreur détaillée dans addProfile:", error);
    throw new Error(`Erreur lors de l'ajout du profil: ${error.message}`);
  }
}

async function updateProfileByDisplayName(displayName, updatedParams) {
  try {
    const xmlObj = await readProfilesXml();
    const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
    const profileIndex = profiles.findIndex((p) => p?.DisplayName?.[0] === displayName);
    
    if (profileIndex === -1) {
      throw new Error("Profil non trouvé");
    }

    const profile = profiles[profileIndex];
    
    // ✅ CORRECTION 3: Gérer DriverName dans les mises à jour
    if (updatedParams.DriverName) {
      console.log(`📋 Mise à jour du driver: ${updatedParams.DriverName}`);
    }
    
    // Gérer AutoSaveSettings
    const autoSaveFields = {};
    let hasAutoSaveData = false;
    
    Object.keys(updatedParams).forEach(key => {
      if (key.startsWith('AutoSaveSettings.')) {
        const subKey = key.replace('AutoSaveSettings.', '');
        autoSaveFields[subKey] = updatedParams[key];
        hasAutoSaveData = true;
        delete updatedParams[key];
      }
    });
    
    if (hasAutoSaveData) {
      if (!profile.AutoSaveSettings || 
          (profile.AutoSaveSettings[0] && profile.AutoSaveSettings[0].$ && profile.AutoSaveSettings[0].$.hasOwnProperty('xsi:nil'))) {
        profile.AutoSaveSettings = [{
          FilePath: [autoSaveFields.FilePath || '$(DD)-$(MM)-$(YYYY)-$(n)'],
          PromptForFilePath: [autoSaveFields.PromptForFilePath === 'true' ? 'true' : 'false'],
          ClearImagesAfterSaving: [autoSaveFields.ClearImagesAfterSaving === 'true' ? 'true' : 'false'],
          Separator: [autoSaveFields.Separator || 'FilePerPage']
        }];
      } else {
        Object.entries(autoSaveFields).forEach(([key, value]) => {
          if (!profile.AutoSaveSettings[0][key]) {
            profile.AutoSaveSettings[0][key] = [value];
          } else {
            profile.AutoSaveSettings[0][key][0] = value;
          }
        });
      }
    }
    
    const nullableFields = [
      'IconUri', 'ConnectionUri', 'CustomPageSizeName', 
      'CustomPageSize', 'KeyValueOptions'
    ];
    
    function updateNestedValue(obj, keyPath, value) {
      const keys = keyPath.split('.');
      let current = obj;
      
      // Gérer Device.ID et Device.Name
      if (keys[0] === 'Device') {
        if (!current.Device || !current.Device[0]) {
          current.Device = [{
            ID: [''],
            Name: [''],
            IconUri: [{ $: { 'xsi:nil': 'true' } }],
            ConnectionUri: [{ $: { 'xsi:nil': 'true' } }]
          }];
        }
        const deviceKey = keys[1];
        if (!current.Device[0][deviceKey]) {
          current.Device[0][deviceKey] = [''];
        }
        current.Device[0][deviceKey][0] = value || '';
        return;
      }

      // Gérer Caps
      if (keys[0] === 'Caps') {
        if (!current.Caps || !current.Caps[0]) {
          current.Caps = [{}];
        }
        
        if (keys.length === 2) {
          current.Caps[0][keys[1]] = [value];
          return;
        } else if (keys.length === 3) {
          const subSection = keys[1];
          const subKey = keys[2];
          
          if (!current.Caps[0][subSection] || !current.Caps[0][subSection][0]) {
            current.Caps[0][subSection] = [{}];
          }
          current.Caps[0][subSection][0][subKey] = [value];
          return;
        }
      }
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] && Array.isArray(current[key]) && current[key][0]) {
          current = current[key][0];
        } else if (current[key]) {
          current = current[key];
        } else {
          current[key] = [{}];
          current = current[key][0];
        }
      }
      
      const finalKey = keys[keys.length - 1];
      
      if (nullableFields.includes(finalKey) && 
          current[finalKey] && 
          Array.isArray(current[finalKey]) && 
          current[finalKey][0] && 
          current[finalKey][0].$ && 
          current[finalKey][0].$.hasOwnProperty('xsi:nil')) {
        if (value !== null && value !== undefined && value !== '') {
          current[finalKey][0] = value;
        }
        return;
      }
      
      if (value === 'on') {
        value = 'true';
      }
      
      if (current[finalKey] && Array.isArray(current[finalKey])) {
        current[finalKey][0] = value;
      } else {
        current[finalKey] = [value];
      }
    }
    
    // Appliquer toutes les mises à jour
    for (const [keyPath, value] of Object.entries(updatedParams)) {
      updateNestedValue(profile, keyPath, value);
    }
    
    await writeProfilesXml(xmlObj);
    
    console.log("✅ Profil mis à jour avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur détaillée dans updateProfile:", error);
    throw new Error(`Erreur lors de la mise à jour du profil: ${error.message}`);
  }
}

async function deleteProfileByDisplayName(displayName) {
  const xmlObj = await readProfilesXml();
  const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];
  const index = profiles.findIndex((p) => p?.DisplayName?.[0] === displayName);
  if (index === -1) throw new Error("Profil non trouvé");

  const deletedProfile = profiles.splice(index, 1)[0];
  await writeProfilesXml(xmlObj);

  const backupFile = path.join(backupDir, `${displayName}_${Date.now()}.json`);
  await fs.promises.writeFile(
    backupFile,
    JSON.stringify({ originalName: displayName, profile: deletedProfile, deletedAt: new Date() }, null, 2)
  );

  return deletedProfile;
}

function getDeletedProfiles() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const content = fs.readFileSync(path.join(backupDir, f), "utf-8");
      return JSON.parse(content);
    })
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
}

async function restoreProfile(backupFileName) {
  const backupPath = path.join(backupDir, backupFileName);
  if (!fs.existsSync(backupPath)) throw new Error("Fichier de backup non trouvé");

  const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const xmlObj = await readProfilesXml();
  const profiles = xmlObj?.ArrayOfScanProfile?.ScanProfile || [];

  if (profiles.find((p) => p?.DisplayName?.[0] === backupContent.originalName)) {
    throw new Error(`Un profil avec le DisplayName "${backupContent.originalName}" existe déjà`);
  }

  profiles.push(backupContent.profile);
  await writeProfilesXml(xmlObj);
  await fs.promises.unlink(backupPath);

  return backupContent.originalName;
}

// ✅ CORRECTION 4: Nouvelle fonction pour récupérer le DriverName
async function getDriverNameByProfile(displayName) {
  const profile = await getProfileByDisplayName(displayName);
  if (!profile) {
    throw new Error(`Profil "${displayName}" non trouvé`);
  }
  
  // Récupérer le DriverName depuis le profil
  const driverName = profile.DriverName?.[0] || 'twain';
  console.log(`📋 Driver récupéré pour le profil "${displayName}": ${driverName}`);
  
  return driverName;
}

/**
 * Récupère le FilePath d'un profil depuis AutoSaveSettings
 */
async function getFilePathFromProfile(displayName) {
  const profile = await getProfileByDisplayName(displayName);
  if (!profile) {
    throw new Error(`Profil "${displayName}" non trouvé`);
  }
  
  // Extraire le FilePath depuis AutoSaveSettings
  if (profile.AutoSaveSettings && 
      profile.AutoSaveSettings[0] && 
      !profile.AutoSaveSettings[0].$ && 
      profile.AutoSaveSettings[0].FilePath) {
    return profile.AutoSaveSettings[0].FilePath[0];
  }
  
  return '$(DD)-$(MM)-$(YYYY)-$(n)';
}

// --- EXPORTS ---
module.exports = {
  addProfile,
  getAllProfiles,
  getProfileByDisplayName,
  updateProfileByDisplayName,
  deleteProfileByDisplayName,
  getDeletedProfiles,
  restoreProfile,
  getDriverNameByProfile,
  getFilePathFromProfile,
};