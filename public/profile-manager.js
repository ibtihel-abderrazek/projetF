// profile-manager.js - Gestionnaire principal des profils de scanner

import { ApiService } from './api-service.js';
import { Utils } from './utils.js';
import { FormManager } from './form-manager.js';
import { OcrConfigManager } from './ocr-config-manager.js';

/**
 * Gestionnaire principal pour les profils de scanner
 */
export class ProfileManager {
    constructor() {
        this.profiles = [];
        this.scanners = [];
        this.selectedProfile = null;
        this.isLoading = false;
        
        // Gestionnaires associés
        this.formManager = new FormManager();
        this.ocrConfigManager = new OcrConfigManager();
        this.popupManager = null; // Sera injecté
    }

    /**
     * Initialise le gestionnaire de profils
     */
    async init() {
        this.setupEventHandlers();
        await this.loadInitialData();
    }

    /**
     * Configure les gestionnaires d'événements
     */
    setupEventHandlers() {
        const buttons = {
            'btnRefresh': () => this.loadProfiles(),
            'btnAddProfile': () => this.showAddPopup(),
            'btnDetails': () => this.showDetails(),
            'btnEdit': () => this.showEditPopup(),
            'btnDelete': () => this.deleteProfile(),
            'btnScan': () => this.scanWithProfile(),
            'btnScanPatch': () => this.scanAndPatchWithProfile()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.removeEventListener('click', handler);
                btn.addEventListener('click', handler);
            }
        });

        this.setupFormHandlers();
        
        // Gestion du clic sur les cartes
        document.removeEventListener('click', this.handleCardClick);
        document.addEventListener('click', this.handleCardClick.bind(this));
    }

    /**
     * Configure les gestionnaires de formulaires
     */
    setupFormHandlers() {
        const forms = ['profileAddForm', 'profileEditForm'];
        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                const handler = (e) => {
                    e.preventDefault();
                    if (formId === 'profileAddForm') {
                        this.createProfile();
                    } else {
                        this.updateProfile();
                    }
                };
                form.removeEventListener('submit', handler);
                form.addEventListener('submit', handler);
            }
        });
    }

    /**
     * Gère les clics sur les cartes de profils
     */
    handleCardClick(e) {
        const card = e.target.closest('.scanner-card');
        if (card && card.dataset.profileName) {
            this.selectProfile(card.dataset.profileName);
        }
    }

    /**
     * Charge les données initiales
     */
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadProfiles(),
                this.loadScanners()
            ]);
        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
            Utils.showNotification('Erreur lors du chargement initial: ' + error.message, 'error');
        }
    }

    /**
     * Charge la liste des profils
     */
    async loadProfiles() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const grid = document.getElementById('scannersGrid');
        
        try {
            if (grid) grid.innerHTML = '<p class="loading-message">Chargement des profils...</p>';
            
            const response = await ApiService.getProfiles();
            
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors du chargement des profils');
            }
            
            this.profiles = response.profiles || [];
            this.renderProfiles();
            
        } catch (error) {
            console.error('Erreur chargement profils:', error);
            if (grid) grid.innerHTML = `<p class="error-message">❌ Erreur: ${error.message}</p>`;
            Utils.showNotification('Impossible de charger les profils: ' + error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Charge la liste des scanners
     */
    async loadScanners() {
        try {
            const response = await ApiService.getScanners();
            if (response.success) {
                this.scanners = response.scanners || [];
            } else {
                console.warn('Impossible de charger la liste des scanners');
                this.scanners = [];
            }
        } catch (error) {
            console.warn('Erreur lors du chargement des scanners:', error);
            this.scanners = [];
        }
    }

    /**
     * Affiche les profils dans la grille
     */
    renderProfiles() {
        const grid = document.getElementById('scannersGrid');
        if (!grid) {
            console.warn("⚠️ scannersGrid introuvable dans le DOM !");
            return;
        }

        if (!this.profiles || this.profiles.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">Aucun profil trouvé</div>
                </div>
            `;
            return;
        }

        const profileCards = this.profiles.map(profileName => this.createProfileCard(profileName)).join('');
        grid.innerHTML = profileCards;
        
        if (this.selectedProfile) {
            const card = grid.querySelector(`[data-profile-name="${this.selectedProfile}"]`);
            if (card) {
                card.classList.add('selected');
            } else {
                this.selectedProfile = null;
                this.updateButtonStates();
            }
        }
    }

    /**
     * Crée une carte de profil HTML
     */
    createProfileCard(profileName) {
        const isSelected = this.selectedProfile === profileName;
        const selectedClass = isSelected ? 'selected' : '';
        
        return `
            <div class="scanner-card ${selectedClass}" 
                 data-profile-name="${Utils.escapeHtml(profileName)}" 
                 role="button" 
                 tabindex="0"
                 aria-label="Profil ${Utils.escapeHtml(profileName)}">
                 <center><img src="images.png" width="50" alt="Icône profil"></center>
                 <p class="scanner-name">${Utils.escapeHtml(profileName)}</p>
            </div>
        `;
    }

    /**
     * Sélectionne un profil
     */
    selectProfile(profileName) {
        const oldSelected = document.querySelector('.scanner-card.selected');
        if (oldSelected) {
            oldSelected.classList.remove('selected');
        }

        const newSelected = document.querySelector(`[data-profile-name="${profileName}"]`);
        if (newSelected) {
            newSelected.classList.add('selected');
            this.selectedProfile = profileName;
        } else {
            this.selectedProfile = null;
        }

        this.updateButtonStates();
        Utils.showNotification(`Profil "${profileName}" sélectionné`, 'info');
    }

    /**
     * Met à jour l'état des boutons selon la sélection
     */
    updateButtonStates() {
        const hasSelection = !!this.selectedProfile;
        
        const buttonsToToggle = ['btnDetails', 'btnEdit', 'btnDelete', 'btnScan', 'btnScanPatch'];
        buttonsToToggle.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !hasSelection;
                btn.classList.toggle('disabled', !hasSelection);
            }
        });
    }

    /**
     * Affiche la popup d'ajout de profil
     */
    async showAddPopup() {
        try {
            this.popupManager.show('addPopup', true);

            this.formManager.renderFormTab('general-tab', this.formManager.fieldConfigurations.general.fields, {}, this.scanners);
            this.formManager.renderFormTab('scan-tab', this.formManager.fieldConfigurations.scan.fields, {}, this.scanners);
            this.formManager.renderFormTab('advanced-tab', this.formManager.fieldConfigurations.advanced.fields, {}, this.scanners);
            this.formManager.renderFormTab('ocr-tab', this.formManager.fieldConfigurations.ocr.fields, {}, this.scanners);

            this.formManager.setupFieldDependencies('profileAddForm');

            setTimeout(() => {
                const firstInput = document.querySelector('#addPopup input[type="text"]');
                if (firstInput) firstInput.focus();
            }, 100);

        } catch (error) {
            console.error("Erreur lors de l'ouverture du popup:", error);
            Utils.showNotification("Erreur: " + error.message, "error");
        }
    }

/**
 * Normalise les données d'un profil venant du serveur
 */
normalizeProfileData(profileData) {
    const normalized = {};
    
    const extractValue = (value) => {
        if (Array.isArray(value) && value.length > 0) {
            if (typeof value[0] === 'object' && value[0].$ && value[0].$.hasOwnProperty('xsi:nil')) {
                return undefined;
            }
            return extractValue(value[0]);
        }
        
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        return value;
    };
    
    for (const [key, value] of Object.entries(profileData)) {
        if (key === 'Device' && typeof value === 'object') {
            // ✅ CORRECTION: Récupérer ID et Name depuis l'objet Device
            const deviceId = extractValue(value.ID);
            const deviceName = extractValue(value.Name);
            
            normalized['Device.ID'] = deviceId;
            normalized['Device.Name'] = deviceName;
            
            console.log(`📋 Device normalisé:`, {
                'Device.ID': deviceId,
                'Device.Name': deviceName
            });
        }
        else if (key === 'DeviceID') {
            normalized['Device.ID'] = extractValue(value);
        }
        else if (key === 'DeviceName') {
            normalized['Device.Name'] = extractValue(value);
        }
        // ✅ CORRECTION CRITIQUE: Toujours récupérer le DriverName du profil
        else if (key === 'DriverName') {
            const driverValue = extractValue(value);
            normalized['DriverName'] = driverValue || 'twain';
            console.log(`📋 DriverName normalisé: "${normalized['DriverName']}" (brut: "${driverValue}")`);
        }
        else if (key === 'AutoSaveSettings' && typeof value === 'object' && !Array.isArray(value)) {
            if (value.$ && value.$.hasOwnProperty('xsi:nil')) {
                continue;
            }
            for (const [subKey, subValue] of Object.entries(value)) {
                if (subKey !== '$') {
                    normalized[`AutoSaveSettings.${subKey}`] = extractValue(subValue);
                }
            }
        } else if (key === 'Caps') {
            continue;
        } else {
            normalized[key] = extractValue(value);
        }
    }
    
    // ✅ VÉRIFICATION FINALE: S'assurer que DriverName existe toujours
    if (!normalized.DriverName) {
        console.warn('⚠️ DriverName manquant après normalisation, utilisation de "twain" par défaut');
        normalized.DriverName = 'twain';
    }
    
    // ✅ NOUVELLE VÉRIFICATION: S'assurer que Device.Name existe
    if (!normalized['Device.Name'] && normalized.DeviceName) {
        normalized['Device.Name'] = normalized.DeviceName;
        console.log(`📋 Device.Name récupéré depuis DeviceName: "${normalized['Device.Name']}"`);
    }
    
    console.log(`📋 Données normalisées finales:`, {
        'Device.Name': normalized['Device.Name'],
        'Device.ID': normalized['Device.ID'],
        'DriverName': normalized.DriverName
    });
    
    return normalized;
}
 /**
 * Affiche la popup d'édition de profil (VERSION CORRIGÉE)
 */
async showEditPopup(profileName = null) {
    const target = profileName || this.selectedProfile;
    if (!target) {
        Utils.showNotification('Aucun profil sélectionné', 'warning');
        return;
    }

    try {
        const response = await ApiService.getProfile(target);
        if (!response.success) {
            throw new Error(response.error || 'Profil non trouvé');
        }

        // ✅ Normaliser les données du profil
        const normalizedProfile = this.normalizeProfileData(response.profile);
        const ocrConfig = await this.ocrConfigManager.loadConfig(target);
        const completeProfile = { ...normalizedProfile, ...ocrConfig };

        console.log('📋 === Ouverture de la popup d\'édition ===');
        console.log('📋 Données brutes du serveur:', response.profile);
        console.log('📋 Profil normalisé:', normalizedProfile);
        console.log('📋 Config OCR:', ocrConfig);
        console.log('📋 Profil complet:', completeProfile);
        
        // ✅ VÉRIFICATION CRITIQUE: Afficher les valeurs qui seront utilisées
        console.log('📋 Valeurs critiques pour les selects:', {
            'DriverName': completeProfile.DriverName,
            'Device.Name': completeProfile['Device.Name'],
            'Device.ID': completeProfile['Device.ID']
        });

        this.popupManager.show('editPopup', true);
        
        // ✅ Attendre que la popup soit visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ✅ Rendre le formulaire avec les données complètes
        this.renderEditForm(completeProfile);
        
        // ✅ CRITIQUE: Attendre que le DOM soit complètement rendu
        setTimeout(() => {
            console.log('🔧 Configuration des dépendances de champs...');
            
            // ✅ Vérifier que les valeurs sont bien dans le formulaire
            const form = document.getElementById('profileEditForm');
            if (form) {
                const driverSelect = form.querySelector('[name="DriverName"]');
                const deviceSelect = form.querySelector('[name="Device.Name"]');
                
                console.log('📋 Vérification des valeurs dans le DOM:', {
                    'driverSelect.value': driverSelect?.value,
                    'deviceSelect.value': deviceSelect?.value
                });
            }
            
            // Configurer les dépendances de champs
            this.formManager.setupFieldDependencies('profileEditForm');
            this.formManager.debugFieldVisibility('profileEditForm');
            
            if (form) {
                const useNativeUI = form.querySelector('[name="UseNativeUI"]');
                if (useNativeUI && !useNativeUI.checked) {
                    this.forceShowHiddenFields(form);
                }
                
                // Trigger tous les événements de changement pour initialiser l'état
                form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    const event = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(event);
                });
            }
            
            console.log('✅ Configuration terminée');
        }, 400); // ✅ Augmenter le délai pour laisser le temps au filtrage
        
    } catch (error) {
        console.error('Erreur ouverture édition:', error);
        Utils.showNotification('Erreur: ' + error.message, 'error');
    }
}

    /**
     * Crée un nouveau profil
     */
    async createProfile() {
    try {
        console.log('Début création profil...');
        
        const formData = this.formManager.collectFormData('profileAddForm');
        console.log('📋 Données formulaire collectées:', formData);
        
        if (!formData.DisplayName) {
            throw new Error('Le nom du profil est obligatoire');
        }

        // Gestion de Device.Name et Device.ID
        let deviceName = formData['Device.Name'];
        let deviceId = formData['Device.ID'];
        
        if (formData.Device && typeof formData.Device === 'object') {
            if (!deviceName && formData.Device.Name) {
                deviceName = formData.Device.Name;
            }
            if (!deviceId && formData.Device.ID) {
                deviceId = formData.Device.ID;
            }
            delete formData.Device;
        }
        
        if (deviceName) {
            formData['Device.Name'] = deviceName;
        }
        if (deviceId) {
            formData['Device.ID'] = deviceId;
        }
        
        // Vérification et ajout de Device.ID si Device.Name est présent mais pas Device.ID
        if (formData['Device.Name'] && !formData['Device.ID']) {
            const scanner = this.scanners.find(s => s.name === formData['Device.Name']);
            if (scanner) {
                formData['Device.ID'] = scanner.name;
            }
        }

        // NOUVEAU: S'assurer que DriverName est défini
        if (!formData.DriverName) {
            formData.DriverName = 'twain'; // Valeur par défaut
        }

        // Créer la config OCR AVANT la séparation
        const serverConfig = this.ocrConfigManager.formDataToServerConfig(formData.DisplayName, formData);

        // Maintenant séparer les données
        const { ocrData, profileData } = this.ocrConfigManager.separateOcrData(formData);
        console.log('📋 Données séparées - Profil:', profileData, 'OCR:', ocrData);

        this.formManager.addHiddenFieldDefaults(profileData, this.scanners);

        const response = await ApiService.createProfile(profileData);
        console.log('📋 Réponse création profil:', response);
        
        if (!response.success) {
            throw new Error(response.error || 'Erreur lors de la création');
        }

        // Sauvegarder la config OCR si nécessaire
        if (this.ocrConfigManager.hasOcrConfig(ocrData)) {
            try {
                console.log('Configuration OCR détectée, sauvegarde...', serverConfig);
                await this.ocrConfigManager.saveConfig(formData.DisplayName, serverConfig);
                console.log('Configuration OCR sauvegardée avec succès');
            } catch (ocrError) {
                console.error('Erreur sauvegarde OCR:', ocrError);
                Utils.showNotification(`Profil créé mais erreur OCR: ${ocrError.message}`, 'warning');
            }
        } else {
            console.log('Aucune configuration OCR active détectée');
        }

        this.popupManager.hide('addPopup', true);
        Utils.showNotification('Profil créé avec succès', 'success');
        await this.loadProfiles();
        
    } catch (error) {
        console.error('Erreur création profil:', error);
        Utils.showNotification(`Erreur lors de la création: ${error.message}`, 'error');
    }
}

    /**
     * Met à jour un profil existant
     */
    async updateProfile() {
    if (!this.selectedProfile) {
        Utils.showNotification('Aucun profil sélectionné', 'warning');
        return;
    }

    try {
        console.log('Début mise à jour profil...');
        
        const formData = this.formManager.collectFormData('profileEditForm');
        console.log('📋 Données formulaire collectées:', formData);
        
        const oldProfileName = this.selectedProfile;
        const newProfileName = formData.DisplayName;
        const profileNameChanged = oldProfileName !== newProfileName;
        
        // Gestion de Device.Name et Device.ID
        let deviceName = formData['Device.Name'];
        let deviceId = formData['Device.ID'];
        
        if (formData.Device && typeof formData.Device === 'object') {
            if (!deviceName && formData.Device.Name) {
                deviceName = formData.Device.Name;
            }
            if (!deviceId && formData.Device.ID) {
                deviceId = formData.Device.ID;
            }
            delete formData.Device;
        }
        
        if (deviceName) {
            formData['Device.Name'] = deviceName;
        }
        if (deviceId) {
            formData['Device.ID'] = deviceId;
        }
        
        if (formData['Device.Name'] && !formData['Device.ID']) {
            const scanner = this.scanners.find(s => s.name === formData['Device.Name']);
            if (scanner) {
                formData['Device.ID'] = scanner.name;
            }
        }
        
        // NOUVEAU: S'assurer que DriverName est défini
        if (!formData.DriverName) {
            formData.DriverName = 'twain';
        }
        
        const serverConfig = this.ocrConfigManager.formDataToServerConfig(newProfileName, formData);
        const { ocrData, profileData } = this.ocrConfigManager.separateOcrData(formData);
        console.log('📋 Données séparées - Profil:', profileData, 'OCR:', ocrData);

        this.formManager.addHiddenFieldDefaults(profileData, this.scanners);

        const response = await ApiService.updateProfile(oldProfileName, profileData);
        console.log('📋 Réponse mise à jour profil:', response);
        
        if (!response.success) {
            throw new Error(response.error || 'Erreur lors de la mise à jour');
        }

        if (profileNameChanged) {
            console.log(`🔄 Renommage du profil détecté: "${oldProfileName}" → "${newProfileName}"`);
            
            try {
                const oldOcrConfig = await this.ocrConfigManager.loadConfig(oldProfileName);
                
                if (oldOcrConfig && this.ocrConfigManager.hasOcrConfig(oldOcrConfig)) {
                    console.log('Configuration OCR existante trouvée, renommage en cours...');
                    await this.ocrConfigManager.renameConfig(oldProfileName, newProfileName, serverConfig);
                    console.log('✅ Configuration OCR renommée avec succès');
                    Utils.showNotification(`Profil et configuration OCR renommés avec succès`, 'success');
                } else {
                    console.log('Aucune configuration OCR à renommer');
                }
            } catch (renameError) {
                console.warn('Erreur lors du renommage de la config OCR:', renameError);
                Utils.showNotification(
                    `Profil renommé mais attention: ${renameError.message}`, 
                    'warning'
                );
            }
        }

        if (this.ocrConfigManager.hasOcrConfig(ocrData)) {
            try {
                console.log('Configuration OCR détectée pour mise à jour...', serverConfig);
                await this.ocrConfigManager.saveConfig(newProfileName, serverConfig);
                console.log('Configuration OCR mise à jour avec succès');
            } catch (ocrError) {
                console.error('Erreur mise à jour OCR:', ocrError);
                Utils.showNotification(`Profil mis à jour mais erreur OCR: ${ocrError.message}`, 'warning');
            }
        }

        this.popupManager.hide('editPopup', true);
        
        if (!profileNameChanged) {
            Utils.showNotification('Profil mis à jour avec succès', 'success');
        }
        
        this.selectedProfile = newProfileName;
        await this.loadProfiles();
        
        if (this.selectedProfile) {
            const card = document.querySelector(`[data-profile-name="${this.selectedProfile}"]`);
            if (card) {
                card.classList.add('selected');
            }
        }
        
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        Utils.showNotification(`Erreur lors de la mise à jour: ${error.message}`, 'error');
    }
}

    /**
     * Supprime un profil
     */
    async deleteProfile(profileName = null) {
        const target = profileName || this.selectedProfile;
        if (!target) {
            Utils.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }
        
        if (!confirm(`Voulez-vous vraiment supprimer le profil "${target}" ?\n\nCette action est irréversible.`)) {
            return;
        }
        
        try {
            const response = await ApiService.deleteProfile(target);
            if (!response.success) {
                throw new Error(response.error || 'Erreur lors de la suppression');
            }
            
            await this.ocrConfigManager.deleteConfig(target);
            
            if (this.selectedProfile === target) {
                this.selectedProfile = null;
                this.updateButtonStates();
            }
            
            Utils.showNotification('Profil supprimé avec succès', 'success');
            await this.loadProfiles();  
            
        } catch (error) {
            //console.error('Erreur suppression profil:', error);
            Utils.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    /**
     * Lance un scan avec le profil sélectionné
     */

async scanWithProfile() {
    if (!this.selectedProfile) {
        Utils.showNotification('Aucun profil sélectionné', 'warning');
        return;
    }

    const importZone = document.getElementById('importZone');
    if (!importZone) {
        console.error('Zone d\'import introuvable');
        return;
    }

    try {
        importZone.innerHTML = `
            <p>📂 Glissez-déposez un fichier ici ou utilisez les boutons ci-dessous</p>
            <div class="import-buttons">
                <button id="btnUnifiedProcessing" class="btn-success" disabled>⚙️ Traitement</button>
                <button id="btnGeneratePatch" class="btn-info">🏷️ Générer Patch</button>
                <button id="btnImportFile" class="btn-primary">📂 Importer un fichier</button>
            </div>
            <div class="file-info" style="margin-top: 20px;">
                <p class="loading-message">⏳ Scan en cours avec le profil "${Utils.escapeHtml(this.selectedProfile)}"...</p>
            </div>
        `;
        
        Utils.showNotification(`Démarrage du scan avec le profil "${this.selectedProfile}"...`, 'info');
        
        const scanData = {
            profileName: this.selectedProfile,
            scan: "true",
            scanOnly: "true", // ✅ AJOUT : mode scan seul
            ocrMode: "false"
        };
        
        const scanResponse = await ApiService.call('/api/upload', 'POST', scanData);
        
        if (!scanResponse.success && !scanResponse.status) {
            throw new Error(scanResponse.error || 'Erreur lors du scan');
        }

        // ✅ VÉRIFICATION : Vérifier la structure de la réponse
        if (!scanResponse.files || !Array.isArray(scanResponse.files) || scanResponse.files.length === 0) {
            throw new Error('Aucun fichier retourné par le serveur');
        }

        const fileData = scanResponse.files[0];
        
        // ✅ CORRECTION : Utiliser directement le nom de fichier
        const fileName = fileData.name;
        
        if (!fileName) {
            throw new Error('Nom de fichier manquant dans la réponse');
        }
        
        console.log('📄 Fichier reçu:', fileName);
        
        // ✅ CONSTRUCTION SÉCURISÉE DE L'URL
        // Nettoyer le nom de fichier (enlever les chemins absolus si présents)
        const cleanFileName = fileName.includes('\\') || fileName.includes('/') 
            ? fileName.split(/[\\/]/).pop() 
            : fileName;
        
        console.log('📄 Nom nettoyé:', cleanFileName);
        
        // Construire l'URL avec vérification
        const fileUrl = `/output/${encodeURIComponent(cleanFileName)}`;
        console.log('🔗 URL construite:', fileUrl);
        
        // ✅ AFFICHAGE DU RÉSULTAT
        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>Scan réussi</h3>
                <p>Fichier scanné: ${Utils.escapeHtml(fileName)}</p>
                <button id="newProcessingBtnScan" class="btn-info" style="
                    padding: 8px 15px; background-color: #17a2b8; color: white; border: none;
                    border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                ">Nouveau scan</button>
            </div>
            <div style="margin-bottom:20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                <h4>📄 ${Utils.escapeHtml(fileName)}</h4>
                <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="downloadBtnScan" class="btn-primary" style="
                        padding: 10px 20px; background-color: #28a745; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Télécharger</button>
                    <button id="previewBtnScan" class="btn-warning" style="
                        padding: 10px 20px; background-color: #007bff; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Visualiser</button>
                </div>
                <div id="previewDivScan" style="display: none; margin-top: 15px;">
                    <h5>Aperçu PDF:</h5>
                    <iframe src="${fileUrl}" width="100%" height="600px" style="border:1px solid #ccc; border-radius: 4px;"></iframe>
                </div>
            </div>
        `;

        // Gestionnaire téléchargement
        const downloadBtn = document.getElementById('downloadBtnScan');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                window.location.href = fileUrl;
                Utils.showNotification('Téléchargement démarré', 'success');
            });
        }

        // Gestionnaire visualisation
        const previewBtn = document.getElementById('previewBtnScan');
        const previewDiv = document.getElementById('previewDivScan');
        if (previewBtn && previewDiv) {
            previewBtn.addEventListener('click', () => {
                const isVisible = previewDiv.style.display !== 'none';
                previewDiv.style.display = isVisible ? 'none' : 'block';
                previewBtn.innerHTML = isVisible ? 'Visualiser' : 'Fermer';
            });
        }

        // Gestionnaire nouveau traitement
        const newProcessingBtn = document.getElementById('newProcessingBtnScan');
        if (newProcessingBtn) {
            newProcessingBtn.addEventListener('click', () => location.reload());
        }

        Utils.showNotification('Scan terminé avec succès!', 'success');

    } catch (error) {
        console.error('Erreur lors du scan:', error);
        
        importZone.innerHTML = `
            <p>📂 Glissez-déposez un fichier ici ou utilisez les boutons ci-dessous</p>
            <div class="import-buttons">
                <button id="btnUnifiedProcessing" class="btn-success" disabled>⚙️ Traitement</button>
                <button id="btnGeneratePatch" class="btn-info">🏷️ Générer Patch</button>
                <button id="btnImportFile" class="btn-primary">📂 Importer un fichier</button>
            </div>
            <div style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin-top: 20px;">
                <p>Erreur Scan : ${Utils.escapeHtml(error.message)}</p>
                <button onclick="location.reload()" 
                        class="btn-primary" 
                        style="padding: 8px 15px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    Réessayer
                </button>
            </div>
        `;
        
        Utils.showNotification(`Erreur: ${error.message}`, 'error');
        
        if (window.appManager && window.appManager.fileUploadManager) {
            window.appManager.fileUploadManager.attachEventHandlers();
        }
    }
}
/**
 * Lance un scan et traitement Patch automatique
 */
async scanAndPatchWithProfile() {
    if (!this.selectedProfile) {
        Utils.showNotification('Aucun profil sélectionné', 'warning');
        return;
    }

    const importZone = document.getElementById('importZone');
    if (!importZone) {
        console.error('Zone d\'import introuvable');
        return;
    }

    try {
        importZone.innerHTML = `
            <p>📂 Glissez-déposez un fichier ici ou utilisez les boutons ci-dessous</p>
            <div class="import-buttons">
                <button id="btnUnifiedProcessing" class="btn-success" disabled>⚙️ Traitement</button>
                <button id="btnGeneratePatch" class="btn-info">🏷️ Générer Patch</button>
                <button id="btnImportFile" class="btn-primary">📂 Importer un fichier</button>
            </div>
            <div class="file-info" style="margin-top: 20px;">
                <p class="loading-message">⏳ Scan & Patch en cours avec le profil "${Utils.escapeHtml(this.selectedProfile)}"...</p>
            </div>
        `;
        
        Utils.showNotification(`Démarrage du scan & patch avec le profil "${this.selectedProfile}"...`, 'info');
        
        const ocrConfig = await this.ocrConfigManager.loadConfig(this.selectedProfile);
        const hasPatchEnabled = ocrConfig.OcrPatchMode === true || ocrConfig.OcrPatchMode === 'true';
        
        if (!hasPatchEnabled) {
            console.warn('⚠️ Le profil ne contient pas de configuration patch, utilisation des valeurs par défaut');
            ocrConfig.OcrPatchMode = true;
            ocrConfig.PatchMode = ocrConfig.PatchMode || 'T_classique';
            ocrConfig.OcrPatchNaming = ocrConfig.OcrPatchNaming || 'Numéro_séquentiel';
        }

        const scanData = {
            profileName: this.selectedProfile,
            scan: "true",
            containsPatch: "true",
            patchMode: ocrConfig.PatchMode || 'T_classique',
            naming: ocrConfig.OcrPatchNaming || 'Numéro_séquentiel',
            namingPattern: ocrConfig.OcrNamingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
            ocrMode: String(ocrConfig.OcrMode !== false),
            lang: ocrConfig.OcrLang || 'fra',
            modeOcr: ocrConfig.ModeOcr || 'Standard',
            pdfMode: ocrConfig.OcrPdfMode || 'PDF/A-1b',
            dpi: "300"
        };

        const response = await ApiService.call('/api/upload', 'POST', scanData);
        
        if (!response.success && !response.status) {
            throw new Error(response.error || 'Erreur lors du scan et du traitement Patch');
        }

        // ✅ NOUVEAU FORMAT : style traitement unifié
        if (response.status === "success" && response.files && Array.isArray(response.files)) {
            const fileCount = response.files.length;
            
            importZone.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3>Traitement réussi (${fileCount} fichier(s))</h3>
                    <p>${response.message || 'Fichiers traités avec succès'}</p>
                    <button id="newProcessingBtnPatch" class="btn-info" style="
                        padding: 8px 15px; background-color: #17a2b8; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Nouveau traitement</button>
                </div>
            `;

            response.files.forEach((file, i) => {
                const fileUrl = `/output/${encodeURIComponent(file.name)}`;
                const uniqueId = `patch_${i}_${Date.now()}`;
                
                const fileSection = document.createElement('div');
                fileSection.style.cssText = `
                    margin-bottom: 30px; padding: 15px; border: 1px solid #ddd;
                    border-radius: 8px; background-color: #f9f9f9;
                `;

                fileSection.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">Fichier ${i + 1}: ${Utils.escapeHtml(file.name)}</h4>
                        ${file.size ? `<p><strong>Taille:</strong> ${(file.size / 1024).toFixed(2)} KB</p>` : ''}
                    </div>
                    <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="download-patch-${uniqueId}" style="
                            padding: 8px 15px; background-color: #28a745; color: white; border: none;
                            border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                        ">Télécharger</button>
                        <button class="preview-patch-${uniqueId}" style="
                            padding: 8px 15px; background-color: #007bff; color: white; border: none;
                            border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                        ">Visualiser</button>
                    </div>
                    <div class="preview-patch-content-${uniqueId}" style="display: none;"></div>
                `;

                const downloadBtn = fileSection.querySelector(`.download-patch-${uniqueId}`);
                const previewBtn = fileSection.querySelector(`.preview-patch-${uniqueId}`);
                const previewContent = fileSection.querySelector(`.preview-patch-content-${uniqueId}`);

                if (downloadBtn) {
                    downloadBtn.addEventListener('click', () => {
                        window.location.href = fileUrl;
                        Utils.showNotification(`Téléchargement de "${file.name}" démarré`, 'success');
                    });
                }

                if (previewBtn && previewContent) {
                    previewBtn.addEventListener('click', () => {
                        if (previewContent.style.display === 'none') {
                            previewContent.innerHTML = `
                                <div style="margin-top: 15px;">
                                    <h5>Aperçu PDF:</h5>
                                    <iframe src="${fileUrl}" style="width: 100%; height: 600px; border: 1px solid #ccc; border-radius: 4px;"></iframe>
                                </div>
                            `;
                            previewContent.style.display = 'block';
                            previewBtn.innerHTML = 'Fermer';
                        } else {
                            previewContent.style.display = 'none';
                            previewBtn.innerHTML = 'Visualiser';
                        }
                    });
                }

                importZone.appendChild(fileSection);
            });

            // Gestionnaire nouveau traitement
            const newProcessingBtn = document.getElementById('newProcessingBtnPatch');
            if (newProcessingBtn) {
                newProcessingBtn.addEventListener('click', () => location.reload());
            }

            Utils.showNotification(`Scan & Patch terminés! ${fileCount} fichier(s) généré(s).`, 'success');
            
        } else if (response.fileName || response.outputFileName) {
            const fileName = response.fileName || response.outputFileName;
            const fileUrl = `/output/${encodeURIComponent(fileName)}`;
            
            importZone.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3>Traitement réussi (1 fichier(s))</h3>
                    <p>Scan & Patch terminé</p>
                    <button id="newProcessingBtnPatch" class="btn-info" style="
                        padding: 8px 15px; background-color: #17a2b8; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Nouveau traitement</button>
                </div>
                <div style="margin-bottom:20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                    <h4>Fichier 1: ${Utils.escapeHtml(fileName)}</h4>
                    <p style="color: #f59e0b;">ℹ️ Aucun code-barres Patch détecté ou un seul document</p>
                    <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                        <button id="downloadBtnPatch" class="btn-primary" style="
                            padding: 10px 20px; background-color: #28a745; color: white; border: none;
                            border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                        ">Télécharger</button>
                        <button id="previewBtnPatch" class="btn-warning" style="
                            padding: 10px 20px; background-color: #007bff; color: white; border: none;
                            border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                        ">Visualiser</button>
                    </div>
                    <div id="previewDivPatch" style="display: none; margin-top: 15px;">
                        <h5>Aperçu PDF:</h5>
                        <iframe src="${fileUrl}" width="100%" height="600px" style="border:1px solid #ccc; border-radius: 4px;"></iframe>
                    </div>
                </div>
            `;

            const downloadBtn = document.getElementById('downloadBtnPatch');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    window.location.href = fileUrl;
                    Utils.showNotification('Téléchargement démarré', 'success');
                });
            }

            const previewBtn = document.getElementById('previewBtnPatch');
            const previewDiv = document.getElementById('previewDivPatch');
            if (previewBtn && previewDiv) {
                previewBtn.addEventListener('click', () => {
                    const isVisible = previewDiv.style.display !== 'none';
                    previewDiv.style.display = isVisible ? 'none' : 'block';
                    previewBtn.innerHTML = isVisible ? 'Visualiser' : 'Fermer';
                });
            }

            const newProcessingBtn = document.getElementById('newProcessingBtnPatch');
            if (newProcessingBtn) {
                newProcessingBtn.addEventListener('click', () => location.reload());
            }

            Utils.showNotification('Scan & Patch terminés!', 'success');
        }

        if (window.appManager && window.appManager.fileUploadManager) {
            window.appManager.fileUploadManager.attachEventHandlers();
        }

    } catch (error) {
        console.error('❌ Erreur Scan & Patch:', error);
        
        importZone.innerHTML = `
            <p>📂 Glissez-déposez un fichier ici ou utilisez les boutons ci-dessous</p>
            <div class="import-buttons">
                <button id="btnUnifiedProcessing" class="btn-success" disabled>⚙️ Traitement</button>
                <button id="btnGeneratePatch" class="btn-info">🏷️ Générer Patch</button>
                <button id="btnImportFile" class="btn-primary">📂 Importer un fichier</button>
            </div>
            <div style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin-top: 20px;">
                <p>Erreur Scan & Patch : ${Utils.escapeHtml(error.message)}</p>
                <button onclick="location.reload()" 
                        class="btn-primary" 
                        style="padding: 8px 15px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    Réessayer
                </button>
            </div>
        `;
        
        Utils.showNotification(`Erreur: ${error.message}`, 'error');
        
        if (window.appManager && window.appManager.fileUploadManager) {
            window.appManager.fileUploadManager.attachEventHandlers();
        }
    }
}

    /**
     * Construit les données Patch à partir du profil
     */
    buildPatchDataFromProfile(ocrConfig, scannedFilePath) {
        return {
            filePath: scannedFilePath,
            containsPatch: true,
            patchMode: ocrConfig.PatchMode === 'T_with_bookmarks' ? 'T_with_bookmarks' : 'T_classique',
            naming: ocrConfig.OcrPatchNaming || CONFIG.OCR.DEFAULT_PATCH_NAMING,
            ocrMode: ocrConfig.OcrMode || false,
            modeOcr: ocrConfig.ModeOcr || CONFIG.OCR.DEFAULT_MODE_OCR,  
            lang: ocrConfig.OcrLang || CONFIG.OCR.DEFAULT_LANG,
            pdfMode: ocrConfig.OcrPdfMode || CONFIG.OCR.DEFAULT_PDF_MODE
        };
    }

    /**
     * Rend le formulaire d'édition
     */
    renderEditForm(profileData) {
        this.renderEditTab('editGeneralContent', this.formManager.fieldConfigurations.general.fields, profileData);
        this.renderEditTab('editScanContent', this.formManager.fieldConfigurations.scan.fields, profileData);
        this.renderEditTab('editAdvancedContent', this.formManager.fieldConfigurations.advanced.fields, profileData);
        this.renderEditTab('editOcrContent', this.formManager.fieldConfigurations.ocr.fields, profileData);
    }

/**
 * Rend un onglet d'édition avec toutes les corrections (VERSION FINALE)
 */
renderEditTab(containerId, fields, data) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`❌ Container ${containerId} not found`);
        return;
    }

    console.log(`📋 === Rendu de l'onglet ${containerId} ===`);
    console.log(`📋 Données reçues:`, {
        'Device.Name': data['Device.Name'],
        'Device.ID': data['Device.ID'],
        'DriverName': data.DriverName,
        'DeviceName': data.DeviceName,
        'Device objet': data.Device
    });

    // ✅ NOUVEAU: Extraire le DriverName dès le début pour l'utiliser partout
    const profileDriverName = data.DriverName || data['DriverName'] || 'twain';
    console.log(`📋 DriverName du profil: "${profileDriverName}"`);

    let html = '';
    Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
        let fieldValue = Utils.getNestedValue(data, fieldName);
        
        console.log(`📋 Traitement du champ "${fieldName}":`, {
            'valeur initiale': fieldValue,
            'type': typeof fieldValue,
            'config': fieldConfig
        });
        
        // ✅ CORRECTION SPÉCIALE pour DriverName
        if (fieldName === 'DriverName') {
            fieldValue = profileDriverName;
            console.log(`  ✅ DriverName final: "${fieldValue}"`);
        }
        
        // ✅ CORRECTION SPÉCIALE pour Device.Name
        if (fieldName === 'Device.Name') {
            if (!fieldValue) {
                // Essayer depuis l'objet Device
                if (data.Device) {
                    if (typeof data.Device === 'object') {
                        fieldValue = data.Device.Name || data.Device.name;
                    } else if (typeof data.Device === 'string') {
                        fieldValue = data.Device;
                    }
                }
            }
            
            // Sinon depuis les champs racine
            if (!fieldValue) {
                fieldValue = data.DeviceName || data['Device.Name'];
            }
            
            console.log(`  ✅ Device.Name final: "${fieldValue}"`);
        }
        
        // ✅ CORRECTION SPÉCIALE pour Device.ID
        if (fieldName === 'Device.ID') {
            if (!fieldValue) {
                // Essayer depuis l'objet Device
                if (data.Device) {
                    if (typeof data.Device === 'object') {
                        fieldValue = data.Device.ID || data.Device.id;
                    }
                }
            }
            
            // Sinon depuis les champs racine
            if (!fieldValue) {
                fieldValue = data.DeviceID || data['Device.ID'];
            }
            
            console.log(`  ✅ Device.ID final: "${fieldValue}"`);
        }
        
        // Utiliser la valeur par défaut si aucune valeur n'existe
        if ((fieldValue === undefined || fieldValue === null || fieldValue === '') && fieldConfig.default) {
            console.log(`  📋 Utilisation de la valeur par défaut: "${fieldConfig.default}"`);
            fieldValue = fieldConfig.default;
        }
        
        // Synchronisation FilePath avec OcrNamingPattern
        if (fieldName === 'AutoSaveSettings.FilePath' && !fieldValue && data.OcrNamingPattern) {
            fieldValue = data.OcrNamingPattern;
            console.log(`  📋 Synchronisation FilePath <- OcrNamingPattern: "${fieldValue}"`);
        }
        
        // ✅ CRITIQUE: Créer un objet fieldData avec TOUTES les données nécessaires
        const fieldData = { ...data }; // Copier toutes les données
        
        // Ajouter/remplacer la valeur du champ actuel
        if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            let current = fieldData;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {};
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = fieldValue;
        } else {
            fieldData[fieldName] = fieldValue;
        }
        
        // ✅ S'assurer que DriverName est toujours présent dans fieldData
        if (!fieldData.DriverName) {
            fieldData.DriverName = profileDriverName;
        }
        
        // ✅ LOG FINAL: Afficher la valeur qui sera utilisée par createField
        console.log(`  🎯 Valeur finale pour createField: "${fieldValue}"`);
        
        // Créer le champ HTML avec les données complètes
        html += `<div class="form-group">${this.formManager.createField(fieldName, fieldConfig, fieldData, this.scanners)}</div>`;
    });
    
    console.log(`✅ Rendu HTML de l'onglet ${containerId} terminé`);
    container.innerHTML = html;
    
    // ✅ NOUVEAU: Vérifier immédiatement après le rendu
    setTimeout(() => {
        const driverSelect = container.querySelector('select[name="DriverName"]');
        const deviceSelect = container.querySelector('select[name="Device.Name"]');
        
        console.log('📋 Vérification post-rendu:', {
            'driverSelect.value': driverSelect?.value,
            'deviceSelect.value': deviceSelect?.value,
            'deviceSelect.selectedOptions': deviceSelect?.selectedOptions?.[0]?.textContent
        });
    }, 50);
}


    /**
     * Force l'affichage de champs cachés (mode édition)
     */
    forceShowHiddenFields(form) {
        const fieldsToShow = [
            'Resolution', 'BitDepth', 'Quality', 'PaperSource', 'PageSize', 
            'PageAlign', 'AutoDeskew', 'Brightness', 'Contrast', 'RotateDegrees', 
            'TwainProgress', 'BrightnessContrastAfterScan'
        ];
        
        this.formManager.forceShowFields(form, fieldsToShow);
    }

    /**
     * Affiche les détails d'un profil
     */
    showDetails() {
        if (!this.selectedProfile) {
            Utils.showNotification('Aucun profil sélectionné', 'warning');
            return;
        }
        Utils.showNotification('Fonction détails non implémentée', 'info');
    }

    /**
     * Injecte le gestionnaire de popups
     */
    setPopupManager(popupManager) {
        this.popupManager = popupManager;
    }

    /**
     * Nettoie les ressources
     */
    cleanup() {
        this.ocrConfigManager.cleanup();
        Utils.cleanupBlobUrls();
    }
}

// Export par défaut ET nommé pour compatibilité
export default ProfileManager;