// app-manager.js - Gestionnaire principal de l'application

import { ApiService } from './api-service.js';
import { Utils } from './utils.js';
import { CONFIG } from './config.js';
import { PopupManager } from './popup-manager.js';
import { ProfileManager } from './profile-manager.js';
import { OcrProcessingManager } from './ocr-processing-manager.js';
import { OcrConfigManager } from './ocr-config-manager.js';

/**
 * Gestionnaire principal de l'application Scanner Profile Manager
 */
export class ScannerProfileApp {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        this.theme = localStorage.getItem('theme') || 'light';
        
        // Initialiser les composants
        this.initializeComponents();
    }

    /**
     * Initialise tous les composants de l'application
     */
    initializeComponents() {
        // Gestionnaire de popups
        this.components.popupManager = new PopupManager();
        
        // Gestionnaire de profils
        this.components.profileManager = new ProfileManager();
        this.components.profileManager.setPopupManager(this.components.popupManager);
        
        // Gestionnaire OCR/Patch
        this.components.ocrProcessingManager = new OcrProcessingManager();
        this.components.ocrProcessingManager.setPopupManager(this.components.popupManager);
        this.components.ocrProcessingManager.setProfileManager(this.components.profileManager);
        
        // Gestionnaire de configuration OCR
        this.components.ocrConfigManager = new OcrConfigManager();
    }

    /**
     * Initialise l'application complète
     */
    async init() {
        try {
            
            // Vérifier la connexion serveur
            const serverConnected = await this.checkServerConnection();
            if (!serverConnected) {
                console.warn('Serveur non disponible, mode dégradé activé');
            }
            
            // Initialiser les composants dans l'ordre
            await this.components.profileManager.init();
            
            // Configurer les fonctions globales
            this.setupGlobalFunctions();
            
            // Configurer l'interface utilisateur
            this.setupUI();
            
            // Gérer les erreurs globales
            this.setupErrorHandling();
            
            this.isInitialized = true;
            
            Utils.showNotification('Application chargée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur fatale lors de l\'initialisation:', error);
            this.handleFatalError(error);
        }
    }

    /**
     * Vérifie la connexion au serveur
     */
    async checkServerConnection() {
        try {
            return await ApiService.healthCheck();
        } catch (error) {
            console.warn('Impossible de vérifier la connexion serveur:', error);
            return false;
        }
    }

    /**
     * Configure les fonctions globales pour l'interface HTML
     */
    setupGlobalFunctions() {
        // Fonctions de gestion des popups
        window.showPopup = (popupId) => this.components.popupManager.show(popupId, true);
        window.hidePopup = (popupId) => this.components.popupManager.hide(popupId, true);
        window.switchTab = (evt, tabName) => this.components.popupManager.switchTab(evt, tabName);
        
        // Fonctions spécifiques pour les popups
        window.closeAddPopup = () => this.components.popupManager.hide('addPopup', true);
        window.closeEditPopup = () => this.components.popupManager.hide('editPopup', true);
        window.closeViewPopup = () => this.components.popupManager.hide('viewPopup', true);
        
        // Fonctions pour les profils
        window.openAddProfile = () => {
            this.components.popupManager.show('addPopup', true);
            this.components.profileManager.showAddPopup();
        };
        
        window.openEditProfile = (profileName) => {
            this.components.profileManager.showEditPopup(profileName);
        };
        
        window.openViewProfile = (profileName) => {
            this.components.profileManager.showDetails(profileName);
        };
        
        window.deleteProfile = (profileName) => {
            this.components.profileManager.deleteProfile(profileName);
        };
        
        window.saveProfile = (formId, isEdit = false) => {
            if (isEdit) {
                this.components.profileManager.updateProfile();
            } else {
                this.components.profileManager.createProfile();
            }
        };
        
        // Fonction de rechargement des profils
        window.refreshProfiles = () => {
            this.components.profileManager.loadProfiles();
        };
        
        // Fonctions de debug et test
        window.getDebugInfo = () => this.getDebugInfo();
        window.testApp = () => this.testApp();
        
        // Exposer les composants pour l'accès global
        window.profileManager = this.components.profileManager;
        window.ocrManager = this.components.ocrProcessingManager;
        window.popupManager = this.components.popupManager;
        window.ocrConfigManager = this.components.ocrConfigManager;
        window.app = this;
    }

    /**
     * Configure l'interface utilisateur
     */
    setupUI() {
        // Initialiser le thème
        this.initializeTheme();
        
        // Configurer l'accessibilité
        this.setupAccessibility();
        
        // Configurer les raccourcis clavier
        this.setupKeyboardShortcuts();
        
        // Configurer la navigation
        this.setupNavigation();
    }

    /**
     * Configure la gestion des erreurs globales
     */
    setupErrorHandling() {
        // Gestionnaire d'erreurs JavaScript
        window.addEventListener('error', (e) => {
            console.error('Erreur JavaScript globale:', e.error);
            this.handleGlobalError('Erreur JavaScript', e.error?.message || 'Erreur inconnue');
        });

        // Gestionnaire pour les promesses rejetées
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Promesse rejetée:', e.reason);
            this.handleGlobalError('Erreur de communication', e.reason?.message || 'Erreur de réseau');
        });
    }

    /**
     * Initialise la gestion des thèmes
     */
    initializeTheme() {
        this.applyTheme(this.theme);
        
        const themeToggle = document.getElementById('themeToggle');
        
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.theme = this.theme === 'light' ? 'dark' : 'light';
                this.applyTheme(this.theme);
                localStorage.setItem('theme', this.theme);
                
                Utils.showNotification(`Thème ${this.theme === 'light' ? 'clair' : 'sombre'} activé`, 'info', 2000);
            });
        }
    }

    /**
     * Applique un thème
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
            themeToggle.title = theme === 'light' ? 'Mode sombre' : 'Mode clair';
        }
    }

    /**
     * Configure l'accessibilité
     */
    setupAccessibility() {
        // Navigation au clavier pour les popups
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.components.popupManager.activePopups.size > 0) {
                const lastPopup = Array.from(this.components.popupManager.activePopups).pop();
                this.components.popupManager.hide(lastPopup, true);
            }
        });

        // Focus management
        document.addEventListener('focusin', (e) => {
            if (e.target.closest('.popup')) {
                e.target.setAttribute('data-last-focus', 'true');
            }
        });
    }

    /**
     * Configure les raccourcis clavier
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+N : Nouveau profil
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.components.profileManager.showAddPopup();
                return;
            }

            // Ctrl+R : Actualiser les profils
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.components.profileManager.loadProfiles();
                return;
            }

            // F5 : Actualiser la page (comportement par défaut)
            if (e.key === 'F5') {
                return; // Laisser le comportement par défaut
            }
        });
    }

    /**
     * Configure la navigation
     */
    setupNavigation() {
        // Gestion du focus pour les cartes de profils
        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('scanner-card')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const profileName = e.target.dataset.profileName;
                    if (profileName) {
                        this.components.profileManager.selectProfile(profileName);
                    }
                }
            }
        });
    }

    /**
     * Gère les erreurs globales non fatales
     */
    handleGlobalError(type, message) {
        // Ne pas spam les notifications d'erreur
        const errorKey = `${type}-${message}`;
        const lastError = this.lastError || {};
        
        if (lastError.key === errorKey && Date.now() - lastError.timestamp < 5000) {
            return; // Ignorer si la même erreur s'est produite il y a moins de 5 secondes
        }
        
        this.lastError = {
            key: errorKey,
            timestamp: Date.now()
        };
        
        Utils.showNotification(`${type}: ${message}`, 'error');
    }

    /**
     * Gère les erreurs fatales
     */
    handleFatalError(error) {
        const errorMessage = error?.message || 'Erreur inconnue';
        
        // Afficher une interface d'erreur
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px;">
                    <h2>Erreur d'initialisation</h2>
                    <p><strong>L'application n'a pas pu être initialisée correctement.</strong></p>
                    <p>Erreur: ${Utils.escapeHtml(errorMessage)}</p>
                    
                    <div style="margin: 30px 0;">
                        <button onclick="location.reload()" 
                                style="padding: 12px 24px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-right: 10px;">
                            Recharger la page
                        </button>
                        
                        <button onclick="window.app && window.app.showDebugInfo()" 
                                style="padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
                            Informations de debug
                        </button>
                    </div>
                    
                    <details style="margin-top: 20px; text-align: left;">
                        <summary style="cursor: pointer; font-weight: bold;">Détails techniques</summary>
                        <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; margin-top: 10px; white-space: pre-wrap;">${Utils.escapeHtml(error?.stack || 'Stack trace non disponible')}</pre>
                    </details>
                </div>
            `;
        }
    }

    /**
     * Affiche les informations de debug
     */
    showDebugInfo() {
        const debugInfo = this.getDebugInfo();
        
        const debugWindow = window.open('', '_blank', 'width=800,height=600');
        debugWindow.document.write(`
            <html>
                <head>
                    <title>Informations de debug - Scanner Profile Manager</title>
                    <style>
                        body { font-family: monospace; padding: 20px; background: #f5f5f5; }
                        pre { background: white; padding: 15px; border-radius: 4px; overflow: auto; }
                        .section { margin-bottom: 20px; }
                        .section h3 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
                    </style>
                </head>
                <body>
                    <h1>Informations de debug</h1>
                    <div class="section">
                        <h3>État de l'application</h3>
                        <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                    <div class="section">
                        <h3>Configuration</h3>
                        <pre>${JSON.stringify(CONFIG, null, 2)}</pre>
                    </div>
                </body>
            </html>
        `);
    }

    /**
     * Retourne les informations de debug
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            theme: this.theme,
            timestamp: new Date().toISOString(),
            
            components: {
                popupManager: !!this.components.popupManager,
                profileManager: !!this.components.profileManager,
                ocrProcessingManager: !!this.components.ocrProcessingManager,
                ocrConfigManager: !!this.components.ocrConfigManager
            },
            
            state: {
                selectedProfile: this.components.profileManager?.selectedProfile || null,
                profilesCount: this.components.profileManager?.profiles?.length || 0,
                scannersCount: this.components.profileManager?.scanners?.length || 0,
                activePopups: Array.from(this.components.popupManager?.activePopups || []),
                hasImportedFile: this.components.ocrProcessingManager?.importedFile !== null
            },
            
            cache: {
                ocrConfigCache: this.components.ocrConfigManager?.getCacheStats() || null,
                profileConfigCache: this.components.ocrProcessingManager?.cachedProfileConfig || null
            },
            
            endpoints: {
                profiles: CONFIG.API.BASE,
                ocr: CONFIG.API.OCR,
                scanners: CONFIG.API.SCANNERS,
                processing: CONFIG.API.PROCESSING
            },
            
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            
            performance: {
                memory: performance.memory ? {
                    usedJSSize: Math.round(performance.memory.usedJSSize / 1024 / 1024) + 'MB',
                    totalJSSize: Math.round(performance.memory.totalJSSize / 1024 / 1024) + 'MB'
                } : 'Non disponible'
            }
        };
    }

    /**
     * Teste les fonctionnalités de l'application
     */
    async testApp() {
        console.log('=== TEST APPLICATION ===');
        
        try {
            // Test de la connexion serveur
            console.log('Test connexion serveur...');
            const serverOk = await this.checkServerConnection();
            console.log('Serveur accessible:', serverOk);
            
            // Test des composants
            console.log('Test des composants...');
            Object.entries(this.components).forEach(([name, component]) => {
                console.log(`${name}:`, !!component);
            });
            
            // Test du profil sélectionné
            if (this.components.profileManager?.selectedProfile) {
                console.log('Test configuration OCR du profil...');
                await this.components.ocrProcessingManager?.getSelectedProfileOcrConfig();
            }
            
            // Afficher les informations de debug
            const debugInfo = this.getDebugInfo();
            console.log('Informations de debug:', debugInfo);
            
            Utils.showNotification('Tests terminés - voir la console pour les détails', 'info');
            
        } catch (error) {
            console.error('Erreur lors des tests:', error);
            Utils.showNotification('Erreur lors des tests: ' + error.message, 'error');
        }
        
        console.log('=======================');
        return this.getDebugInfo();
    }

    /**
     * Effectue un nettoyage de l'application
     */
    cleanup() {
        try {
            // Nettoyer les composants
            Object.values(this.components).forEach(component => {
                if (component && typeof component.cleanup === 'function') {
                    component.cleanup();
                }
            });
            
            // Nettoyer les event listeners globaux
            window.removeEventListener('error', this.handleGlobalError);
            window.removeEventListener('unhandledrejection', this.handleGlobalError);
            
            // Nettoyer les URLs blob
            Utils.cleanupBlobUrls();
            
            console.log('Nettoyage de l\'application terminé');
            
        } catch (error) {
            console.error('Erreur lors du nettoyage:', error);
        }
    }

    /**
     * Redémarre l'application
     */
    async restart() {
        try {
            Utils.showNotification('Redémarrage de l\'application...', 'info');
            
            // Nettoyer d'abord
            this.cleanup();
            
            // Réinitialiser l'état
            this.isInitialized = false;
            
            // Réinitialiser les composants
            this.initializeComponents();
            
            // Réinitialiser
            await this.init();
            
            Utils.showNotification('Application redémarrée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur lors du redémarrage:', error);
            this.handleFatalError(error);
        }
    }

    /**
     * Met à jour l'application (recharge les données)
     */
    async refresh() {
        try {
            Utils.showNotification('Actualisation des données...', 'info');
            
            // Recharger les profils
            await this.components.profileManager.loadProfiles();
            
            // Recharger les scanners
            await this.components.profileManager.loadScanners();
            
            // Invalider les caches
            this.components.ocrConfigManager.invalidateCache();
            this.components.ocrProcessingManager.invalidateProfileConfigCache();
            
            Utils.showNotification('Données actualisées avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur lors de l\'actualisation:', error);
            Utils.showNotification('Erreur lors de l\'actualisation: ' + error.message, 'error');
        }
    }

    /**
     * Exporte les données de l'application
     */
    exportData() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                profiles: this.components.profileManager?.profiles || [],
                selectedProfile: this.components.profileManager?.selectedProfile || null,
                theme: this.theme,
                config: CONFIG
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `scanner-profile-manager-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            
            Utils.showNotification('Données exportées avec succès', 'success');

        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            Utils.showNotification('Erreur lors de l\'export: ' + error.message, 'error');
        }
    }
}

// Export par défaut ET nommé pour compatibilité
export default ScannerProfileApp;