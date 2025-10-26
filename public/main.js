// main.js - Point d'entrée principal de l'application Scanner Profile Manager

import { ScannerProfileApp } from './app-manager.js';
import { Utils } from './utils.js';

/**
 * Point d'entrée principal de l'application
 */
class AppBootstrap {
    constructor() {
        this.app = null;
        this.initializationAttempts = 0;
        this.maxRetries = 3;
    }

    /**
     * Démarre l'application
     */
    async bootstrap() {
        console.log('🚀 Démarrage de Scanner Profile Manager...');
        
        try {
            // Vérifier les prérequis
            this.checkPrerequisites();
            
            // Créer l'instance de l'application
            this.app = new ScannerProfileApp();
            
            // Exposer globalement pour le debug
            window.app = this.app;
            
            // Initialiser l'application
            await this.app.init();
            
            console.log('✅ Application démarrée avec succès');
            
        } catch (error) {
            console.error('❌ Erreur lors du démarrage:', error);
            await this.handleBootstrapError(error);
        }
    }

    /**
     * Vérifie les prérequis nécessaires
     */
    checkPrerequisites() {
        const required = [
            { name: 'fetch', check: () => typeof fetch !== 'undefined' },
            { name: 'Promise', check: () => typeof Promise !== 'undefined' },
            { name: 'localStorage', check: () => typeof localStorage !== 'undefined' },
            { name: 'URL', check: () => typeof URL !== 'undefined' },
            { name: 'FormData', check: () => typeof FormData !== 'undefined' }
        ];

        const missing = required.filter(req => !req.check());
        
        if (missing.length > 0) {
            throw new Error(`Fonctionnalités manquantes dans le navigateur: ${missing.map(m => m.name).join(', ')}`);
        }
    }

    /**
     * Gère les erreurs de démarrage
     */
    async handleBootstrapError(error) {
        this.initializationAttempts++;
        
        if (this.initializationAttempts <= this.maxRetries) {
            console.warn(`Tentative ${this.initializationAttempts}/${this.maxRetries} échouée, nouvel essai dans 2 secondes...`);
            
            setTimeout(() => {
                this.bootstrap();
            }, 2000);
            
            return;
        }

        // Toutes les tentatives ont échoué
        console.error('🚫 Impossible de démarrer l\'application après', this.maxRetries, 'tentatives');
        
        this.showFallbackUI(error);
    }

    /**
     * Affiche une interface de secours en cas d'échec critique
     */
    showFallbackUI(error) {
        const container = document.body;
        const errorMessage = error?.message || 'Erreur inconnue';
        
        container.innerHTML = `
            <div style="
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                font-family: system-ui, -apple-system, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            ">
                <div style="
                    background: white; 
                    border-radius: 12px; 
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
                    padding: 40px; 
                    max-width: 600px; 
                    width: 100%;
                    text-align: center;
                ">
                    <div style="
                        width: 80px; 
                        height: 80px; 
                        background: #ff6b6b; 
                        border-radius: 50%; 
                        margin: 0 auto 20px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        font-size: 40px;
                    ">
                        ⚠️
                    </div>
                    
                    <h1 style="
                        color: #2c3e50; 
                        margin-bottom: 16px;
                        font-size: 28px;
                        font-weight: 600;
                    ">
                        Impossible de charger l'application
                    </h1>
                    
                    <p style="
                        color: #7f8c8d; 
                        margin-bottom: 30px;
                        line-height: 1.6;
                        font-size: 16px;
                    ">
                        Scanner Profile Manager n'a pas pu se charger correctement.<br>
                        Cela peut être dû à un problème de connectivité ou de configuration.
                    </p>

                    <div style="
                        background: #f8f9fa; 
                        border: 1px solid #e9ecef; 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin-bottom: 30px; 
                        text-align: left;
                    ">
                        <h3 style="
                            margin: 0 0 10px 0; 
                            color: #495057; 
                            font-size: 16px;
                        ">
                            Détails de l'erreur:
                        </h3>
                        <code style="
                            color: #e74c3c; 
                            font-size: 14px; 
                            word-break: break-word;
                        ">
                            ${this.escapeHtml(errorMessage)}
                        </code>
                    </div>

                    <div style="
                        display: flex; 
                        gap: 12px; 
                        justify-content: center; 
                        flex-wrap: wrap;
                    ">
                        <button onclick="location.reload()" style="
                            background: #3498db; 
                            color: white; 
                            border: none; 
                            padding: 12px 24px; 
                            border-radius: 8px; 
                            cursor: pointer; 
                            font-size: 16px; 
                            font-weight: 500;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                            🔄 Recharger la page
                        </button>
                        
                        <button onclick="window.open('/api-docs', '_blank')" style="
                            background: #95a5a6; 
                            color: white; 
                            border: none; 
                            padding: 12px 24px; 
                            border-radius: 8px; 
                            cursor: pointer; 
                            font-size: 16px; 
                            font-weight: 500;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#7f8c8d'" onmouseout="this.style.background='#95a5a6'">
                            📚 Documentation API
                        </button>
                    </div>

                    <details style="
                        margin-top: 30px; 
                        text-align: left;
                    ">
                        <summary style="
                            cursor: pointer; 
                            font-weight: 600; 
                            color: #7f8c8d; 
                            padding: 10px; 
                            border-radius: 4px;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='transparent'">
                            🔍 Informations techniques
                        </summary>
                        
                        <div style="
                            margin-top: 15px; 
                            padding: 15px; 
                            background: #2c3e50; 
                            color: #ecf0f1; 
                            border-radius: 4px; 
                            font-family: 'Courier New', monospace; 
                            font-size: 12px; 
                            overflow-x: auto;
                            white-space: pre-wrap;
                        ">
Tentatives d'initialisation: ${this.initializationAttempts}/${this.maxRetries}
Navigateur: ${navigator.userAgent}
URL: ${location.href}
Timestamp: ${new Date().toISOString()}

Stack trace:
${error?.stack || 'Non disponible'}
                        </div>
                    </details>
                </div>
            </div>
        `;
    }

    /**
     * Échappe le HTML pour éviter l'injection
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// =================== INITIALISATION AUTOMATIQUE ===================

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM déjà prêt
    initializeApp();
}

/**
 * Fonction d'initialisation principale
 */
async function initializeApp() {
    
    try {
        // Vérifier que les éléments DOM critiques sont présents
        const criticalElements = [
            'scannersGrid',
            'importZone', 
            'addPopup',
            'editPopup'
        ];
        
        const missingElements = criticalElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            throw new Error(`Éléments DOM manquants: ${missingElements.join(', ')}`);
        }
        
        // Créer et démarrer le bootstrap
        const bootstrap = new AppBootstrap();
        await bootstrap.bootstrap();
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        
        // Afficher un message d'erreur simple
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; background: #fff3cd; border: 1px solid #ffeaa7; margin: 20px; border-radius: 8px;">
                <h2 style="color: #856404;">Erreur d'initialisation</h2>
                <p>Impossible de charger l'application: ${error.message}</p>
                <button onclick="location.reload()" style="padding: 10px 20px; background: #ffc107; border: none; border-radius: 4px; cursor: pointer;">
                    Recharger
                </button>
            </div>
        `;
    }
}

// =================== UTILITAIRES GLOBAUX ===================

// Exposer des utilitaires de base même en cas d'échec de chargement
window.reloadApp = () => location.reload();
window.clearStorage = () => {
    try {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
    }
};

// Debug global
window.getAppStatus = () => {
    return {
        hasApp: !!window.app,
        appInitialized: window.app?.isInitialized || false,
        timestamp: new Date().toISOString(),
        url: location.href,
        userAgent: navigator.userAgent
    };
};

// =================== GESTION DES ERREURS DE MODULE ===================

// Gérer les erreurs de chargement de modules ES6
window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('Failed to resolve module specifier')) {
        console.error('Erreur de chargement de module:', e.message);
        
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; margin: 20px; border-radius: 8px;">
                <h2>Erreur de chargement</h2>
                <p><strong>Les modules JavaScript n'ont pas pu être chargés.</strong></p>
                <p>Cela peut indiquer un problème de configuration du serveur ou de structure des fichiers.</p>
                
                <div style="margin: 20px 0;">
                    <p>Vérifiez que tous les fichiers suivants sont présents:</p>
                    <ul style="text-align: left; display: inline-block; margin: 0;">
                        <li>config.js</li>
                        <li>utils.js</li>
                        <li>api-service.js</li>
                        <li>popup-manager.js</li>
                        <li>form-manager.js</li>
                        <li>ocr-config-manager.js</li>
                        <li>profile-manager.js</li>
                        <li>ocr-processing-manager.js</li>
                        <li>app-manager.js</li>
                        <li>main.js</li>
                    </ul>
                </div>
                
                <button onclick="location.reload()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    Recharger
                </button>
                
                <a href="/api-docs" target="_blank" style="display: inline-block; padding: 10px 20px; background: #6c757d; color: white; text-decoration: none; border-radius: 4px;">
                    Documentation
                </a>
            </div>
        `;
    }
});
