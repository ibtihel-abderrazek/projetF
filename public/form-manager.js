// form-manager.js - Gestionnaire des formulaires et champs (avec sélection driver)

import { CONFIG } from './config.js';
import { Utils } from './utils.js';

/**
 * Gestionnaire centralisé pour les formulaires et leurs champs
 */
export class FormManager {
    constructor() {
        this.fieldConfigurations = this.getFieldConfigurations();
        this.setupGlobalPatternHelpers();
    }

    /**
     * Trouve la configuration d'un champ par son nom
     */
    findFieldConfig(fieldName) {
        for (const [tabName, tabConfig] of Object.entries(this.fieldConfigurations)) {
            if (tabConfig.fields && tabConfig.fields[fieldName]) {
                return tabConfig.fields[fieldName];
            }
        }
        return null;
    }

    /**
     * Configuration des champs par onglet
     */
    getFieldConfigurations() {
        return {
            general: {
                required: ['DisplayName'],
                fields: {
                    'DisplayName': { label: 'Nom du profil', type: 'text', required: true },
                    'DriverName': { 
                        label: 'Type de driver', 
                        type: 'select',
                        options: [
                            { value: 'twain', label: 'TWAIN (Scanners avec fil)' },
                            { value: 'wia', label: 'WIA (Scanners sans fil)' }
                        ],
                        default: 'twain',
                        onChange: 'filterScannersByDriver'
                    },
                    'Device.Name': { 
                        label: 'Scanner', 
                        type: 'select', 
                        source: 'scanners',
                        filterBy: 'DriverName'
                    },
                    'IsDefault': { label: 'Définir comme profil par défaut', type: 'checkbox' },
                    'FlipDuplexedPages': { label: 'Activer recto-verso', type: 'checkbox' },
                    'MaxQuality': { 
                        label: 'Utiliser la qualité maximale', 
                        type: 'checkbox',
                    },
                    'UseNativeUI': { 
                        label: 'Utiliser l\'interface native du scanner', 
                        type: 'hidden',
                        default: 'false',
                    },
                    'EnableAutoSave': { 
                        label: 'Activer la sauvegarde automatique', 
                        type: 'checkbox'
                    },
                    'AutoSaveSettings.PromptForFilePath': {
                        label: 'Demander le chemin',
                        type: 'hidden',
                        default: 'false'
                    },
                    'AutoSaveSettings.ClearImagesAfterSaving': {
                        label: 'Effacer les images',
                        type: 'hidden',
                        default: 'false'
                    },
                    'AutoSaveSettings.Separator': {
                        label: 'Séparateur',
                        type: 'hidden',
                        default: 'FilePerPage'
                    },
                    'Version': { label: 'Version', type: 'hidden', default: '5' },
                    'IconID': { label: 'ID de l\'icône', type: 'hidden', default: '0' },
                    'Device.ID': { label: 'ID de l\'appareil', type: 'hidden', default: 'auto' },
                }
            },
            scan: {
                fields: {
                    'Resolution': { 
                        label: 'Résolution (DPI)', 
                        type: 'select', 
                        options: CONFIG.FIELD_OPTIONS.Resolution.map(val => ({ 
                            value: val, 
                            label: val.replace('Dpi', '') + ' DPI' 
                        })), 
                        default: 'Dpi200',
                    },
                    'BitDepth': { 
                        label: 'Profondeur de couleur', 
                        type: 'select', 
                        options: [
                            { value: 'C24Bit', label: 'Couleurs sur 24 bits' },
                            { value: 'Grayscale', label: 'Niveaux de gris' },
                            { value: 'BlackWhite', label: 'Noir et blanc' }
                        ], 
                        default: 'C24Bit',
                    },
                    'Quality': { 
                        label: 'Qualité JPEG (%)', 
                        type: 'number', 
                        min: 1, 
                        max: 100, 
                        default: 75,
                        dependsOn: 'MaxQuality',
                        hideWhen: true
                    },
                    'PaperSource': { 
                        label: 'Source papier', 
                        type: 'select', 
                        options: CONFIG.FIELD_OPTIONS.PaperSource.map(val => ({ 
                            value: val, 
                            label: val === 'Glass' ? 'Vitre (Glass)' : 'Chargeur automatique (Feeder)' 
                        })), 
                        default: 'Glass',
                    },
                    'PageSize': { 
                        label: 'Format de page', 
                        type: 'select', 
                        options: CONFIG.FIELD_OPTIONS.PageSize.map(val => ({ 
                            value: val, 
                            label: val === 'Letter' ? 'Letter (US)' : 
                                   val === 'A4' ? 'A4 (Standard)' : 
                                   val === 'Legal' ? 'Legal (US)' : 'Personnalisé' 
                        })), 
                        default: 'A4',
                    },
                    'PageAlign': { 
                        label: 'Alignement de la page', 
                        type: 'select', 
                        options: CONFIG.FIELD_OPTIONS.PageAlign.map(val => ({ 
                            value: val, 
                            label: val === 'Left' ? 'Gauche' : 
                                   val === 'Center' ? 'Centré' : 'Droite' 
                        })), 
                        default: 'Center',
                    },
                    'AutoDeskew': { 
                        label: 'Redressement automatique des pages', 
                        type: 'checkbox',
                    },
                    'ExcludeBlankPages': { 
                        label: 'Exclure les pages vides', 
                        type: 'checkbox',
                        toggles: ['BlankPageWhiteThreshold', 'BlankPageCoverageThreshold']
                    },
                    'ForcePageSize': { label: 'Forcer le format de page', type: 'checkbox' }
                }
            },
            advanced: {
                fields: {
                    'Brightness': { 
                        label: 'Luminosité', 
                        type: 'number', 
                        min: -100,
                        max: 100, 
                        default: 0,
                    }, 
                    'Contrast': { 
                        label: 'Contraste', 
                        type: 'number', 
                        min: -100, 
                        max: 100, 
                        default: 0, 
                    },
                    'RotateDegrees': { 
                        label: 'Rotation de l\'image (°)', 
                        type: 'select', 
                        options: [
                            { value: '0', label: '0° (aucune rotation)' },
                            { value: '90', label: '90°' },
                            { value: '180', label: '180°' },
                            { value: '270', label: '270°' }
                        ], 
                        default: '0',
                    },
                    'BlankPageWhiteThreshold': { 
                        label: 'Seuil de blanc (%)', 
                        type: 'number', 
                        min: 0, 
                        max: 100, 
                        default: 70,
                        dependsOn: 'ExcludeBlankPages',
                        hideWhen: false
                    },
                    'BlankPageCoverageThreshold': { 
                        label: 'Seuil de couverture (%)', 
                        type: 'number', 
                        min: 0, 
                        max: 100, 
                        default: 25,
                        dependsOn: 'ExcludeBlankPages',
                        hideWhen: false
                    },
                    'TwainProgress': { 
                        label: 'Afficher la progression TWAIN', 
                        type: 'checkbox',
                    },
                    'BrightnessContrastAfterScan': { 
                        label: 'Appliquer les corrections après numérisation', 
                        type: 'checkbox',
                    },
                    'OcrMode': { 
                        label: 'Activer la reconnaissance de texte (OCR)', 
                        type: 'checkbox', 
                        default: false,
                        toggles: ['OcrLang','ModeOcr']
                    },
                    'OcrLang': { 
                        label: 'Langue de reconnaissance OCR', 
                        type: 'select', 
                        options: [
                            { value: '', label: 'Détection automatique' },
                            { value: 'ara', label: 'Arabe' },
                            { value: 'fra', label: 'Français' },
                            { value: 'eng', label: 'Anglais' }
                        ],
                        default: 'fra',
                        dependsOn: 'OcrMode',
                        hideWhen: false
                    },
                    'ModeOcr': { 
                        label: 'Mode d\'application OCR', 
                        type: 'select', 
                        options: [
                            { value: 'auto', label: 'Automatique - Détecter si PDF avec texte' },
                            { value: 'force', label: 'Forcer - Toujours appliquer l\'OCR' },
                            { value: 'skip', label: 'Ignorer - Ne jamais appliquer l\'OCR' }
                        ],
                        default: 'auto',
                        dependsOn: 'OcrMode',
                        hideWhen: false
                    },
                }
            },
            ocr: {
                fields: {
                    'OcrPatchMode': {
                        label: 'Activer le traitement par lots (Patch)',
                        type: 'checkbox',
                        default: true,
                        toggles: ['OcrPatchNaming', 'PatchMode']
                    },
                    'PatchMode': {
                        label: 'Mode de traitement',
                        type: 'select',
                        options: CONFIG.OCR.PATCH_TYPES,
                        default: CONFIG.OCR.DEFAULT_PATCH_TYPE,
                        dependsOn: 'OcrPatchMode',
                        hideWhen: false,
                        preserveValue: true
                    },
                    'OcrPatchNaming': {
                        label: 'Préfixe',
                        type: 'select',
                        options: CONFIG.OCR.PATCH_STRATEGIES.map(strategy => ({
                            value: strategy.value,
                            label: strategy.label
                        })),
                        default: CONFIG.OCR.DEFAULT_PATCH_NAMING,
                        dependsOn: 'OcrPatchMode',
                        hideWhen: false,
                        preserveValue: true
                    },
                    'OcrPdfMode': { 
                        label: 'Format du fichier de sortie', 
                        type: 'select', 
                        options: [
                            { value: 'pdfa', label: 'PDF/A (Recommandé - Archivage long terme)' },
                            { value: 'pdf', label: 'PDF standard' }
                        ],
                        default: CONFIG.OCR.DEFAULT_PDF_MODE
                    },
                    'AutoSaveSettings.FilePath': {
                        label: 'Suffixe',
                        type: 'naming-pattern',
                        default: '$(DD)-$(MM)-$(YYYY)-$(n)',
                        dependsOn: 'EnableAutoSave',
                        hideWhen: false,
                        preserveValue: true,
                    }
                }
            }
        };
    }

    /**
     * Crée un champ de formulaire HTML
     */
    createField(fieldName, fieldConfig, data = {}, scanners = []) {
        const fieldId = fieldName.replace(/\./g, '_');
        const rawValue = Utils.getNestedValue(data, fieldName);
        
        let value = rawValue !== undefined && rawValue !== null ? rawValue : (fieldConfig.default || '');

        if (fieldConfig.type === 'hidden') {
            return `<input type="hidden" id="${fieldId}" name="${fieldName}" value="${Utils.escapeHtml(String(value || ''))}">`; 
        }
        
        let fieldClass = 'form-group';
        
        if (fieldConfig.dependsOn) {
            fieldClass += ` depends-on-${fieldConfig.dependsOn}`;
            fieldClass += fieldConfig.hideWhen ? ' hide-when-active' : ' show-when-active';
        }
        
        const inputHtml = this.createInputHtml(fieldName, fieldConfig, value, scanners, fieldId);

        if (fieldConfig.type === 'checkbox') {
            return `
                <div class="${fieldClass} checkbox-group">
                    <div class="checkbox-item">
                        ${inputHtml}
                        <label for="${fieldId}">${fieldConfig.label}</label>
                        ${fieldConfig.help ? `<small>${fieldConfig.help}</small>` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="${fieldClass}">
                <label for="${fieldId}">${fieldConfig.label}</label>
                ${inputHtml}
                ${fieldConfig.help ? `<small>${fieldConfig.help}</small>` : ''}
            </div>
        `;
    }

    /**
     * Crée le HTML d'un input selon son type
     */
    createInputHtml(fieldName, fieldConfig, value, scanners, fieldId) {
        switch (fieldConfig.type) {
            case 'text':
            case 'number':
                const attrs = fieldConfig.type === 'number' ? 
                    `min="${fieldConfig.min || ''}" max="${fieldConfig.max || ''}"` : '';
                return `<input type="${fieldConfig.type}" id="${fieldId}" name="${fieldName}" value="${Utils.escapeHtml(String(value || ''))}" ${attrs}>`;
                
            case 'select':
                return this.createSelectHtml(fieldName, fieldConfig, value, scanners, fieldId);
                
            case 'naming-pattern':
                return this.createNamingPatternBuilder(fieldId, fieldName, value);
                
            case 'checkbox':
                const isChecked = value === true || value === 'true' || 
                                (typeof value === 'string' && value.toLowerCase() === 'true');
                const checked = isChecked ? 'checked' : '';
                const togglesAttr = fieldConfig.toggles ? `data-toggles="${fieldConfig.toggles.join(',')}"` : '';
                
                return `<input type="checkbox" id="${fieldId}" name="${fieldName}" ${checked} ${togglesAttr}>`;
                
            default:
                return `<input type="text" id="${fieldId}" name="${fieldName}" value="${Utils.escapeHtml(String(value || ''))}">`;
        }
    }

/**
 * Crée un select HTML avec support du filtrage par driver (VERSION CORRIGÉE)
 */
createSelectHtml(fieldName, fieldConfig, value, scanners, fieldId) {
    let options = '';
    
    // ✅ Déterminer la valeur effective (valeur actuelle ou valeur par défaut)
    const effectiveValue = (value !== undefined && value !== null && value !== '') 
        ? value 
        : fieldConfig.default;
    
    console.log(`📋 createSelectHtml - Champ: ${fieldName}`, {
        valueRecu: value,
        effectiveValue: effectiveValue,
        default: fieldConfig.default
    });
    
    if (fieldConfig.source === 'scanners') {
        // ✅ Fonction de normalisation pour comparaison insensible à la casse
        const normalizeValue = (val) => {
            if (!val) return '';
            return String(val).trim().toLowerCase().replace(/\s+/g, ' ');
        };
        
        const cleanEffective = normalizeValue(effectiveValue);
        
        console.log(`📋 Scanner select - valeur recherchée: "${cleanEffective}"`);
        
        // ✅ Si le champ a un filtre par driver, ajouter l'attribut data
        const filterAttr = fieldConfig.filterBy ? `data-filter-by="${fieldConfig.filterBy}"` : '';
        
        // ✅ Vérifier si le scanner du profil existe dans la liste des scanners connectés
        let scannerFound = false;
        let disconnectedScanner = null;
        
        if (effectiveValue) {
            scannerFound = scanners.some(s => normalizeValue(s.name) === cleanEffective);
            
            // Si le scanner n'est pas trouvé, c'est qu'il est déconnecté
            if (!scannerFound) {
                console.warn(`⚠️ Scanner "${effectiveValue}" non trouvé dans la liste (probablement déconnecté)`);
                disconnectedScanner = {
                    name: effectiveValue,
                    displayName: `⚠️ ${effectiveValue} (Déconnecté)`,
                    driver: null, // On ne connaît pas le driver exact
                    isDisconnected: true
                };
            }
        }
        
        // ✅ Ajouter d'abord le scanner déconnecté s'il existe (en début de liste)
        if (disconnectedScanner) {
            options = `<option value="${Utils.escapeHtml(disconnectedScanner.name)}" 
                              data-scanner-id="${Utils.escapeHtml(disconnectedScanner.name)}" 
                              data-disconnected="true"
                              selected
                              class="disconnected-scanner">
                          ${Utils.escapeHtml(disconnectedScanner.displayName)}
                       </option>`;
        }
        
        // ✅ Générer les options pour les scanners connectés
        options += scanners.map((scanner) => {
            const optionValue = scanner.name;
            const cleanOption = normalizeValue(optionValue);
            
            // ✅ Comparaison insensible à la casse et aux espaces
            const isSelected = cleanEffective === cleanOption;
            const selected = isSelected ? 'selected' : '';
            
            // ✅ Ajouter le driver comme attribut data pour le filtrage
            const driverAttr = scanner.driver ? `data-driver="${scanner.driver}"` : '';
            
            if (isSelected) {
                console.log(`  ✅ Scanner sélectionné trouvé:`, {
                    name: scanner.name,
                    driver: scanner.driver,
                    displayName: scanner.displayName
                });
            }
            
            return `<option value="${Utils.escapeHtml(optionValue)}" 
                           data-scanner-id="${Utils.escapeHtml(scanner.name)}" 
                           ${driverAttr}
                           ${selected}>
                      ${Utils.escapeHtml(scanner.displayName || scanner.name)}
                    </option>`;
        }).join('');
        
        return `<select id="${fieldId}" name="${fieldName}" ${filterAttr}>${options}</select>`;
        
    } else if (fieldConfig.options) {
        // ✅ Gestion des options normales (pas scanners)
        if (Array.isArray(fieldConfig.options) && typeof fieldConfig.options[0] === 'object') {
            options = fieldConfig.options.map(option => {
                const isSelected = effectiveValue === option.value;
                const selected = isSelected ? 'selected' : '';
                
                if (isSelected) {
                    console.log(`  ✅ Option sélectionnée: ${option.label} (${option.value})`);
                }
                
                return `<option value="${Utils.escapeHtml(option.value)}" ${selected}>
                          ${Utils.escapeHtml(option.label)}
                        </option>`;
            }).join('');
        } else {
            options = fieldConfig.options.map(option => {
                const isSelected = effectiveValue === option;
                const selected = isSelected ? 'selected' : '';
                
                return `<option value="${Utils.escapeHtml(String(option))}" ${selected}>
                          ${Utils.escapeHtml(String(option))}
                        </option>`;
            }).join('');
        }
        
        // ✅ Ajouter l'event handler si le champ a un onChange
        const onChangeAttr = fieldConfig.onChange ? `data-onchange="${fieldConfig.onChange}"` : '';
        return `<select id="${fieldId}" name="${fieldName}" ${onChangeAttr}>${options}</select>`;
    }
    
    return `<select id="${fieldId}" name="${fieldName}">${options}</select>`;
}


    /**
     * Crée un constructeur de pattern de nommage
     */
    createNamingPatternBuilder(fieldId, fieldName, value) {
        return `
            <div class="naming-pattern-builder">
                <div class="pattern-preview">
                    <strong>Aperçu :</strong> <span id="${fieldId}_preview">${Utils.generateNamingPreview(value || '')}</span>
                </div>
                <div class="pattern-input-container">
                    <input type="text" name="${fieldName}" id="${fieldId}" class="pattern-input" 
                           value="${Utils.escapeHtml(value || '')}" 
                           placeholder="Cliquez sur les éléments ci-dessous pour construire votre modèle..."
                           onkeyup="window.updatePreview && window.updatePreview('${fieldId}')">
                    <button type="button" class="clear-pattern-btn" 
                            onclick="window.clearPattern && window.clearPattern('${fieldId}')" 
                            title="Effacer tout">🗑</button>
                </div>
                
                <div class="substitutions-section">
                    <div class="section-title">Date et Heure</div>
                    <div class="substitution-grid">
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(YYYY)', '${fieldId}')">
                            <div class="substitution-code">$(YYYY)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(YY)', '${fieldId}')">
                            <div class="substitution-code">$(YY)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(MM)', '${fieldId}')">
                            <div class="substitution-code">$(MM)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(DD)', '${fieldId}')">
                            <div class="substitution-code">$(DD)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(HH)', '${fieldId}')">
                            <div class="substitution-code">$(HH)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(mm)', '${fieldId}')">
                            <div class="substitution-code">$(mm)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(ss)', '${fieldId}')">
                            <div class="substitution-code">$(ss)</div>
                        </div>
                    </div>
                    
                    <div class="section-title">Numéros</div>
                    <div class="substitution-grid">
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(nnn)', '${fieldId}')">
                            <div class="substitution-code">$(nnn)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(nn)', '${fieldId}')">
                            <div class="substitution-code">$(nn)</div>
                        </div>
                        <div class="substitution-item" onclick="window.addToPattern && window.addToPattern('$(n)', '${fieldId}')">
                            <div class="substitution-code">$(n)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Collecte les données d'un formulaire
     */
    collectFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) {
            throw new Error(`Formulaire ${formId} non trouvé`);
        }
        
        return Utils.collectFormData(form);
    }

    /**
     * Configure les dépendances entre les champs
     */
    setupFieldDependencies(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        this.cleanupEventListeners(form);
        this.setupDeviceSync(form);
        this.setupDriverFilter(form);  // Nouveau: filtrage par driver
        
        form.querySelectorAll('input[type="checkbox"][data-toggles]').forEach(checkbox => {
            const toggledFields = checkbox.getAttribute('data-toggles')?.split(',').map(f => f.trim()) || [];
            
            const updateDependentFields = () => {
                this.updateDependentFields(form, checkbox.name, checkbox.checked, toggledFields);
            };

            updateDependentFields();
            checkbox.addEventListener('change', updateDependentFields);
        });

        this.setupOcrFieldDependencies(form);
        this.setupAutoSaveFieldDependencies(form);
        this.setupFilePathNamingSync(form);
    }
/**
 * Configure le filtrage des scanners par driver (VERSION CORRIGÉE)
 */
setupDriverFilter(form) {
    const driverSelect = form.querySelector('select[name="DriverName"]');
    const deviceSelect = form.querySelector('select[name="Device.Name"][data-filter-by]');
    
    if (!driverSelect || !deviceSelect) {
        console.warn('⚠️ Driver select ou Device select introuvable');
        return;
    }
    
    console.log('🔧 Initialisation du filtrage par driver');
    
    // ✅ CRITIQUE: Lire les valeurs AVANT tout traitement
    // Ces valeurs viennent du HTML généré par createSelectHtml avec selected="selected"
    const initialDeviceValue = deviceSelect.value;
    const initialDriverValue = driverSelect.value;
    
    console.log(`📋 Valeurs initiales AVANT filtrage:`, {
        driver: initialDriverValue,
        device: initialDeviceValue
    });
    
    // ✅ Stocker aussi l'option sélectionnée pour la retrouver
    const initialSelectedOption = deviceSelect.querySelector('option[selected]');
    const targetDeviceName = initialSelectedOption ? initialSelectedOption.value : initialDeviceValue;
    
    console.log(`📋 Scanner cible à préserver: "${targetDeviceName}"`);
    
    const filterScanners = (preserveInitialValue = false) => {
        const selectedDriver = driverSelect.value;
        console.log(`🔍 Filtrage par driver: "${selectedDriver}" (preserve: ${preserveInitialValue})`);
        
        const options = deviceSelect.querySelectorAll('option');
        let visibleCount = 0;
        let firstVisibleOption = null;
        let targetOption = null;
        const currentSelectedValue = deviceSelect.value;
        let currentOptionStillVisible = false;
        
        options.forEach((option) => {
            const optionDriver = option.getAttribute('data-driver');
            const optionValue = option.value;
            
            // Si l'option n'a pas de driver, la masquer
            if (!optionDriver) {
                option.style.display = 'none';
                return;
            }
            
            // Afficher uniquement les options du driver sélectionné
            if (optionDriver === selectedDriver) {
                option.style.display = '';
                visibleCount++;
                
                if (!firstVisibleOption) {
                    firstVisibleOption = option;
                }
                
                // ✅ Rechercher l'option cible (celle du profil)
                if (preserveInitialValue && optionValue === targetDeviceName) {
                    targetOption = option;
                    console.log(`  🎯 Option cible trouvée: "${optionValue}"`);
                }
                
                if (optionValue === currentSelectedValue) {
                    currentOptionStillVisible = true;
                }
            } else {
                option.style.display = 'none';
            }
        });
        
        console.log(`  ✅ ${visibleCount} scanner(s) visible(s) pour le driver "${selectedDriver}"`);
        
        // ✅ LOGIQUE CORRIGÉE: Priorité à la valeur du profil
        if (preserveInitialValue && targetOption) {
            // Restaurer la valeur du profil
            console.log(`  🔄 Restauration de la valeur du profil: "${targetOption.value}"`);
            deviceSelect.value = targetOption.value;
            
            // Synchroniser Device.ID
            const event = new Event('change', { bubbles: true });
            deviceSelect.dispatchEvent(event);
        } else if (!currentOptionStillVisible && visibleCount > 0) {
            // Sinon, sélectionner la première option visible
            console.log(`  🔄 Sélection de la première option visible`);
            
            if (firstVisibleOption) {
                deviceSelect.value = firstVisibleOption.value;
                console.log(`  ✅ Nouvelle sélection: "${firstVisibleOption.textContent.trim()}"`);
                
                const event = new Event('change', { bubbles: true });
                deviceSelect.dispatchEvent(event);
            }
        }
        
        // Si aucun scanner visible, chercher un driver compatible
        if (visibleCount === 0 && !preserveInitialValue) {
            console.warn(`  ⚠️ Aucun scanner "${selectedDriver}" détecté`);
            
            const availableDrivers = new Set();
            options.forEach(opt => {
                const driver = opt.getAttribute('data-driver');
                if (driver && opt.value) availableDrivers.add(driver);
            });
            
            if (availableDrivers.size > 0) {
                const suggestedDriver = Array.from(availableDrivers)[0];
                console.log(`  💡 Changement automatique vers "${suggestedDriver}"`);
                
                driverSelect.value = suggestedDriver;
                setTimeout(() => filterScanners(false), 100);
            }
        }
    };
    
    // ✅ CORRECTION CRITIQUE: Ne PAS toucher aux valeurs, juste filtrer
    setTimeout(() => {
        console.log('🔄 Filtrage initial au chargement');
        console.log(`📋 Valeurs à préserver: driver="${initialDriverValue}", device="${targetDeviceName}"`);
        
        // ✅ Toujours préserver les valeurs initiales lors du premier filtrage
        if (targetDeviceName) {
            // Trouver le driver de ce scanner
            const targetOptionElement = Array.from(deviceSelect.querySelectorAll('option'))
                .find(opt => opt.value === targetDeviceName);
            
            if (targetOptionElement) {
                const correctDriver = targetOptionElement.getAttribute('data-driver');
                console.log(`  📋 Driver correct pour "${targetDeviceName}": "${correctDriver}"`);
                
                // ✅ Forcer le driver correct AVANT de filtrer
                if (correctDriver && driverSelect.value !== correctDriver) {
                    console.log(`  🔧 Correction du driver: "${driverSelect.value}" → "${correctDriver}"`);
                    driverSelect.value = correctDriver;
                }
            }
            
            // Filtrer en préservant la valeur
            filterScanners(true);
        } else {
            // Pas de valeur initiale, filtrage normal
            filterScanners(false);
        }
    }, 200);
    
    // Event listener pour les changements manuels
    driverSelect.addEventListener('change', () => {
        console.log('🔄 Changement manuel de driver détecté');
        filterScanners(false);
    });
}

    /**
     * Configure la synchronisation automatique entre Device.Name et Device.ID
     */
    setupDeviceSync(form) {
        const deviceNameSelect = form.querySelector('select[name="Device.Name"]');
        const deviceIdInput = form.querySelector('input[name="Device.ID"]');
        
        if (deviceNameSelect && deviceIdInput) {
            const syncDeviceId = () => {
                const selectedOption = deviceNameSelect.options[deviceNameSelect.selectedIndex];
                if (selectedOption && selectedOption.dataset.scannerId) {
                    deviceIdInput.value = selectedOption.dataset.scannerId;
                }
            };
            
            syncDeviceId();
            deviceNameSelect.addEventListener('change', syncDeviceId);
        }
    }

    setupFilePathNamingSync(form) {
        const filePathField = form.querySelector('[name="AutoSaveSettings.FilePath"]');
        const namingPatternField = form.querySelector('[name="OcrNamingPattern"]');
        
        if (!filePathField || !namingPatternField) return;
        
        filePathField.addEventListener('input', Utils.debounce(() => {
            if (filePathField.value) {
                namingPatternField.value = filePathField.value;
                const previewId = namingPatternField.id;
                if (window.updatePreview) {
                    window.updatePreview(previewId);
                }
            }
        }, 300));
        
        namingPatternField.addEventListener('input', Utils.debounce(() => {
            if (namingPatternField.value) {
                filePathField.value = namingPatternField.value;
            }
        }, 300));
    }

    cleanupEventListeners(form) {
        form.querySelectorAll('input[type="checkbox"][data-toggles]').forEach(checkbox => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        });
    }

    updateDependentFields(form, checkboxName, isChecked, toggledFields) {
        toggledFields.forEach(fieldName => {
            if (['OcrPatchNaming', 'PatchMode'].includes(fieldName)) return;

            const field = form.querySelector(`[name="${fieldName}"]`);
            const container = field?.closest('.form-group');
            
            if (container && field) {
                const fieldConfig = this.findFieldConfig(fieldName);
                
                if (container.classList.contains('hide-when-active')) {
                    container.style.display = isChecked ? 'none' : 'block';
                    field.disabled = isChecked;
                } else {
                    container.style.display = isChecked ? 'block' : 'none';
                    field.disabled = !isChecked;
                }
                
                if (!field.disabled && field.tagName === 'SELECT' && (!field.value || field.value === '')) {
                    if (fieldConfig?.default) {
                        field.value = fieldConfig.default;
                    }
                }
            }
        });
    }

    setupOcrFieldDependencies(form) {
        const ocrModeCheckbox = form.querySelector('input[name="OcrMode"]');
        if (ocrModeCheckbox) {
            const newCheckbox = ocrModeCheckbox.cloneNode(true);
            ocrModeCheckbox.parentNode.replaceChild(newCheckbox, ocrModeCheckbox);

            const updateOcrFields = () => {
                const isOcrEnabled = newCheckbox.checked;
                
                const languageFieldContainer = form.querySelector(`[name="OcrLang"]`)?.closest('.form-group');
                if (languageFieldContainer) {
                    languageFieldContainer.style.display = isOcrEnabled ? 'block' : 'none';
                    const languageInput = languageFieldContainer.querySelector('select');
                    if (languageInput) languageInput.disabled = !isOcrEnabled;
                }
                
                const modeOcrFieldContainer = form.querySelector(`[name="ModeOcr"]`)?.closest('.form-group');
                if (modeOcrFieldContainer) {
                    modeOcrFieldContainer.style.display = isOcrEnabled ? 'block' : 'none';
                    const modeOcrInput = modeOcrFieldContainer.querySelector('select');
                    if (modeOcrInput) modeOcrInput.disabled = !isOcrEnabled;
                }
            };
            
            updateOcrFields();
            newCheckbox.addEventListener('change', updateOcrFields);
        }

        const ocrPatchModeCheckbox = form.querySelector('input[name="OcrPatchMode"]');
        if (ocrPatchModeCheckbox) {
            const newCheckbox = ocrPatchModeCheckbox.cloneNode(true);
            ocrPatchModeCheckbox.parentNode.replaceChild(newCheckbox, ocrPatchModeCheckbox);

            const updatePatchFields = () => {
                const isPatchEnabled = newCheckbox.checked;
                const patchDependentFields = ['OcrPatchNaming', 'PatchMode'];

                patchDependentFields.forEach(fieldName => {
                    const field = form.querySelector(`[name="${fieldName}"]`);
                    const fieldContainer = field?.closest('.form-group');
                    if (fieldContainer) {
                        fieldContainer.style.display = isPatchEnabled ? 'block' : 'none';
                        if (field) {
                            field.disabled = !isPatchEnabled;
                        }
                    }
                });
            };

            updatePatchFields();
            newCheckbox.addEventListener('change', updatePatchFields);
        }
    }

    setupAutoSaveFieldDependencies(form) {
        const enableAutoSaveCheckbox = form.querySelector('input[name="EnableAutoSave"]');
        if (enableAutoSaveCheckbox) {
            const newCheckbox = enableAutoSaveCheckbox.cloneNode(true);
            enableAutoSaveCheckbox.parentNode.replaceChild(newCheckbox, enableAutoSaveCheckbox);

            const updateAutoSaveFields = () => {
                const isAutoSaveEnabled = newCheckbox.checked;

                const filePathField = form.querySelector(`[name="AutoSaveSettings.FilePath"]`);
                const filePathContainer = filePathField?.closest('.form-group');
                if (filePathContainer) {
                    filePathContainer.style.display = isAutoSaveEnabled ? 'block' : 'none';
                }
            };

            updateAutoSaveFields();
            newCheckbox.addEventListener('change', updateAutoSaveFields);
        }
    }

    setupGlobalPatternHelpers() {
        window.addToPattern = (token, fieldId) => {
            const input = document.getElementById(fieldId);
            if (input) {
                const currentValue = input.value || '';
                const cursorPos = input.selectionStart || 0;
                const newValue = currentValue.slice(0, cursorPos) + token + currentValue.slice(cursorPos);
                input.value = newValue;
                input.focus();
                
                const newCursorPos = cursorPos + token.length;
                setTimeout(() => {
                    input.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
                
                this.updatePatternPreview(fieldId);
            }
        };

        window.clearPattern = (fieldId) => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.value = '';
                input.focus();
                this.updatePatternPreview(fieldId);
            }
        };

        window.updatePreview = (fieldId) => {
            this.updatePatternPreview(fieldId);
        };
    }

    updatePatternPreview(fieldId) {
        const input = document.getElementById(fieldId);
        const preview = document.getElementById(fieldId + '_preview');
        
        if (input && preview) {
            const pattern = input.value || '';
            const previewText = Utils.generateNamingPreview(pattern);
            preview.textContent = previewText;
        }
    }

    renderFormTab(containerId, fields, data = {}, scanners = []) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} non trouvé`);
            return;
        }

        let html = '<div class="form-grid">';
        
        Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
            html += this.createField(fieldName, fieldConfig, data, scanners);
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    validateFormData(formId, tabName = 'general') {
        const form = document.getElementById(formId);
        if (!form) {
            throw new Error(`Formulaire ${formId} non trouvé`);
        }

        const errors = [];
        const warnings = [];
        const tabConfig = this.fieldConfigurations[tabName];
        
        if (tabConfig && tabConfig.required) {
            tabConfig.required.forEach(fieldName => {
                const field = form.querySelector(`[name="${fieldName}"]`);
                if (!field || !field.value.trim()) {
                    errors.push(`Le champ "${fieldName}" est obligatoire`);
                }
            });
        }

        const formData = this.collectFormData(formId);
        
        if (formData.OcrMode && !formData.OcrLang) {
            warnings.push('OCR activé mais aucune langue spécifiée');
        }

        if (formData.OcrPatchMode && !formData.OcrPatchNaming) {
            errors.push('Mode Patch activé mais aucune stratégie de nommage définie');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    addHiddenFieldDefaults(profileData, scanners = []) {
        Object.entries(this.fieldConfigurations).forEach(([tabName, tabConfig]) => {
            if (!tabConfig.fields) return;
            
            Object.entries(tabConfig.fields).forEach(([fieldName, fieldConfig]) => {
                if ((fieldConfig.type === 'hidden' || fieldConfig.preserveValue === true) && fieldConfig.default) {
                    if (fieldName === 'Device.ID' && fieldConfig.default === 'auto' && profileData.Device?.Name) {
                        const scanner = scanners.find(s => s.name === profileData.Device.Name);
                        if (scanner) {
                            Utils.setNestedValue(profileData, fieldName.split('.'), scanner.id);
                            return;
                        }
                    }
                    
                    const currentValue = Utils.getNestedValue(profileData, fieldName);
                    if (!currentValue || currentValue === '') {
                        Utils.setNestedValue(profileData, fieldName.split('.'), fieldConfig.default);
                    }
                }
            });
        });
    }

    forceShowFields(form, fieldNames) {
        fieldNames.forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            const container = field?.closest('.form-group');
            if (container) {
                container.style.display = 'block';
                if (field) field.disabled = false;
            }
        });
    }

    debugFieldVisibility(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.querySelectorAll('.form-group').forEach(group => {
            const field = group.querySelector('input, select');
            if (field) {
                const isVisible = group.style.display !== 'none';
                const isDisabled = field.disabled;
            }
        });
    }
}

export default FormManager;