// utils.js - Utilitaires généraux et fonctions communes

import { CONFIG } from './config.js';

/**
 * Classe utilitaire avec des méthodes statiques pour diverses opérations communes
 */
export class Utils {
    /**
     * Extrait une valeur d'un objet complexe (avec gestion des tableaux et objets xsi:nil)
     */
    static extractValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (Array.isArray(value)) {
            // Gérer xsi:nil dans les tableaux
            if (value.length === 1 && typeof value[0] === "object" && value[0].$ && value[0].$.hasOwnProperty("xsi:nil")) {
                return '';
            }
            if (value.length === 1 && typeof value[0] === "object" && !value[0].$) {
                return value[0];
            }
            // Si c'est un tableau avec une seule valeur primitive, l'extraire
            if (value.length === 1 && (typeof value[0] === 'string' || typeof value[0] === 'number' || typeof value[0] === 'boolean')) {
                return value[0];
            }
            if (value.length > 1) {
                return value.join(", ");
            }
        }
        
        if (value && typeof value === "object" && value.$ && value.$.hasOwnProperty("xsi:nil")) {
            return '';
        }
        if (typeof value === "object" && value !== null) {
            return value;
        }
        
        // Conversion des booléens string
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        return value;
    }

    /**
     * Définit une valeur dans un objet imbriqué à partir d'un chemin de clés
     */
    static setNestedValue(obj, keys, value) {
        if (!keys || keys.length === 0) return;
        
        const lastKey = keys.pop();
        const target = keys.reduce((curr, key) => {
            if (!curr[key] || typeof curr[key] !== 'object') {
                curr[key] = {};
            }
            return curr[key];
        }, obj);
        
        if (target && lastKey) {
            target[lastKey] = value;
        }
    }

    /**
     * Obtient une valeur d'un objet imbriqué à partir d'un chemin de clés
     */
    static getNestedValue(obj, path) {
        if (!path || !obj) return undefined;
        
        const keys = path.split('.');
        let result = obj;
        
        for (let key of keys) {
            if (result && typeof result === 'object' && result.hasOwnProperty(key)) {
                result = result[key];
            } else {
                return undefined;
            }
        }
        
        return result;
    }

    /**
     * Traite une valeur de formulaire (conversion de type)
     */
    static processValue(value) {
        if (value === 'true' || value === 'false') return value === 'true';
        if (value === 'on') return true; // Checkbox HTML
        if (!isNaN(value) && value !== '' && typeof value === 'string') {
            const num = Number(value);
            if (Number.isFinite(num)) return num;
        }
        return value;
    }

    /**
     * Échappe le HTML pour éviter l'injection de code
     */
    static escapeHtml(text) {
        if (text === null || text === undefined) return '';
        
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Valide un fichier selon les critères configurés
     */
    static validateFile(file) {
        const { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = CONFIG.VALIDATION;

        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: "Type de fichier non supporté. Veuillez utiliser PDF, JPG, PNG ou TIFF."
            };
        }

        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `Le fichier est trop volumineux. Taille maximum: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`
            };
        }

        return { valid: true };
    }

    /**
 * Génère un aperçu d'un pattern de nommage
 */
static generateNamingPreview(pattern) {
    if (!pattern) return 'Exemple: 18-09-2025-1';
    
    const patternStr = typeof pattern === 'string' ? pattern : String(pattern);
    const now = new Date();
    
    const replacements = {
        '$(YYYY)': now.getFullYear().toString(),
        '$(YY)': now.getFullYear().toString().slice(-2),
        '$(MM)': (now.getMonth() + 1).toString().padStart(2, '0'),
        '$(DD)': now.getDate().toString().padStart(2, '0'),
        '$(HH)': now.getHours().toString().padStart(2, '0'),
        '$(mm)': now.getMinutes().toString().padStart(2, '0'),
        '$(ss)': now.getSeconds().toString().padStart(2, '0'),
        '$(nnn)': '001',
        '$(nn)': '01',
        '$(n)': '1'
    };
    
    let preview = patternStr;
    
    // Trier par longueur décroissante
    const tokens = [
        '$(YYYY)', '$(nnn)', '$(YY)', '$(MM)', '$(DD)', 
        '$(HH)', '$(mm)', '$(ss)', '$(nn)', '$(n)'
    ];
    
    for (const token of tokens) {
        if (replacements[token]) {
            while (preview.includes(token)) {
                preview = preview.replace(token, replacements[token]);
            }
        }
    }
    
    return preview;
}


    /**
     * Débounce une fonction
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Clone profond d'un objet
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
        return obj;
    }

    /**
     * Formate une valeur pour l'affichage dans l'interface
     */
    static formatDisplayValue(value, fieldConfig = {}) {
        if (value === null || value === undefined || value === '') {
            return '<em>Non défini</em>';
        }
        
        if (fieldConfig.type === 'checkbox') {
            return (value === 'true' || value === true) ? 'Activé' : 'Désactivé';
        }
        
        if (fieldConfig.type === 'select' && fieldConfig.options && Array.isArray(fieldConfig.options)) {
            if (typeof fieldConfig.options[0] === 'object') {
                const option = fieldConfig.options.find(opt => opt.value === value);
                return option ? Utils.escapeHtml(option.label) : Utils.escapeHtml(String(value));
            }
        }
        
        return Utils.escapeHtml(String(value));
    }

    /**
     * Nettoie les URL blob pour éviter les fuites mémoire
     */
    static cleanupBlobUrls() {
        document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src && iframe.src.startsWith('blob:')) {
                URL.revokeObjectURL(iframe.src);
            }
        });

        document.querySelectorAll('a[href^="blob:"]').forEach(link => {
            URL.revokeObjectURL(link.href);
        });
    }

    /**
     * Collecte les données d'un formulaire et les structure
     */
    static collectFormData(formElement) {
        if (!formElement) {
            throw new Error('Élément de formulaire requis');
        }
        
        const formData = new FormData(formElement);
        const structuredData = {};
        
        // Traiter les champs avec valeurs
        for (let [key, value] of formData.entries()) {
            Utils.setNestedValue(structuredData, key.split('.'), Utils.processValue(value));
        }
        
        // Traiter les checkboxes non cochées
        formElement.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (!formData.has(checkbox.name)) {
                Utils.setNestedValue(structuredData, checkbox.name.split('.'), false);
            } else {
                Utils.setNestedValue(structuredData, checkbox.name.split('.'), true);
            }
        });
        
        // NOUVEAU : Capturer les champs masqués mais non désactivés (preserveValue)
        formElement.querySelectorAll('input:not([type="checkbox"]), select, textarea').forEach(field => {
            if (field.name && !field.disabled && !formData.has(field.name)) {
                // Le champ existe, n'est pas disabled, mais n'est pas dans FormData (probablement masqué)
                const value = field.value;
                if (value !== undefined && value !== null && value !== '') {
                    Utils.setNestedValue(structuredData, field.name.split('.'), Utils.processValue(value));
                }
            }
        });
        
        return structuredData;
    }

    /**
     * Affiche une notification toast
     */
    static showNotification(message, type = 'info', duration = null) {
        // Créer ou récupérer le conteneur
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications-container';
            container.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 400px;
            `;
            document.body.appendChild(container);
        }

        // Créer la notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background: ${CONFIG.UI.NOTIFICATION_COLORS[type] || CONFIG.UI.NOTIFICATION_COLORS.info};
            color: white; padding: 12px 16px; border-radius: 4px; margin-bottom: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;
            cursor: pointer; word-wrap: break-word; white-space: pre-line;
        `;
        
        notification.textContent = message;
        container.appendChild(notification);

        // Auto-suppression
        const hideDelay = duration || CONFIG.UI.NOTIFICATION_DURATION[type] || 5000;
        const timeoutId = setTimeout(() => {
            Utils.removeNotification(notification);
        }, hideDelay);

        // Suppression au clic
        notification.onclick = () => {
            clearTimeout(timeoutId);
            Utils.removeNotification(notification);
        };

        // Ajouter les styles d'animation si nécessaire
        Utils.addNotificationStyles();

        return notification;
    }

    /**
     * Supprime une notification avec animation
     */
    static removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    /**
     * Ajoute les styles CSS pour les notifications
     */
    static addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Export par défaut ET nommé pour compatibilité
export default Utils;