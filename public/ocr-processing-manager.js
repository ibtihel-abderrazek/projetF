// ocr-processing-manager.js - Gestionnaire de traitement OCR et Patch unifié

import { ApiService } from './api-service.js';
import { Utils } from './utils.js';
import { OcrConfigManager } from './ocr-config-manager.js';

/**
 * Gestionnaire pour le traitement OCR et Patch unifié
 */
export class OcrProcessingManager {
    constructor() {
        this.importedFile = null;
        this.importedFiles = [];
        this.cachedProfileConfig = null;
        this.ocrConfigManager = new OcrConfigManager();
        this.popupManager = null;
        this.profileManager = null;
        this.newProcessingClickHandler = null;
        
        this.init();
    }

    // ==================== INITIALISATION ====================

    init() {
        this.setupDragAndDrop();
        this.setupFileImport();
        this.setupUnifiedProcessing();
        this.setupGeneratePatch();
        this.setupScanIntegration();
        this.setupNewProcessingButtons();
        this.loadImportedFiles();
        this.exposeGlobalFunctions();
    }

    setPopupManager(popupManager) {
        this.popupManager = popupManager;
    }

    setProfileManager(profileManager) {
        this.profileManager = profileManager;
    }

    // ==================== CONFIGURATION ====================

    async getSelectedProfileOcrConfig() {
        try {
            if (!this.profileManager || !this.profileManager.selectedProfile) {
                console.log('Aucun profil sélectionné');
                return this.getDefaultOcrPatchConfig();
            }

            const profileName = this.profileManager.selectedProfile;
            console.log(`Récupération configuration pour le profil: ${profileName}`);

            if (this.cachedProfileConfig && 
                this.cachedProfileConfig.profileName === profileName &&
                Date.now() - this.cachedProfileConfig.timestamp < 30000) {
                console.log('Utilisation du cache de configuration');
                return this.cachedProfileConfig.config;
            }

            const ocrConfig = await this.loadOcrConfigFromProfile(profileName);
            
            this.cachedProfileConfig = {
                profileName: profileName,
                config: ocrConfig,
                timestamp: Date.now()
            };

            console.log('Configuration récupérée:', ocrConfig);
            return ocrConfig;

        } catch (error) {
            console.error('Erreur lors de la récupération de la configuration:', error);
            return this.getDefaultOcrPatchConfig();
        }
    }

    async loadOcrConfigFromProfile(profileName) {
        try {
            const config = await this.ocrConfigManager.loadConfig(profileName);
            
            let profileData = null;
            
            if (this.profileManager && this.profileManager.profiles) {
                profileData = this.profileManager.profiles.find(p => p.name === profileName);
            }
            
            if (!profileData) {
                try {
                    const response = await ApiService.getProfile(profileName);
                    profileData = response.data || response;
                } catch (error) {
                    console.warn('Impossible de charger le profil complet:', error);
                }
            }
            
            let profileDpi = '300';
            let profileFilePath = '$(DD)-$(MM)-$(YYYY)-$(n)';
            
            if (profileData) {
                const actualProfile = profileData.profile || profileData;
                
                let resolution = actualProfile.Resolution;
                if (Array.isArray(resolution) && resolution.length > 0) {
                    resolution = resolution[0];
                }
                
                if (resolution) {
                    const resolutionMatch = String(resolution).match(/Dpi(\d+)/i);
                    if (resolutionMatch) {
                        profileDpi = resolutionMatch[1];
                    } else if (!isNaN(resolution)) {
                        profileDpi = String(resolution);
                    }
                }
                
                let autoSaveSettings = actualProfile.AutoSaveSettings;
                if (Array.isArray(autoSaveSettings) && autoSaveSettings.length > 0) {
                    autoSaveSettings = autoSaveSettings[0];
                }
                
                if (autoSaveSettings && autoSaveSettings.FilePath) {
                    let filePath = autoSaveSettings.FilePath;
                    if (Array.isArray(filePath) && filePath.length > 0) {
                        filePath = filePath[0];
                    }
                    if (filePath) {
                        profileFilePath = String(filePath);
                    }
                }
            }
            
            const pdfMode = config.OcrPdfMode || 'pdfa';
            const modeOcr = config.ModeOcr || 'auto';
            console.log(`Profil ${profileName} - DPI: ${profileDpi}, FilePath: ${profileFilePath}, PdfMode: ${pdfMode} (depuis config OCR)`);
            
            return {
                profileName: profileName,
                language: config.OcrLang || 'fra',
                confidence: '80',
                dpi: profileDpi,
                preprocessImage: 'true',
                enhanceContrast: 'true',
                removeNoise: 'false',
                autoRotate: 'true',
                ocrMode: config.OcrMode || false,
                namingPattern: profileFilePath,
                modeOcr: modeOcr,
                pdfMode: pdfMode,
                patchMode: config.PatchMode || 'T_classique',
                patchNaming: config.OcrPatchNaming || 'barcode_ocr_generic',
                patchEnabled: config.OcrPatchMode || false,
                splitByBarcode: config.OcrPatchMode ? 'true' : 'false',
                barcodePosition: 'top-right',
                outputFormat: 'pdf',
                includeOriginalPages: 'false'
            };
        } catch (error) {
            console.warn('Erreur lors de la récupération de la configuration:', error);
            return this.getDefaultOcrPatchConfig();
        }
    }

    getDefaultOcrPatchConfig() {
        return {
            language: 'fra',
            confidence: '80',
            dpi: '300',
            preprocessImage: 'true',
            enhanceContrast: 'true',
            removeNoise: 'false',
            autoRotate: 'true',
            ocrMode: false,
            namingPattern: '$(DD)-$(MM)-$(YYYY)-$(n)',
            pdfMode: 'pdfa',
            modeOcr: 'auto',
            patchMode: 'T_classique',
            patchNaming: 'barcode_ocr_generic',
            patchEnabled: false,
            splitByBarcode: 'false',
            barcodePosition: 'top-right',
            outputFormat: 'pdf',
            includeOriginalPages: 'false',
            pdfaOnly: false
        };
    }

    invalidateProfileConfigCache() {
        this.cachedProfileConfig = null;
        console.log('Cache de configuration profil invalidé');
    }

    // ==================== GESTION DES FICHIERS ====================

    setupDragAndDrop() {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        importZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            importZone.classList.add("dragover");
        });
        
        importZone.addEventListener("dragleave", (e) => {
            e.preventDefault();
            importZone.classList.remove("dragover");
        });
        
        importZone.addEventListener("drop", (e) => {
            e.preventDefault();
            importZone.classList.remove("dragover");
            if (e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    setupFileImport() {
        const fileInput = document.getElementById("fileInput");
        const btnImportFile = document.getElementById("btnImportFile");

        if (btnImportFile && fileInput) {
            btnImportFile.addEventListener("click", () => fileInput.click());
            
            fileInput.addEventListener("change", () => {
                if (fileInput.files.length) {
                    this.handleFile(fileInput.files[0]);
                }
            });
        }
    }

    handleFile(file) {
        const validation = Utils.validateFile(file);
        if (!validation.valid) {
            Utils.showNotification(validation.error, 'error');
            return;
        }

        this.importedFile = file;
        const importedFileName = document.getElementById("importedFileName");
        const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
        
        if (importedFileName) {
            importedFileName.innerText = `Fichier importé : ${file.name}`;
        }
        
        if (btnUnifiedProcessing) {
            btnUnifiedProcessing.disabled = false;
        }

        this.createFilePreview(file);
    }

    createFilePreview(file) {
        const url = URL.createObjectURL(file);
        const importZone = document.getElementById("importZone");
        
        if (!importZone) return;

        let preview = importZone.querySelector('.file-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'file-preview';
            importZone.appendChild(preview);
        }
        
        preview.innerHTML = `<iframe src="${url}" width="100%" height="400" style="border:1px solid #ccc; border-radius: 4px;"></iframe>`;
    }

    async loadImportedFiles() {
        const importedFilesList = document.getElementById("importedFilesList");
        if (!importedFilesList) return;

        try {
            const response = await ApiService.getImportedFiles();
            
            importedFilesList.innerHTML = '';
            
            if (response.success && response.files.length) {
                response.files.forEach(file => {
                    const fileItem = this.createImportedFileItem(file);
                    importedFilesList.appendChild(fileItem);
                });
            } else {
                importedFilesList.innerHTML = '<p>Aucun fichier importé trouvé</p>';
            }
        } catch (err) {
            console.error("Erreur chargement fichiers importés:", err);
            importedFilesList.innerHTML = '<p>Erreur de chargement</p>';
        }
    }

    createImportedFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'imported-file-item';
        fileItem.style.cssText = `
            padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;
            background-color: #f9f9f9; display: flex; justify-content: space-between; align-items: center;
        `;

        const fileInfo = document.createElement('div');
        fileInfo.innerHTML = `
            <strong>${file.name}</strong>
            <br>
            <small>Taille: ${this.formatFileSize(file.size)} | Date: ${this.formatDate(file.date)}</small>
        `;

        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 5px;';

        const useBtn = document.createElement('button');
        useBtn.textContent = 'Utiliser';
        useBtn.className = 'btn-primary';
        useBtn.style.cssText = `
            padding: 5px 10px; background-color: #007bff; color: white;
            border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
        `;
        useBtn.addEventListener('click', () => this.useImportedFile(file));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.className = 'btn-danger';
        deleteBtn.style.cssText = `
            padding: 5px 10px; background-color: #dc3545; color: white;
            border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
        `;
        deleteBtn.addEventListener('click', () => this.deleteImportedFile(file.name));

        actionsDiv.appendChild(useBtn);
        actionsDiv.appendChild(deleteBtn);
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(actionsDiv);

        return fileItem;
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        if (!dateString) return 'Date inconnue';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    async useImportedFile(file) {
        try {
            const response = await fetch(file.path);
            const blob = await response.blob();
            const fileObj = new File([blob], file.name, { type: 'application/pdf' });
            this.handleFile(fileObj);
            Utils.showNotification(`Fichier "${file.name}" chargé`, 'success');
        } catch (err) {
            console.error('Erreur chargement fichier:', err);
            Utils.showNotification('Erreur lors du chargement du fichier', 'error');
        }
    }

    async deleteImportedFile(fileName) {
        if (!confirm(`Voulez-vous vraiment supprimer "${fileName}" ?`)) return;

        try {
            await ApiService.deleteImportedFile(fileName);
            Utils.showNotification('Fichier supprimé avec succès', 'success');
            await this.loadImportedFiles();
        } catch (err) {
            console.error('Erreur suppression fichier:', err);
            Utils.showNotification('Erreur lors de la suppression', 'error');
        }
    }

    // ==================== SCAN ====================

    setupScanIntegration() {
        const btnScan = document.getElementById("btnScan");
        if (btnScan) {
            btnScan.addEventListener("click", () => this.handleScanClick());
        }
    }

    async handleScanClick() {
        const selectedProfile = this.profileManager?.selectedProfile;
        
        if (!selectedProfile) {
            Utils.showNotification("Veuillez sélectionner un profil avant de scanner.", 'warning');
            return;
        }

        await this.scanWithProfile(selectedProfile);
    }

    async scanWithProfile(profileName) {
        const btnScan = document.getElementById("btnScan");
        
        if (btnScan) {
            btnScan.disabled = true;
            btnScan.textContent = "Scan en cours...";
        }
        
        try {
            const formData = new FormData();
            formData.append("scan", "true");
            formData.append("profileName", profileName);
            formData.append("ocrMode", "false");
            
            const response = await ApiService.processFile(formData);
            
            if (response instanceof Response) {
                const contentType = response.headers.get("content-type");
                
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();
                    if (!data.success && data.error) throw new Error(data.error);
                    Utils.showNotification("Scan terminé avec succès", 'success');
                } else {
                    const blob = await response.blob();
                    
                    const contentDisposition = response.headers.get('content-disposition');
                    let fileName = 'document_scanne.pdf';
                    if (contentDisposition && contentDisposition.includes('filename=')) {
                        fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
                    }
                    
                    this.importedFile = new File([blob], fileName, { type: blob.type });
                    
                    const importedFileName = document.getElementById("importedFileName");
                    const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
                    
                    if (importedFileName) importedFileName.innerText = `Fichier scanné : ${fileName}`;
                    if (btnUnifiedProcessing) btnUnifiedProcessing.disabled = false;

                    this.createFilePreview(this.importedFile);
                    Utils.showNotification("Fichier scanné avec succès et prêt pour traitement", 'success');
                }
            }

        } catch (err) {
            console.error("Erreur scan:", err);
            Utils.showNotification("Erreur scan : " + err.message, 'error');
        } finally {
            if (btnScan) {
                btnScan.disabled = false;
                btnScan.textContent = "Scanner";
            }
        }
    }

    // ==================== GÉNÉRATION PATCH ====================

    setupGeneratePatch() {
        const btnGeneratePatch = document.getElementById("btnGeneratePatch");
        const generatePatchForm = document.getElementById("generatePatchForm");

        if (btnGeneratePatch) {
            btnGeneratePatch.addEventListener("click", () => this.openGeneratePatchDialog());
        }

        if (generatePatchForm) {
            generatePatchForm.addEventListener("submit", (e) => this.processGeneratePatch(e));
        }
    }

    openGeneratePatchDialog() {
        if (this.popupManager) this.popupManager.show("generatePatchPopup");
    }

    async processGeneratePatch(e) {
        e.preventDefault();

        if (this.popupManager) this.popupManager.hide("generatePatchPopup");
        
        const importZone = document.getElementById("importZone");
        if (importZone) importZone.innerHTML = `<p>Génération du patch en cours...</p>`;

        const formData = new FormData(e.target);
        const patchData = formData.get('patchData');

        if (!patchData) {
            Utils.showNotification("Veuillez saisir le texte du patch.", 'error');
            return;
        }

        try {
            const result = await ApiService.generatePatch(patchData);
            
            if (result.status === "success" && result.results) {
                await this.handleGeneratedPatch(result);
            } else {
                throw new Error(result.message || result.error || "Erreur lors de la génération du patch");
            }

        } catch (err) {
            console.error("Erreur génération patch:", err);
            this.showProcessingError("Génération Patch", err.message);
        }
    }

    async handleGeneratedPatch(result) {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>Patch généré avec succès</h3>
                <button id="newProcessingBtnPatch" class="btn-info" style="padding: 8px 15px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Nouveau traitement
                </button>
            </div>
        `;

        result.results.forEach((patchData, i) => {
            const patchSection = this.createPatchSection(patchData, i);
            importZone.appendChild(patchSection);
        });
    }

    createPatchSection(patchData, index) {
        const patchSection = document.createElement('div');
        patchSection.style.cssText = `
            margin-bottom: 30px; padding: 15px; border: 1px solid #ddd;
            border-radius: 8px; background-color: #f9f9f9;
        `;

        const patchUrl = `data:application/pdf;base64,${patchData.base64}`;
        const uniqueId = `patch_${index}_${Date.now()}`;

        patchSection.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">${patchData.name}</h4>
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="download-patch-${uniqueId}" style="
                    padding: 8px 15px; background-color: #28a745; color: white; border: none;
                    border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                ">Télécharger Patch</button>
                <button class="preview-patch-${uniqueId}" style="
                    padding: 8px 15px; background-color: #007bff; color: white; border: none;
                    border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                ">Visualiser</button>
            </div>
            <div class="preview-patch-content-${uniqueId}" style="display: none;"></div>
        `;

        const downloadBtn = patchSection.querySelector(`.download-patch-${uniqueId}`);
        const previewBtn = patchSection.querySelector(`.preview-patch-${uniqueId}`);
        const previewContent = patchSection.querySelector(`.preview-patch-content-${uniqueId}`);

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = patchUrl;
                link.download = patchData.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Utils.showNotification(`Téléchargement de "${patchData.name}" démarré`, 'success');
            });
        }

        if (previewBtn && previewContent) {
            previewBtn.addEventListener('click', () => {
                if (previewContent.style.display === 'none') {
                    previewContent.innerHTML = `
                        <div style="margin-top: 15px;">
                            <h5>Aperçu du patch:</h5>
                            <iframe src="${patchUrl}" style="width: 100%; height: 600px; border: 1px solid #ccc; border-radius: 4px;"></iframe>
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

        return patchSection;
    }

    // ==================== TRAITEMENT UNIFIÉ ====================

    setupUnifiedProcessing() {
        const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
        const unifiedForm = document.getElementById("unifiedProcessingForm");

        if (btnUnifiedProcessing) {
            btnUnifiedProcessing.addEventListener("click", async () => {
                const shouldExecuteDirectly = await this.checkProfileAndExecuteUnified();
                if (!shouldExecuteDirectly) await this.openUnifiedDialog();
            });
        }

        if (unifiedForm) {
            unifiedForm.addEventListener("submit", (e) => this.processUnified(e));
        }
    }

    async checkProfileAndExecuteUnified() {
    if (!this.importedFile) {
        Utils.showNotification("Veuillez importer un fichier avant de lancer le traitement.", 'warning');
        return false;
    }

    if (!this.profileManager || !this.profileManager.selectedProfile) {
        console.log('Aucun profil sélectionné, ouverture de la popup unifiée');
        return false;
    }

    const profileName = this.profileManager.selectedProfile;
    console.log(`Profil sélectionné détecté: ${profileName}`);

    try {
        const config = await this.getSelectedProfileOcrConfig();
        
        let processingMode = 'none';
        
        // Vérifier si c'est un mode PDF/A seul
        if (config.pdfaOnly) {
            processingMode = 'pdfa';
        } else if (config.ocrMode && config.patchEnabled) {
            processingMode = 'both';
        } else if (config.ocrMode) {
            processingMode = 'ocr';
        } else if (config.patchEnabled) {
            processingMode = 'patch';
        }
        
        if (processingMode === 'none') {
            console.log('Aucun traitement activé dans le profil, ouverture de la popup');
            return false;
        }

        console.log(`Traitement automatique: ${processingMode}`);

        const importZone = document.getElementById("importZone");
        if (importZone) {
            const modeLabel = processingMode === 'pdfa' ? 'PDF/A' : processingMode;
            importZone.innerHTML = `<p>Traitement automatique (${modeLabel}) avec le profil "${profileName}"...</p>`;
        }
        
        const formData = this.createUnifiedFormDataFromConfig(config, processingMode);
        await this.executeUnifiedRequest(formData);
        
        return true;
        
    } catch (error) {
        console.error('Erreur lors de l\'exécution automatique:', error);
        this.showProcessingError("Traitement automatique", error.message);
        return true;
    }
}

    async openUnifiedDialog() {
    const unifiedPopup = document.getElementById("unifiedProcessingPopup");
    if (!unifiedPopup) {
        Utils.showNotification("Interface de traitement non disponible.", 'error');
        return;
    }

    try {
        unifiedPopup.style.display = "flex";
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'unifiedLoadingIndicator';
        loadingIndicator.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8); color: white; padding: 15px 25px;
            border-radius: 8px; z-index: 1002;
        `;
        loadingIndicator.innerHTML = 'Chargement des paramètres...';
        unifiedPopup.appendChild(loadingIndicator);

        const config = await this.getSelectedProfileOcrConfig();
        this.applyUnifiedConfigToForm(config);

        const indicator = document.getElementById('unifiedLoadingIndicator');
        if (indicator) indicator.remove();
        
        setTimeout(() => {
            this.initProcessingModeListeners();
            this.updateProcessingOptionsVisibility();
        }, 50);

    } catch (error) {
        console.error('Erreur lors de l\'ouverture du dialogue unifié:', error);
        const indicator = document.getElementById('unifiedLoadingIndicator');
        if (indicator) indicator.remove();
        Utils.showNotification('Erreur lors du chargement: ' + error.message, 'warning');
    }
}

    initProcessingModeListeners() {
        document.querySelectorAll('.processing-option').forEach(option => {
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);
            
            newOption.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                const mode = newOption.dataset.mode;
                if (mode) this.toggleProcessingMode(mode);
            });
        });

        document.querySelectorAll('.processing-option input[type="checkbox"]').forEach(checkbox => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            newCheckbox.addEventListener('change', () => {
                const option = newCheckbox.closest('.processing-option');
                option.classList.toggle('selected', newCheckbox.checked);
                this.updateProcessingOptionsVisibility();
            });
        });
        
        this.updateProcessingOptionsVisibility();
    }

    toggleProcessingMode(mode) {
        const checkbox = document.getElementById(mode + 'Mode');
        if (!checkbox) return;
        
        const option = checkbox.closest('.processing-option');
        checkbox.checked = !checkbox.checked;
        option.classList.toggle('selected', checkbox.checked);
        this.updateProcessingOptionsVisibility();
    }

    updateProcessingOptionsVisibility() {
    const ocrChecked = document.getElementById('ocrMode')?.checked || false;
    const patchChecked = document.getElementById('patchMode')?.checked || false;
    const pdfaOnlyChecked = document.getElementById('pdfaOnlyMode')?.checked || false;
    
    const ocrOptions = document.getElementById('ocrOptions');
    const patchOptions = document.getElementById('patchOptions');
    const pdfaOnlyOptions = document.getElementById('pdfaOnlyOptions');
    const pdfModeGroup = document.getElementById('pdfModeGroup');
    
    // Si PDF/A seul est activé
    if (pdfaOnlyChecked) {
        // Masquer toutes les autres options
        if (ocrOptions) ocrOptions.style.display = 'none';
        if (patchOptions) patchOptions.style.display = 'none';
        if (pdfaOnlyOptions) pdfaOnlyOptions.style.display = 'block';
        if (pdfModeGroup) pdfModeGroup.style.display = 'none';
        
        // Décocher OCR et Patch
        const ocrCheckbox = document.getElementById('ocrMode');
        const patchCheckbox = document.getElementById('patchMode');
        
        if (ocrCheckbox && ocrCheckbox.checked) {
            ocrCheckbox.checked = false;
            const ocrOption = ocrCheckbox.closest('.processing-option');
            if (ocrOption) ocrOption.classList.remove('selected');
        }
        
        if (patchCheckbox && patchCheckbox.checked) {
            patchCheckbox.checked = false;
            const patchOption = patchCheckbox.closest('.processing-option');
            if (patchOption) patchOption.classList.remove('selected');
        }
    } else {
        // Mode normal (OCR/Patch)
        if (ocrOptions) ocrOptions.style.display = ocrChecked ? 'block' : 'none';
        if (patchOptions) patchOptions.style.display = patchChecked ? 'block' : 'none';
        if (pdfaOnlyOptions) pdfaOnlyOptions.style.display = 'none';
        if (pdfModeGroup) pdfModeGroup.style.display = 'block';
    }
    
    // Désactiver les champs selon le mode
    const ocrFields = document.querySelectorAll('#ocrOptions select, #ocrOptions input');
    const patchFields = document.querySelectorAll('#patchOptions select, #patchOptions input');
    const pdfaFields = document.querySelectorAll('#pdfaOnlyOptions select, #pdfaOnlyOptions input');
    
    ocrFields.forEach(field => field.disabled = !ocrChecked || pdfaOnlyChecked);
    patchFields.forEach(field => field.disabled = !patchChecked || pdfaOnlyChecked);
    pdfaFields.forEach(field => field.disabled = !pdfaOnlyChecked);
}


    applyUnifiedConfigToForm(config) {
        const form = document.getElementById("unifiedProcessingForm");
        if (!form) {
            console.error('Formulaire unifié non trouvé');
            return;
        }

        console.log('Application de la configuration unifiée:', config);

        const ocrCheckbox = form.querySelector('#ocrMode');
        const patchCheckbox = form.querySelector('#patchMode');

        if (ocrCheckbox) {
            ocrCheckbox.checked = config.ocrMode;
            const ocrOption = ocrCheckbox.closest('.processing-option');
            if (ocrOption) ocrOption.classList.toggle('selected', config.ocrMode);
        }

        if (patchCheckbox) {
            patchCheckbox.checked = config.patchEnabled;
            const patchOption = patchCheckbox.closest('.processing-option');
            if (patchOption) patchOption.classList.toggle('selected', config.patchEnabled);
        }

        const fieldMappings = {
            'lang': config.language || '',
            'mode': config.pdfMode || 'pdfa',
            'patchMode': config.patchMode || 'T_classique',
            'modeOcr': config.modeOcr || 'auto',
            'naming': config.patchNaming || 'barcode_ocr_generic',
            'namingPattern': config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)',
        };

        Object.entries(fieldMappings).forEach(([fieldName, value]) => {
            const field = form.querySelector(`[name="${fieldName}"]`) || 
                         form.querySelector(`#unified${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`);
            if (field) {
                field.value = value || '';
            }
        });

        setTimeout(() => {
            this.initProcessingModeListeners();
            this.updateUnifiedPreview();
        }, 100);
    }

    async processUnified(e) {
    e.preventDefault();

    if (!this.importedFile) {
        Utils.showNotification("Aucun fichier importé.", 'error');
        return;
    }

    const ocrMode = document.getElementById('ocrMode')?.checked || false;
    const patchMode = document.getElementById('patchMode')?.checked || false;
    const pdfaOnlyMode = document.getElementById('pdfaOnlyMode')?.checked || false;

    if (!ocrMode && !patchMode && !pdfaOnlyMode) {
        Utils.showNotification("Veuillez sélectionner au moins un mode de traitement.", 'error');
        return;
    }

    const formData = new FormData(e.target);
    formData.append("file", this.importedFile);

    let processingMode = 'none';
    if (pdfaOnlyMode) {
        processingMode = 'pdfa';
    } else if (ocrMode && patchMode) {
        processingMode = 'both';
    } else if (ocrMode) {
        processingMode = 'ocr';
    } else if (patchMode) {
        processingMode = 'patch';
    }

    this.configureFormDataByMode(formData, processingMode, ocrMode, patchMode, pdfaOnlyMode);

    const unifiedPopup = document.getElementById("unifiedProcessingPopup");
    const importZone = document.getElementById("importZone");
    
    if (unifiedPopup) unifiedPopup.style.display = "none";
    
    let modeLabel = processingMode;
    if (processingMode === 'pdfa') modeLabel = 'PDF/A';
    if (importZone) importZone.innerHTML = `<p>Traitement ${modeLabel} en cours...</p>`;

    try {
        await this.executeUnifiedRequest(formData);
    } catch (err) {
        this.showProcessingError("Traitement unifié", err.message);
    }
}

    configureFormDataByMode(formData, mode, ocrMode, patchMode, pdfaOnlyMode = false) {
     // Mode PDF/A seul
    if (pdfaOnlyMode || mode === 'pdfa') {
        formData.set("ocrMode", "false");
        formData.set("containsPatch", "false");
        formData.set("pdfaOnly", "true");
        formData.set("pdfMode", "pdfa");
        formData.set("modeOcr", "skip");
        
        // FIX: Forcer le DPI à 300 pour le mode PDF/A
        formData.set("dpi", "300");
        console.log('📊 DPI PDF/A forcé à 300');
        
        return;
    }
    
    // Modes normaux (OCR/Patch)
    formData.set("ocrMode", ocrMode ? "true" : "false");
    formData.set("containsPatch", patchMode ? "true" : "false");
    formData.set("pdfaOnly", "false");
    
    if (!ocrMode) {
        formData.delete("lang");
        formData.delete("mode");
        formData.delete("pdfMode");
        formData.delete("modeOcr");
    }
    
    if (!patchMode) {
        formData.delete("patchMode");
        formData.delete("naming");
    }
    
    if (ocrMode) {
        if (!formData.get("lang")) formData.set("lang", "");
        if (!formData.get("mode")) formData.set("mode", "pdfa");
        if (!formData.get("pdfMode")) formData.set("pdfMode", "pdfa");
        if (!formData.get("modeOcr")) formData.set("modeOcr", "auto");
    }
    
    if (patchMode) {
        if (!formData.get("patchMode")) formData.set("patchMode", "T_classique");
        if (!formData.get("naming")) formData.set("naming", "barcode_ocr_generic");
    }
    
    if (!formData.get("namingPattern")) {
        formData.set("namingPattern", "$(YYYY)$(MM)$(DD)");
    }
}


    createUnifiedFormDataFromConfig(config, mode) {
    const formData = new FormData();
    
    formData.append("file", this.importedFile);
    const namingPattern = config.namingPattern || '$(DD)-$(MM)-$(YYYY)-$(n)';
    formData.append("namingPattern", namingPattern);
    
    console.log(`📋 Naming pattern envoyé au serveur: "${namingPattern}"`);
    
    if (config.dpi) {
        formData.append("dpi", config.dpi);
    }
    
    if (mode === 'pdfa') {
        formData.append("ocrMode", "false");
        formData.append("containsPatch", "false");
        formData.append("pdfaOnly", "true");
        formData.append("pdfMode", "pdfa");
        formData.append("modeOcr", "skip");
        
        // FIX: Forcer le DPI à 300 pour le mode PDF/A
        formData.append("dpi", "300");
        console.log('📊 Mode PDF/A - DPI forcé à 300');
        
        return formData;
    }
    
    // FIX: Pour les autres modes, ajouter le DPI si disponible
    if (config.dpi) {
        formData.append("dpi", config.dpi);
        console.log(`📊 DPI configuré depuis le profil: ${config.dpi}`);
    }
    
    // Autres modes
    switch(mode) {
        case 'ocr':
            formData.append("ocrMode", "true");
            formData.append("containsPatch", "false");
            formData.append("pdfaOnly", "false");
            formData.append("lang", config.language || '');
            formData.append("mode", config.pdfMode || 'pdfa');
            formData.append("pdfMode", config.pdfMode || 'pdfa');
            formData.append("modeOcr", config.modeOcr || 'auto');
            break;
            
        case 'patch':
            formData.append("ocrMode", "false");
            formData.append("containsPatch", "true");
            formData.append("pdfaOnly", "false");
            formData.append("patchMode", config.patchMode || 'T_classique');
            formData.append("naming", config.patchNaming || 'barcode_ocr_generic');
            break;
            
        case 'both':
            formData.append("ocrMode", "true");
            formData.append("containsPatch", "true");
            formData.append("pdfaOnly", "false");
            formData.append("lang", config.language || 'fra');
            formData.append("mode", config.pdfMode || 'pdfa');
            formData.append("pdfMode", config.pdfMode || 'pdfa');
            formData.append("modeOcr", config.modeOcr || 'auto'); 
            formData.append("patchMode", config.patchMode || 'T_classique');
            formData.append("naming", config.patchNaming || 'barcode_ocr_generic');
            break;
    }
    
    console.log('FormData créé - Mode:', mode);
    return formData;
}

    async executeUnifiedRequest(formData) {
        try {
            const response = await ApiService.processFile(formData);

            if (response instanceof Response) {
                const contentType = response.headers.get("content-type");
                
                if (contentType && contentType.includes("application/json")) {
                    const jsonData = await response.json();
                    await this.handleMultipleFiles(jsonData);
                } else {
                    await this.handleSingleFile(response);
                }
            } else {
                if (response.status === "success" && response.files) {
                    await this.handleMultipleFiles(response);
                } else {
                    throw new Error(response.message || "Erreur de traitement");
                }
            }

        } catch (err) {
            console.error("Erreur traitement unifié:", err);
            throw err;
        }
    }

    async handleSingleFile(response) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const importZone = document.getElementById("importZone");

        if (!importZone) return;

        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'resultat.pdf';
        if (contentDisposition && contentDisposition.includes('filename=')) {
            fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
        }

        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p>Traitement terminé avec succès</p>
            </div>
            <div style="margin-bottom:20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                <h4>${fileName}</h4>
                <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="downloadBtn" class="btn-primary" style="
                        padding: 10px 20px; background-color: #28a745; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Télécharger</button>
                    <button id="previewBtn" class="btn-warning" style="
                        padding: 10px 20px; background-color: #007bff; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Visualiser</button>
                    <button id="newProcessingBtn" class="btn-info" style="
                        padding: 10px 20px; background-color: #17a2b8; color: white; border: none;
                        border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                    ">Nouveau traitement</button>
                </div>
                <div id="previewDiv" style="display: none; margin-top: 15px;">
                    <iframe src="${url}" width="100%" height="600px" style="border:1px solid #ccc; border-radius: 4px;"></iframe>
                </div>
            </div>
        `;

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Utils.showNotification('Téléchargement démarré', 'success');
            });
        }

        const previewBtn = document.getElementById('previewBtn');
        const previewDiv = document.getElementById('previewDiv');

        if (previewBtn && previewDiv) {
            previewBtn.addEventListener('click', () => {
                const isVisible = previewDiv.style.display !== 'none';
                previewDiv.style.display = isVisible ? 'none' : 'block';
                previewBtn.innerHTML = isVisible ? 'Visualiser' : 'Fermer';
            });
        }
    }

    async handleMultipleFiles(result) {
        const importZone = document.getElementById("importZone");
        
        if (!importZone) return;
        
        if (result.status !== "success" || !result.files || result.files.length === 0) {
            throw new Error(result.message || "Aucun fichier retourné");
        }

        importZone.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>Traitement réussi (${result.files.length} fichier(s))</h3>
                <p>${result.message || 'Fichiers traités avec succès'}</p>
                <button id="newProcessingBtnMultiple" class="btn-info" style="
                    padding: 8px 15px; background-color: #17a2b8; color: white; border: none;
                    border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                ">Nouveau traitement</button>
            </div>
        `;

        result.files.forEach((fileData, i) => this.createFileSection(fileData, i));
    }

    createFileSection(fileData, index) {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        const fileSection = document.createElement('div');
        fileSection.style.cssText = `
            margin-bottom: 30px; padding: 15px; border: 1px solid #ddd;
            border-radius: 8px; background-color: #f9f9f9;
        `;

        if (!fileData.content) {
            fileSection.innerHTML = `
                <div style="padding:10px; border:1px solid #ff6b6b; background-color:#ffe0e0; border-radius: 4px;">
                    <h4>Fichier ${index + 1}: ${fileData.name}</h4>
                    <p>Fichier non trouvé ou inaccessible</p>
                </div>
            `;
            importZone.appendChild(fileSection);
            return;
        }

        const pdfUrl = `data:application/pdf;base64,${fileData.content}`;
        
        let additionalInfo = '';
        if (fileData.pages && fileData.pages.length > 0) {
            additionalInfo += `<p><strong>Pages:</strong> ${fileData.pages.join(', ')}</p>`;
        }
        if (fileData.barcode) {
            additionalInfo += `<p><strong>Code-barres détecté:</strong> ${fileData.barcode}</p>`;
        }

        const uniqueId = `file_${index}_${Date.now()}`;

        fileSection.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Fichier ${index + 1}: ${fileData.name}</h4>
                ${additionalInfo}
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="download-btn-${uniqueId}" style="
                    padding: 8px 15px; background-color: #28a745; color: white; border: none;
                    border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                ">Télécharger</button>
                <button class="preview-btn-${uniqueId}" style="
                    padding: 8px 15px; background-color: #007bff; color: white; border: none;
                    border-radius: 4px; cursor: pointer; transition: background-color 0.2s;
                ">Visualiser</button>
            </div>
            <div class="preview-content-${uniqueId}" style="display: none;"></div>
        `;

        const downloadBtn = fileSection.querySelector(`.download-btn-${uniqueId}`);
        const previewBtn = fileSection.querySelector(`.preview-btn-${uniqueId}`);
        const previewContent = fileSection.querySelector(`.preview-content-${uniqueId}`);

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = fileData.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Utils.showNotification(`Téléchargement de "${fileData.name}" démarré`, 'success');
            });
        }

        if (previewBtn && previewContent) {
            previewBtn.addEventListener('click', () => {
                if (previewContent.style.display === 'none') {
                    previewContent.innerHTML = `
                        <div style="margin-top: 15px;">
                            <h5>Aperçu PDF:</h5>
                            <iframe src="${pdfUrl}" width="100%" height="600px" style="border: 1px solid #ccc; border-radius: 4px;"></iframe>
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
    }

    // ==================== UTILITAIRES ====================

    updateUnifiedPreview() {
        const patternInput = document.getElementById('unifiedNamingPattern');
        const previewSpan = document.getElementById('unifiedPreview');
        
        if (!patternInput || !previewSpan) return;
        
        const pattern = patternInput.value;
        const preview = Utils.generateNamingPreview(pattern);
        previewSpan.textContent = preview || '(vide)';
    }

    showProcessingError(processType, message) {
        const importZone = document.getElementById("importZone");
        if (!importZone) return;

        importZone.innerHTML = `
            <div style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                <p>Erreur ${processType} : ${message}</p>
                <button onclick="location.reload()" 
                        class="btn-primary" 
                        style="padding: 8px 15px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    Réessayer
                </button>
            </div>
        `;
    }

    setupNewProcessingButtons() {
        if (this.newProcessingClickHandler) {
            document.removeEventListener('click', this.newProcessingClickHandler);
        }
        
        this.newProcessingClickHandler = (e) => {
            const target = e.target;
            if (target && (
                target.id === 'newProcessingBtn' || 
                target.id === 'newProcessingBtnMultiple' || 
                target.id === 'newProcessingBtnPatch'
            )) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Bouton nouveau traitement cliqué:', target.id);
                location.reload();
            }
        };
        
        document.addEventListener('click', this.newProcessingClickHandler, true);
    }

    reset() {
        this.importedFile = null;
        const importedFileName = document.getElementById("importedFileName");
        const btnUnifiedProcessing = document.getElementById("btnUnifiedProcessing");
        const importZone = document.getElementById("importZone");

        if (importedFileName) {
            importedFileName.innerText = '';
        }
        
        if (btnUnifiedProcessing) {
            btnUnifiedProcessing.disabled = true;
        }

        if (importZone) {
            importZone.innerHTML = `
                <p>Glissez-déposez un fichier ici ou utilisez les boutons ci-dessous</p>
                <input type="file" id="fileInput" hidden accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif">
                <div class="import-buttons">
                    <button id="btnUnifiedProcessing" class="btn-success" disabled>Traitement</button>
                    <button id="btnGeneratePatch" class="btn-info">Générer Patch</button>
                    <button id="btnImportFile" class="btn-primary">Importer un fichier</button>
                </div>
                <div id="importedFileName" class="file-info"></div>
            `;
            
            this.setupFileImport();
            this.setupGeneratePatch();
        }

        this.invalidateProfileConfigCache();
        console.log('Interface réinitialisée avec tous les boutons');
    }

    exposeGlobalFunctions() {
        window.closeUnifiedProcessingPopup = () => {
            if (this.popupManager) {
                this.popupManager.hide("unifiedProcessingPopup");
            }
        };

        window.closeGeneratePatchPopup = () => {
            if (this.popupManager) {
                this.popupManager.hide("generatePatchPopup");
            }
        };

        window.toggleProcessingMode = (mode) => this.toggleProcessingMode(mode);

        window.addToUnifiedPattern = (code) => {
            const input = document.getElementById('unifiedNamingPattern');
            if (!input) return;
            
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            input.value = value.substring(0, start) + code + value.substring(end);
            const newPos = start + code.length;
            input.setSelectionRange(newPos, newPos);
            input.focus();
            this.updateUnifiedPreview();
        };

        window.clearUnifiedPattern = () => {
            const input = document.getElementById('unifiedNamingPattern');
            if (!input) return;
            
            input.value = '';
            this.updateUnifiedPreview();
            input.focus();
        };

        window.ocrManager = this;
        window.Utils = Utils;
    }

    cleanup() {
        Utils.cleanupBlobUrls();
        this.ocrConfigManager.cleanup();
    }

    getDebugInfo() {
        return {
            hasImportedFile: !!this.importedFile,
            importedFileName: this.importedFile?.name || null,
            importedFileSize: this.importedFile?.size || null,
            importedFileType: this.importedFile?.type || null,
            selectedProfile: this.profileManager?.selectedProfile || null,
            cachedConfig: this.cachedProfileConfig,
            profileManagerAvailable: !!this.profileManager,
            timestamp: new Date().toISOString()
        };
    }
}

export default OcrProcessingManager;