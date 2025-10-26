import { CONFIG } from './config.js';

/**
 * Service centralisé pour toutes les communications API
 */
export class ApiService {
    /**
     * Méthode générique pour effectuer des appels API
     */
    static async call(endpoint, method = 'GET', data = null, options = {}) {
    try {
        const requestOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        if (data && method !== 'GET') {
            if (data instanceof FormData) {
                delete requestOptions.headers['Content-Type'];
                requestOptions.body = data;
            } else {
                requestOptions.body = JSON.stringify(data);
            }
        }
        
        const response = await fetch(endpoint, requestOptions);
        
        // ✅ CORRECTION : Vérifier le content-type AVANT de lire le body
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
            // Lire le body UNE SEULE FOIS
            let errorMessage;
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error || `Erreur ${response.status}: ${response.statusText}`;
            } else {
                const errorText = await response.text();
                errorMessage = errorText || `Erreur ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        // Réponse OK : parser selon le content-type
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        // Pour les autres types (blob, text, etc.)
        return response;
        
    } catch (error) {
        console.error('Erreur API:', error);
        throw error;
    }
}

    // =================== GESTION DES PROFILS ===================
    
    /**
     * Récupère la liste de tous les profils
     */
    static async getProfiles() {
        return this.call(CONFIG.API.BASE);
    }
    
    /**
     * Récupère un profil spécifique par nom
     */
    static async getProfile(name) {
        return this.call(`${CONFIG.API.BASE}/${encodeURIComponent(name)}`);
    }
    
    /**
     * Crée un nouveau profil
     */
    static async createProfile(data) {
        try {
            return await this.call(CONFIG.API.PROFILE_CREATE, 'POST', data);
        } catch (error) {
            // Fallback vers l'endpoint alternatif si le premier échoue
            if (error.message.includes('404')) {
                console.warn('Endpoint principal non trouvé, tentative avec endpoint alternatif');
                return await this.call(`${CONFIG.API.BASE}`, 'POST', data);
            }
            throw error;
        }
    }
    
    /**
     * Met à jour un profil existant
     */
    static async updateProfile(name, data) {
        return this.call(`${CONFIG.API.PROFILE_UPDATE}/${encodeURIComponent(name)}`, 'PUT', data);
    }
    
    /**
     * Supprime un profil
     */
    static async deleteProfile(name) {
        return this.call(`${CONFIG.API.BASE}/${encodeURIComponent(name)}`, 'DELETE');
    }

    // =================== GESTION OCR ===================
    
    /**
     * Sauvegarde une configuration OCR
     */
    static async saveOcrConfig(config) {
        return this.call(CONFIG.API.OCR, 'POST', config);
    }

    /**
     * Récupère la configuration OCR d'un profil
     */
    static async getOcrConfig(profileName) {
        const timestamp = Date.now();
        return this.call(`${CONFIG.API.OCR}/${encodeURIComponent(profileName)}?_t=${timestamp}`);
    }

    /**
     * Supprime la configuration OCR d'un profil
     */
    static async deleteOcrConfig(profileName) {
        return this.call(`${CONFIG.API.OCR}/${encodeURIComponent(profileName)}`, 'DELETE');
    }

    /**
     * Récupère les stratégies Patch disponibles
     */
    static async getPatchStrategies() {
        try {
            const response = await this.call(`${CONFIG.API.OCR}/patch/strategies`);
            return response.strategies || CONFIG.OCR.PATCH_STRATEGIES;
        } catch (error) {
            console.warn('Erreur chargement stratégies Patch, utilisation des valeurs par défaut:', error);
            return CONFIG.OCR.PATCH_STRATEGIES;
        }
    }

    // =================== GESTION DES SCANNERS ===================
    
    /**
     * Récupère la liste des scanners disponibles
     */
    static async getScanners() {
        return this.call(CONFIG.API.SCANNERS);
    }

    // =================== TRAITEMENT DE FICHIERS ===================
    
    /**
     * Traite un fichier (OCR, Patch, ou les deux)
     */
    static async processFile(formData) {
        return this.call(CONFIG.API.PROCESSING, 'POST', formData);
    }

    /**
     * Génère un patch à partir de données texte
     */
    static async generatePatch(patchData) {
        return this.call(CONFIG.API.GENERATE_PATCH, 'POST', { patchData });
    }

    // =================== GESTION DU SCAN ===================
    
    /**
     * Lance un scan avec un profil spécifique
     */
    static async triggerScan(profileName) {
        return this.call('/api/scan', 'POST', {
            profileName: profileName,
            action: 'scan'
        });
    }

    /**
     * Traite un scan avec configuration Patch
     */
    static async processScanWithPatch(patchData) {
        return this.call('/api/scan/patch', 'POST', patchData);
    }

    // =================== GESTION DES FICHIERS IMPORTÉS ===================
    
    /**
     * Récupère la liste des fichiers importés
     */
    static async getImportedFiles() {
        return this.call(`${CONFIG.API.FILES}/imported`);
    }

    /**
     * Télécharge un fichier importé
     */
    static async downloadImportedFile(fileName) {
        const response = await this.call(`${CONFIG.API.FILES}/download/${fileName}`, 'GET');
        return response; // Retourne la Response pour traitement du blob
    }

    /**
     * Supprime un fichier importé
     */
    static async deleteImportedFile(fileName) {
        return this.call(`${CONFIG.API.FILES}/delete/${fileName}`, 'DELETE');
    }

    // =================== UTILITAIRES ===================
    
    /**
     * Vérifie la santé du serveur
     */
    static async healthCheck() {
        try {
            const response = await this.call('/api/health');
            return response.ok || true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Wrapper pour les requêtes avec gestion d'erreur personnalisée
     */
    static async safeCall(endpoint, method = 'GET', data = null, options = {}) {
        try {
            return {
                success: true,
                data: await this.call(endpoint, method, data, options)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Upload de fichier avec progression (si nécessaire)
     */
    static async uploadFileWithProgress(file, endpoint, onProgress = null) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);

            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
            }

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        resolve(xhr.response);
                    }
                } else {
                    reject(new Error(`Erreur upload: ${xhr.status} ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Erreur réseau lors de l\'upload'));
            });

            xhr.open('POST', endpoint);
            xhr.send(formData);
        });
    }

    /**
     * Récupération de données avec cache
     */
    static async getCachedData(key, endpoint, cacheDuration = 300000) { // 5 minutes par défaut
        const cacheKey = `api_cache_${key}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < cacheDuration) {
                return data;
            }
        }
        
        try {
            const data = await this.call(endpoint);
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            return data;
        } catch (error) {
            // En cas d'erreur, retourner les données en cache si disponibles
            if (cached) {
                const { data } = JSON.parse(cached);
                console.warn('Utilisation du cache en raison d\'une erreur API:', error);
                return data;
            }
            throw error;
        }
    }

    /**
     * Nettoie le cache API
     */
    static clearCache(pattern = 'api_cache_') {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(pattern)) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Export par défaut ET nommé pour compatibilité
export default ApiService;