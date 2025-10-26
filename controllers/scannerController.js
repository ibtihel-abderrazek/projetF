const path = require('path');

class ScannerController {
    constructor() {
        // Chemin vers l'exécutable NAPS2 (ajustez selon votre installation)
        this.naps2Path = path.join('bin', 'naps2', 'App', 'NAPS2.Console.exe');
        
        // Bind des méthodes dans le constructeur
        this.getConnectedScanners = this.getConnectedScanners.bind(this);
    }

    /**
     * Récupère la liste des scanners connectés via NAPS2 (WIA + TWAIN)
     */
    async getConnectedScanners(req, res) {
        try {
            // Récupérer les scanners des deux drivers
            const [wiaScanners, twainScanners] = await Promise.all([
                this.getScannersByDriver('wia'),
                this.getScannersByDriver('twain')
            ]);
            
            // ✅ CORRECTION: Ajouter explicitement le driver à chaque scanner
            const allScanners = [
                ...wiaScanners.map(s => ({ 
                    ...s, 
                    driver: 'wia',
                    displayName: s.displayName || `${s.name} (WIA - sans fil)`
                })),
                ...twainScanners.map(s => ({ 
                    ...s, 
                    driver: 'twain',
                    displayName: s.displayName || `${s.name} (TWAIN - avec fil)`
                }))
            ];
            
            console.log(`📡 Total scanners trouvés: ${allScanners.length} (WIA: ${wiaScanners.length}, TWAIN: ${twainScanners.length})`);
            
            // ✅ DEBUG: Afficher les scanners avec leur driver
            allScanners.forEach(s => {
                console.log(`  - ${s.name} [driver: ${s.driver}]`);
            });
            
            res.json({
                success: true,
                scanners: allScanners,
                count: allScanners.length,
                details: {
                    wia: wiaScanners.length,
                    twain: twainScanners.length
                }
            });
            
        } catch (error) {
            console.error('Erreur lors de la récupération des scanners:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des scanners',
                details: error.message
            });
        }
    }

    /**
     * Récupère les scanners pour un driver spécifique
     */
    async getScannersByDriver(driver) {
        try {
            const command = `"${this.naps2Path}" --driver ${driver} --listdevices`;
            const scanners = await this.executeNaps2Command(command, driver);
            return scanners;
        } catch (error) {
            console.error(`Erreur lors de la récupération des scanners ${driver}:`, error);
            // Retourner un tableau vide en cas d'erreur pour ne pas bloquer l'autre driver
            return [];
        }
    }

    /**
     * Exécute une commande NAPS2
     */
    async executeNaps2Command(command, driver) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            const { stdout, stderr } = await execAsync(command);
            
            // Ignorer l'avertissement Qt spécifique
            if (stderr && !stderr.includes('Qt: Untested Windows version')) {
                console.warn(`NAPS2 warning (${driver}):`, stderr);
            }
            
            // Parser la sortie pour extraire les scanners
            const scanners = this.parseScannerOutput(stdout, driver);
            return scanners;
            
        } catch (error) {
            console.error(`Erreur exécution NAPS2 (${driver}):`, error);
            throw error;
        }
    }
/**
 * Parser la sortie de NAPS2 (VERSION CORRIGÉE)
 */
parseScannerOutput(output, driver) {
    if (!output || output.trim() === '') {
        console.log(`Aucune sortie de NAPS2 pour ${driver}`);
        return [];
    }

    console.log(`Sortie brute NAPS2 (${driver}):`, output);
    
    const lines = output.split('\n').filter(line => line.trim());
    const scanners = [];
    
    lines.forEach((line, index) => {
        line = line.trim();
        
        // Ignorer les lignes vides et les messages système
        if (line === '' || 
            line.includes('Qt:') || 
            line.includes('Untested') ||
            line.includes('No devices') || 
            line.includes('Beginning') ||
            line.includes('Starting') ||
            line.includes('Finished') ||
            line.includes('Error')) {
            return;
        }
        
        if (line.length > 2) {
            const driverLabel = driver.toUpperCase();
            const connectionType = driver === 'twain' ? 'avec fil' : 'sans fil';
            
            scanners.push({
                id: line,
                name: line,
                driver: driver,
                status: 'available',
                displayName: `${line} (${driverLabel} - ${connectionType})`,
                isConnected: true  // ✅ NOUVEAU: Marquer comme connecté
            });
            
            console.log(`  ✅ Scanner ajouté: "${line}" avec driver="${driver}"`);
        }
    });
    
    console.log(`${scanners.length} scanner(s) trouvé(s) avec ${driver}`);
    return scanners;
}
}

// Export du contrôleur
const scannerController = new ScannerController();
module.exports = ScannerController;