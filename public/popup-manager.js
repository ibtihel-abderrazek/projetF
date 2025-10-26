// popup-manager.js - Gestionnaire des popups et modales

/**
 * Gestionnaire centralisé pour toutes les popups et modales de l'application
 */
export class PopupManager {
    constructor() {
        this.activePopups = new Set();
        this.setupGlobalEventListeners();
    }

    /**
     * Configure les event listeners globaux pour les popups
     */
    setupGlobalEventListeners() {
        // Fermeture des popups avec la touche Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activePopups.size > 0) {
                const lastPopup = Array.from(this.activePopups).pop();
                this.hide(lastPopup, true);
            }
        });

        // Fermeture des popups en cliquant à l'extérieur
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('popup')) {
                const popupId = e.target.id;
                if (this.activePopups.has(popupId)) {
                    this.hide(popupId, true);
                }
            }
        });
    }

    /**
     * Affiche une popup
     * @param {string} popupId - ID de la popup à afficher
     * @param {boolean} resetTabs - Si true, remet les onglets à leur état initial
     */
    show(popupId, resetTabs = false) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`Popup ${popupId} non trouvée`);
            return;
        }

        popup.style.display = 'flex';
        popup.setAttribute('aria-hidden', 'false');
        this.activePopups.add(popupId);

        if (resetTabs) {
            this.resetTabs(popupId);
        }

        // Focus sur le premier élément focusable
        setTimeout(() => {
            this.focusFirstElement(popup);
        }, 100);

        // Déclencher un événement personnalisé
        popup.dispatchEvent(new CustomEvent('popupShown', { detail: { popupId } }));
    }

    /**
     * Cache une popup
     * @param {string} popupId - ID de la popup à cacher
     * @param {boolean} resetForm - Si true, remet les formulaires à zéro
     */
    hide(popupId, resetForm = false) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`Popup ${popupId} non trouvée`);
            return;
        }

        popup.style.display = 'none';
        popup.setAttribute('aria-hidden', 'true');
        this.activePopups.delete(popupId);

        if (resetForm) {
            this.resetTabs(popupId);
            this.resetForms(popupId);
        }

        // Déclencher un événement personnalisé
        popup.dispatchEvent(new CustomEvent('popupHidden', { detail: { popupId } }));
    }

    /**
     * Bascule l'état d'une popup
     * @param {string} popupId - ID de la popup
     */
    toggle(popupId) {
        if (this.activePopups.has(popupId)) {
            this.hide(popupId, true);
        } else {
            this.show(popupId, true);
        }
    }

    /**
     * Remet les onglets d'une popup à leur état initial
     * @param {string} popupId - ID de la popup
     */
    resetTabs(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;

        const firstTab = popup.querySelector('.tab-btn');
        const firstPane = popup.querySelector('.tab-pane');
        
        popup.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        popup.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        if (firstTab) firstTab.classList.add('active');
        if (firstPane) firstPane.classList.add('active');
    }

    /**
     * Remet les formulaires d'une popup à zéro
     * @param {string} popupId - ID de la popup
     */
    resetForms(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;

        popup.querySelectorAll('form').forEach(form => {
            form.reset();
            
            // Réinitialiser les champs personnalisés
            form.querySelectorAll('.pattern-input').forEach(input => {
                input.value = '';
                const preview = document.getElementById(input.id + '_preview');
                if (preview) {
                    preview.textContent = 'Exemple: 18-09-2025-1';
                }
            });

            // Réinitialiser les états de visibilité des champs dépendants
            form.querySelectorAll('input[type="checkbox"][data-toggles]').forEach(checkbox => {
                const event = new Event('change', { bubbles: true });
                checkbox.dispatchEvent(event);
            });
        });
    }

    /**
     * Change d'onglet dans une popup
     * @param {Event} evt - Événement du clic
     * @param {string} tabName - Nom/ID de l'onglet à activer
     */
    switchTab(evt, tabName) {
        const tabContainer = evt.currentTarget.closest('.tab-container');
        if (!tabContainer) return;
        
        tabContainer.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
            evt.currentTarget.classList.add('active');
        }
    }

    /**
     * Met le focus sur le premier élément focusable d'une popup
     * @param {HTMLElement} popup - Élément popup
     */
    focusFirstElement(popup) {
        const focusableElements = popup.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }

    /**
     * Vérifie si une popup est actuellement visible
     * @param {string} popupId - ID de la popup
     * @returns {boolean}
     */
    isVisible(popupId) {
        return this.activePopups.has(popupId);
    }

    /**
     * Ferme toutes les popups actives
     */
    closeAll() {
        Array.from(this.activePopups).forEach(popupId => {
            this.hide(popupId, true);
        });
    }

    /**
     * Récupère la liste des popups actives
     * @returns {Array<string>}
     */
    getActivePopups() {
        return Array.from(this.activePopups);
    }

    /**
     * Configure une popup avec des options personnalisées
     * @param {string} popupId - ID de la popup
     * @param {Object} options - Options de configuration
     */
    configurePopup(popupId, options = {}) {
        const popup = document.getElementById(popupId);
        if (!popup) return;

        const {
            closeOnEscape = true,
            closeOnOutsideClick = true,
            autoFocus = true,
            className = ''
        } = options;

        if (className) {
            popup.classList.add(className);
        }

        // Stocker les options dans les data attributes pour référence future
        popup.dataset.closeOnEscape = closeOnEscape;
        popup.dataset.closeOnOutsideClick = closeOnOutsideClick;
        popup.dataset.autoFocus = autoFocus;
    }

    /**
     * Ajoute un listener d'événement pour une popup spécifique
     * @param {string} popupId - ID de la popup
     * @param {string} eventType - Type d'événement ('shown', 'hidden', etc.)
     * @param {Function} callback - Fonction de callback
     */
    addEventListener(popupId, eventType, callback) {
        const popup = document.getElementById(popupId);
        if (!popup) return;

        const eventName = `popup${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`;
        popup.addEventListener(eventName, callback);
    }

    /**
     * Supprime un listener d'événement d'une popup
     * @param {string} popupId - ID de la popup
     * @param {string} eventType - Type d'événement
     * @param {Function} callback - Fonction de callback
     */
    removeEventListener(popupId, eventType, callback) {
        const popup = document.getElementById(popupId);
        if (!popup) return;

        const eventName = `popup${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`;
        popup.removeEventListener(eventName, callback);
    }
}

export default PopupManager;