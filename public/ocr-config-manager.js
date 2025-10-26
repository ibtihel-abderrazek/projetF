// ocr-config-manager.js - Gestionnaire de configuration OCR et Patch

import { ApiService } from './api-service.js';
import { CONFIG } from './config.js';

/**
 * Gestionnaire pour les configurations OCR et Patch
 */
export class OcrConfigManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 secondes
    }

    /**
     * Sauvegarde une configuration OCR
     */
    async saveConfig(profileName, ocrData) {
        try {
            // Gérer les deux formats possibles : objet direct ou données séparées
            let config;
            
            if (ocrData.profileName) {
                // Format déjà préparé par ProfileManager
                config = ocrData;
            } else {
                // Format des données brutes du formulaire - les convertir
                config = {
                    profileName: profileName,
                    ocrMode: this.normalizeBoolean(ocrData.OcrMode),
                    lang: ocrData.OcrLang || CONFIG.OCR.DEFAULT_LANG,
                    namingPattern: ocrData.OcrNamingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
                    pdfMode: ocrData.OcrPdfMode || CONFIG.OCR.DEFAULT_PDF_MODE,
                    modeOcr: ocrData.ModeOcr || CONFIG.OCR.DEFAULT_MODE_OCR,
                    patchEnabled: this.normalizeBoolean(ocrData.OcrPatchMode),
                    patchNaming: ocrData.OcrPatchNaming || CONFIG.OCR.DEFAULT_PATCH_NAMING
                };
                
                // Mapper PatchMode vers patchType (nom attendu par le serveur)
                if (ocrData.PatchMode) {
                    const validPatchTypes = CONFIG.OCR.PATCH_TYPES.map(type => type.value);
                    const patchType = ocrData.PatchMode;
                    
                    if (validPatchTypes.includes(patchType)) {
                        config.patchType = patchType;
                    } else {
                        console.warn(`PatchMode invalide: "${patchType}", utilisation de ${CONFIG.OCR.DEFAULT_PATCH_TYPE} par défaut`);
                        config.patchType = CONFIG.OCR.DEFAULT_PATCH_TYPE;
                    }
                } else {
                    config.patchType = CONFIG.OCR.DEFAULT_PATCH_TYPE;
                }
            }

            console.log('Configuration OCR à sauvegarder:', config);

            const response = await ApiService.saveOcrConfig(config);
            console.log('Configuration OCR sauvegardée:', response);
            
            // Invalider le cache pour ce profil
            this.invalidateCache(profileName);
            
            return response;
        } catch (error) {
            console.error('Erreur sauvegarde OCR:', error);
            throw error;
        }
    }

/**
 * Renomme une configuration OCR
 * @param {string} oldProfileName - Ancien nom du profil
 * @param {string} newProfileName - Nouveau nom du profil
 * @param {Object} updatedConfig - Configuration mise à jour (optionnel)
 */
async renameConfig(oldProfileName, newProfileName, updatedConfig = null) {
    try {
        console.log(`🔄 Renommage config OCR: "${oldProfileName}" → "${newProfileName}"`);
        
        // Charger l'ancienne configuration
        let config;
        try {
            config = await this.loadConfig(oldProfileName);
        } catch (error) {
            console.log('Aucune configuration OCR existante à renommer');
            return { success: true, message: 'Aucune configuration OCR à renommer' };
        }
        
        // Utiliser la config mise à jour si fournie, sinon utiliser l'ancienne
        const configToSave = updatedConfig || this.formDataToServerConfig(newProfileName, config);
        
        // S'assurer que le nouveau nom de profil est correct
        configToSave.profileName = newProfileName;
        
        // Sauvegarder sous le nouveau nom
        await this.saveConfig(newProfileName, configToSave);
        console.log(`✅ Configuration OCR sauvegardée sous "${newProfileName}"`);
        
        // Supprimer l'ancienne configuration
        await this.deleteConfig(oldProfileName);
        console.log(`🗑️ Ancienne configuration OCR "${oldProfileName}" supprimée`);
        
        // Invalider les caches
        this.invalidateCache(oldProfileName);
        this.invalidateCache(newProfileName);
        
        return { 
            success: true, 
            message: `Configuration OCR renommée de "${oldProfileName}" à "${newProfileName}"` 
        };
        
    } catch (error) {
        console.error('Erreur lors du renommage de la config OCR:', error);
        throw new Error(`Impossible de renommer la configuration OCR: ${error.message}`);
    }
}

/**
 * Vérifie si une configuration OCR existe pour un profil
 * @param {string} profileName - Nom du profil
 * @returns {Promise<boolean>}
 */
async configExists(profileName) {
    try {
        await this.loadConfig(profileName);
        return true;
    } catch (error) {
        return false;
    }
}
    /**
     * Charge une configuration OCR
     */
    async loadConfig(profileName) {
        try {
            // Vérifier le cache
            const cached = this.getFromCache(profileName);
            if (cached) {
                return cached;
            }

            const config = await ApiService.getOcrConfig(profileName);
            
            const mappedConfig = {
                OcrMode: config.ocrMode,
                OcrLang: config.lang,
                OcrNamingPattern: config.namingPattern,
                OcrPdfMode: config.pdfMode,
                OcrPatchMode: config.patchEnabled,
                ModeOcr: config.modeOcr || CONFIG.OCR.DEFAULT_MODE_OCR,  
                OcrPatchNaming: config.patchNaming,
                PatchMode: config.patchType || config.patchMode
            };

            // Mettre en cache
            this.setCache(profileName, mappedConfig);
            
            return mappedConfig;
        } catch (error) {
            console.warn('Aucune configuration OCR trouvée pour', profileName);
            return this.getDefaultConfig();
        }
    }

    /**
     * Supprime une configuration OCR
     */
    async deleteConfig(profileName) {
        try {
            const result = await ApiService.deleteOcrConfig(profileName);
            this.invalidateCache(profileName);
            return result;
        } catch (error) {
            console.warn('Erreur suppression config OCR:', error);
            return { success: false };
        }
    }

    /**
     * Récupère les stratégies Patch disponibles
     */
    async getPatchStrategies() {
        try {
            return await ApiService.getPatchStrategies();
        } catch (error) {
            console.warn('Erreur chargement stratégies Patch, utilisation des valeurs par défaut:', error);
            return CONFIG.OCR.PATCH_STRATEGIES;
        }
    }
    async getOcrModes() {
        try {
            return CONFIG.OCR.OCR_MODES;
        } catch (error) {
            console.warn('Erreur chargement modes OCR:', error);
            return [
                { value: 'auto', label: 'Automatique' },
                { value: 'force', label: 'Forcer' },
                { value: 'skip', label: 'Ignorer' }
            ];
        }
    }
    /**
     * Valide une configuration OCR
     */
    validateOcrConfig(config) {
        const errors = [];
        const warnings = [];

        // Validation de la langue
        if (config.OcrLang && !['', 'fra', 'eng', 'ara'].includes(config.OcrLang)) {
            warnings.push(`Langue OCR "${config.OcrLang}" non standard`);
        }

        // Validation du mode PDF
        if (config.OcrPdfMode && !['pdf', 'pdfa'].includes(config.OcrPdfMode)) {
            errors.push(`Mode PDF "${config.OcrPdfMode}" invalide`);
        }
        if (config.ModeOcr && !['auto', 'force', 'skip'].includes(config.ModeOcr)) {
            errors.push(`Mode OCR "${config.ModeOcr}" invalide. Valeurs autorisées: auto, force, skip`);
        }
        // Validation de la stratégie Patch
        if (config.OcrPatchNaming && !this.isValidPatchStrategy(config.OcrPatchNaming)) {
            errors.push(`Stratégie Patch "${config.OcrPatchNaming}" invalide`);
        }

        // Validation du mode Patch
        const validPatchTypes = CONFIG.OCR.PATCH_TYPES.map(type => type.value);
        if (config.PatchMode && !validPatchTypes.includes(config.PatchMode)) {
            errors.push(`Mode de traitement Patch "${config.PatchMode}" invalide. Valeurs autorisées: ${validPatchTypes.join(', ')}`);
        }

        // Validation de cohérence
        if (config.OcrPatchMode === true && !config.OcrPatchNaming) {
            warnings.push('Mode Patch activé mais aucune stratégie de nommage définie');
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    /**
     * Vérifie si une stratégie Patch est valide
     */
    isValidPatchStrategy(strategy) {
        const validStrategies = CONFIG.OCR.PATCH_STRATEGIES.map(s => s.value);
        return validStrategies.includes(strategy);
    }
    isValidModeOcr(modeOcr) {
        const validModes = CONFIG.OCR.OCR_MODES.map(m => m.value);
        return validModes.includes(modeOcr);
    }
    /**
     * Crée une configuration par défaut
     */
    createDefaultConfig(profileName) {
    return {
        profileName: profileName,
        ocrMode: false,
        lang: CONFIG.OCR.DEFAULT_LANG,
        namingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
        pdfMode: CONFIG.OCR.DEFAULT_PDF_MODE,
        patchEnabled: false,
        modeOcr: CONFIG.OCR.DEFAULT_MODE_OCR,
        patchNaming: CONFIG.OCR.DEFAULT_PATCH_NAMING,
        patchType: CONFIG.OCR.DEFAULT_PATCH_TYPE,
        pdfaOnly: false  // ← NOUVEAU
    };
}

    /**
     * Retourne une configuration par défaut mappée pour le frontend
     */
    getDefaultConfig() {
    return {
        OcrMode: false,
        OcrLang: CONFIG.OCR.DEFAULT_LANG,
        OcrPdfMode: CONFIG.OCR.DEFAULT_PDF_MODE,
        OcrPatchMode: false,
        ModeOcr: CONFIG.OCR.DEFAULT_MODE_OCR,
        OcrPatchNaming: CONFIG.OCR.DEFAULT_PATCH_NAMING,
        PatchMode: CONFIG.OCR.DEFAULT_PATCH_TYPE,
        PdfaOnly: false  // ← NOUVEAU
    };
}

    /**
     * Migre une ancienne configuration vers le nouveau format
     */
    migrateConfig(oldConfig) {
        const migratedConfig = { ...oldConfig };
        
        if (!migratedConfig.hasOwnProperty('patchEnabled')) {
            migratedConfig.patchEnabled = false;
        }
        
        if (!migratedConfig.hasOwnProperty('patchNaming')) {
            migratedConfig.patchNaming = CONFIG.OCR.DEFAULT_PATCH_NAMING;
        }
        if (!migratedConfig.hasOwnProperty('modeOcr')) {
            migratedConfig.modeOcr = CONFIG.OCR.DEFAULT_MODE_OCR;
        }
        if (!migratedConfig.hasOwnProperty('patchType')) {
            migratedConfig.patchType = CONFIG.OCR.DEFAULT_PATCH_TYPE;
        }
        
        return migratedConfig;
    }

    /**
     * Normalise une valeur booléenne
     */
    normalizeBoolean(value) {
        return value === true || value === 'true' || value === 'on';
    }

    /**
 * Sépare les données OCR des données de profil
 */
separateOcrData(formData) {
    const ocrFields = [
        'OcrMode', 'OcrLang', 'OcrPdfMode', 'ModeOcr', 
        'OcrPatchMode', 'OcrPatchNaming', 'PatchMode',
        'OcrNamingPattern',
        'PdfaOnly'  // ← NOUVEAU
    ];
    
    const ocrData = {};
    const profileData = { ...formData };
    
    ocrFields.forEach(field => {
        if (formData.hasOwnProperty(field)) {
            let value = formData[field];
            
            if (field === 'OcrMode' || field === 'OcrPatchMode' || field === 'PdfaOnly') {
                value = this.normalizeBoolean(value);
            }
            
            ocrData[field] = value;
            delete profileData[field];
        }
    });
    
    return { ocrData, profileData };
}

    /**
     * Vérifie si des données OCR sont configurées
     */
    hasOcrConfig(ocrData) {
        return (
            ocrData.OcrMode === true || 
            ocrData.OcrMode === 'true' ||
            ocrData.OcrPatchMode === true ||
            ocrData.OcrPatchMode === 'true' ||
            (ocrData.OcrLang && ocrData.OcrLang !== CONFIG.OCR.DEFAULT_LANG) ||
            (ocrData.OcrPdfMode && ocrData.OcrPdfMode !== CONFIG.OCR.DEFAULT_PDF_MODE) ||
            (ocrData.ModeOcr && ocrData.ModeOcr !== CONFIG.OCR.DEFAULT_MODE_OCR) ||
            (ocrData.OcrPatchNaming && ocrData.OcrPatchNaming !== CONFIG.OCR.DEFAULT_PATCH_NAMING) ||
            (ocrData.PatchMode && ocrData.PatchMode !== CONFIG.OCR.DEFAULT_PATCH_TYPE)
        );
    }

    /**
     * Gestion du cache
     */
    setCache(profileName, config) {
        this.cache.set(profileName, {
            config,
            timestamp: Date.now()
        });
    }

    getFromCache(profileName) {
        const cached = this.cache.get(profileName);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.config;
        }
        return null;
    }

    invalidateCache(profileName) {
        if (profileName) {
            this.cache.delete(profileName);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Convertit les données du formulaire en configuration serveur
     */
 formDataToServerConfig(profileName, formData) {
    let namingPattern = formData.OcrNamingPattern;
    
    if (!namingPattern && formData.AutoSaveSettings?.FilePath) {
        namingPattern = formData.AutoSaveSettings.FilePath;
    }
    
    if (!namingPattern) {
        namingPattern = '$(DD)-$(MM)-$(YYYY)-$(n)';
    }
    
    return {
        profileName: profileName,
        ocrMode: this.normalizeBoolean(formData.OcrMode),
        lang: formData.OcrLang || CONFIG.OCR.DEFAULT_LANG,
        pdfMode: formData.OcrPdfMode || CONFIG.OCR.DEFAULT_PDF_MODE,
        modeOcr: formData.ModeOcr || CONFIG.OCR.DEFAULT_MODE_OCR,
        patchEnabled: this.normalizeBoolean(formData.OcrPatchMode),
        patchNaming: formData.OcrPatchNaming || CONFIG.OCR.DEFAULT_PATCH_NAMING,
        patchType: formData.PatchMode || CONFIG.OCR.DEFAULT_PATCH_TYPE,
        namingPattern: namingPattern,
        pdfaOnly: this.normalizeBoolean(formData.PdfaOnly)  // ← NOUVEAU
    };
}

    /**
     * Convertit les données serveur en données formulaire
     */
    serverConfigToFormData(serverConfig) {
    return {
        OcrMode: serverConfig.ocrMode,
        OcrLang: serverConfig.lang,
        OcrPdfMode: serverConfig.pdfMode,
        OcrPatchMode: serverConfig.patchEnabled,
        ModeOcr: serverConfig.modeOcr || CONFIG.OCR.DEFAULT_MODE_OCR,
        OcrPatchNaming: serverConfig.patchNaming,
        PatchMode: serverConfig.patchType || serverConfig.patchMode,
        OcrNamingPattern: serverConfig.namingPattern,
        PdfaOnly: serverConfig.pdfaOnly || false  // ← NOUVEAU
    };
}

    /**
     * Nettoie le cache et les ressources
     */
    cleanup() {
        this.cache.clear();
    }

    /**
     * Retourne des statistiques sur le cache
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
            timeout: this.cacheTimeout
        };
    }
}

// Export par défaut ET nommé pour compatibilité
export default OcrConfigManager;