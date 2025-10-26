// config.js - Configuration centralisée de l'application

export const CONFIG = {
    // ✅ Endpoints API CORRIGÉS
    API: {
        BASE: "/profiles",
        PROFILE_CREATE: "/profiles/add",
        PROFILE_UPDATE: "/profiles",
        OCR: "/profile/ocr",
        SCANNERS: "scanners",
        FILES: "/api/files",
        
        // ✅ FIX: Utiliser les chemins relatifs corrects
        PROCESSING: "/api/upload",                      // Route principale (utilisée par le frontend)
        GENERATE_PATCH: "/api/upload/patch/generate",   // Génération de patch
        
        // Routes spécifiques (optionnelles)
        OCR_ONLY: "/api/upload/ocr",
        CONVERT_PDFA: "/api/upload/convert-pdfa",
        PATCH_SPLIT: "/api/upload/patch/split",
    },

    // Options des champs de formulaire
    FIELD_OPTIONS: {
        BitDepth: ["C24Bit", "C8Bit"],
        PaperSource: ["Glass", "Feeder"],
        Resolution: ["Dpi50", "Dpi100", "Dpi150", "Dpi200", "Dpi300", "Dpi400", "Dpi600"],
        PageSize: ["Letter", "A4", "Legal", "Custom"],
        PageAlign: ["Left", "Center", "Right"],
        DriverName: ["twain", "wia"],
        TwainImpl: ["Default", "OldDsm", "Legacy"],
        WiaVersion: ["Default", "1.0", "2.0"],
        AfterScanScale: ["OneToOne", "FitToPage", "Custom"]
    },

    // Champs à préserver lors de la sérialisation
    PRESERVE_NULL_FIELDS: [
        'IconUri', 'ConnectionUri', 'Caps', 'CustomPageSizeName', 
        'CustomPageSize', 'AutoSaveSettings', 'KeyValueOptions'
    ],

    // Validation des fichiers
    VALIDATION: {
        ALLOWED_FILE_TYPES: [
            'application/pdf',
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/tiff',
            'image/tif'
        ],
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    },

    // Configuration OCR/Patch
    OCR: {
        DEFAULT_LANG: 'fra',
        DEFAULT_PDF_MODE: 'pdfa',
        DEFAULT_PATCH_TYPE: 'T_classique',
        DEFAULT_PATCH_NAMING: 'barcode_ocr_generic',
        DEFAULT_MODE_OCR: 'auto',

        LANGUAGES: [
            { value: '', label: 'Détection automatique' },
            { value: 'fra', label: 'Français' },
            { value: 'eng', label: 'Anglais' },
            { value: 'ara', label: 'Arabe' }
        ],

        OCR_MODES: [
            {
                value: 'auto',
                label: 'Automatique (recommandé)',
                description: 'Détecte automatiquement si le PDF nécessite un OCR'
            },
            {
                value: 'force',
                label: 'Forcer l\'OCR',
                description: 'Force l\'OCR même si le PDF contient déjà du texte'
            },
            {
                value: 'skip',
                label: 'Ignorer l\'OCR',
                description: 'Ignore l\'OCR même si le PDF est une image'
            }
        ],

        PDF_MODES: [
            { value: 'pdfa', label: 'PDF/A (archivage)' },
            { value: 'pdf', label: 'PDF standard' }
        ],
        
        PATCH_TYPES: [
            { value: 'T_classique', label: '⚡ Traitement avec multi-fichiers' },
            { value: 'T_with_bookmarks', label: '🔖 Traitement avec un seul fichier' }
        ],

        PATCH_STRATEGIES: [
            {
                value: 'barcode_ocr_generic',
                label: '🎯 Code-barres → OCR → Générique',
                description: 'Le système essaiera d\'abord les codes-barres, puis l\'OCR, puis un nom générique'
            },
            {
                value: 'barcode',
                label: '📊 Code-barres uniquement',
                description: 'Utilise uniquement les codes-barres pour nommer les fichiers'
            },
            {
                value: 'ocr',
                label: '🔤 OCR de texte uniquement',
                description: 'Utilise uniquement la reconnaissance de texte pour nommer les fichiers'
            },
            {
                value: 'generic',
                label: '📝 Nommage générique',
                description: 'Utilise un schéma de nommage générique basé sur la date/heure'
            },
            {
                value: 'vide',
                label: '📝 Aucun',
                description: 'Aucun'
            }
        ]
    },

    // Thèmes et interface
    UI: {
        NOTIFICATION_DURATION: {
            success: 5000,
            error: 8000,
            warning: 5000,
            info: 5000
        },
        
        NOTIFICATION_COLORS: {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        },
        
        RESET_BUTTON_STYLE: `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
            margin-left: 10px;
        `
    }
};

export default CONFIG;