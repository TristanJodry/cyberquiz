import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

async function performBackup() {
  const destFile = process.argv[2];
  const sourceDbArg = process.argv[3];
  if (!destFile) {
    console.error('Usage: tsx scripts/backup.ts <destination_path> [source_db_path]');
    process.exit(1);
  }

  const dbPath = sourceDbArg
    || process.env.CYBERQUIZ_DB_PATH
    || (process.env.CYBERQUIZ_DATA_DIR ? path.join(process.env.CYBERQUIZ_DATA_DIR, 'cyberquiz.db') : path.resolve(process.cwd(), 'data', 'cyberquiz.db'));

  if (!fs.existsSync(dbPath)) {
    console.error(`[BACKUP] Fichier de base de données source introuvable à : ${dbPath}`);
    process.exit(1);
  }

  const destDir = path.dirname(destFile);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    const SQL = await initSqlJs();
    const sourceBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(sourceBuffer);

    // Vérification de cohérence SQLite (PRAGMA integrity_check)
    const check = db.exec('PRAGMA integrity_check');
    if (check.length > 0 && check[0].values.length > 0) {
      const result = check[0].values[0][0];
      if (result !== 'ok') {
        throw new Error(`Échec du contrôle d'intégrité SQLite: ${result}`);
      }
    }

    // Export binaire propre
    const exportedData = db.export();
    const buffer = Buffer.from(exportedData);
    fs.writeFileSync(destFile, buffer);
    db.close();

    // Permissions strictes
    try {
      fs.chmodSync(destFile, 0o600);
    } catch (e) {}

    console.log(`[BACKUP] Sauvegarde cohérente générée avec succès : ${destFile} (${buffer.length} octets)`);
  } catch (err) {
    console.error('[BACKUP] Erreur critique lors de la sauvegarde SQLite:', err);
    process.exit(1);
  }
}

performBackup();
