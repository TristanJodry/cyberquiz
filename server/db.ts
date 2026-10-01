import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Emplacement persistant de la base de données SQL (FHS : /var/lib/cyberquiz ou local ./data)
const DATA_DIR = process.env.CYBERQUIZ_DATA_DIR
  ? path.resolve(process.env.CYBERQUIZ_DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const DB_FILE = process.env.CYBERQUIZ_DB_PATH
  ? path.resolve(process.env.CYBERQUIZ_DB_PATH)
  : path.join(DATA_DIR, 'cyberquiz.db');

let dbInstance: Database | null = null;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('[DB] Erreur lors de la sauvegarde du fichier DB:', err);
  }
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      console.log('[DB] Base de données SQLite chargée depuis', DB_FILE);
    } catch (err) {
      console.error('[DB] Impossible de charger la base existante, réinitialisation...', err);
      dbInstance = new SQL.Database();
    }
  } else {
    console.log('[DB] Création d\'une nouvelle base de données SQLite...');
    dbInstance = new SQL.Database();
  }

  // Activer les clés étrangères
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Initialiser les tables et le seed
  initSchemaAndSeed(dbInstance);

  return dbInstance;
}

function initSchemaAndSeed(db: Database) {
  // Création des tables SQL relationnelles selon le cahier des charges
  db.run(`
    CREATE TABLE IF NOT EXISTS administrateurs (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      date_creation TEXT NOT NULL,
      date_derniere_connexion TEXT,
      doit_changer_mot_de_passe INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      entreprise TEXT NOT NULL,
      anonyme INTEGER NOT NULL DEFAULT 0,
      date_creation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('unique', 'multiple')),
      position INTEGER NOT NULL DEFAULT 1,
      statut TEXT NOT NULL DEFAULT 'actif' CHECK(statut IN ('actif', 'inactif', 'archive')),
      version_courante INTEGER NOT NULL DEFAULT 1,
      date_creation TEXT NOT NULL,
      date_modification TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions_questions (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      version_numero INTEGER NOT NULL,
      enonce TEXT NOT NULL,
      explication TEXT NOT NULL,
      date_creation TEXT NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS propositions (
      id TEXT PRIMARY KEY,
      version_question_id TEXT NOT NULL,
      texte TEXT NOT NULL,
      est_correcte INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (version_question_id) REFERENCES versions_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS participations (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      date_debut TEXT NOT NULL,
      date_fin TEXT,
      date_finalisation TEXT,
      statut TEXT NOT NULL DEFAULT 'en_cours' CHECK(statut IN ('en_cours', 'quiz_termine', 'termine', 'abandonne')),
      score_final INTEGER NOT NULL DEFAULT 0,
      nombre_questions INTEGER NOT NULL DEFAULT 0,
      pourcentage_reussite REAL NOT NULL DEFAULT 0.0,
      ordre_questions TEXT NOT NULL,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reponses_utilisateurs (
      id TEXT PRIMARY KEY,
      participation_id TEXT NOT NULL,
      version_question_id TEXT NOT NULL,
      propositions_selectionnees TEXT NOT NULL,
      est_correct INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      date_validation TEXT NOT NULL,
      FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
      FOREIGN KEY (version_question_id) REFERENCES versions_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rex (
      id TEXT PRIMARY KEY,
      participation_id TEXT UNIQUE NOT NULL,
      note_satisfaction INTEGER NOT NULL CHECK(note_satisfaction BETWEEN 1 AND 5),
      commentaire TEXT,
      appris_quelque_chose INTEGER DEFAULT NULL,
      appris_commentaire TEXT DEFAULT NULL,
      date_soumission TEXT NOT NULL,
      FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tentatives_connexion (
      ip TEXT PRIMARY KEY,
      tentatives INTEGER NOT NULL DEFAULT 0,
      dernier_essai INTEGER NOT NULL,
      verrouille_jusqua INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      date_execution TEXT NOT NULL
    );
  `);

  // Migration des colonnes REX si la base existe déjà
  try {
    db.run("ALTER TABLE rex ADD COLUMN appris_quelque_chose INTEGER DEFAULT NULL");
  } catch (e) {}
  try {
    db.run("ALTER TABLE rex ADD COLUMN appris_commentaire TEXT DEFAULT NULL");
  } catch (e) {}

  // Initialisation ou migration du compte administrateur
  const adminSetupFile = path.join(DATA_DIR, '.admin_setup.json');
  const adminCheck = db.exec("SELECT COUNT(*) as count FROM administrateurs");
  const adminCount = adminCheck.length > 0 && adminCheck[0].values.length > 0 ? (adminCheck[0].values[0][0] as number) : 0;
  
  if (adminCount === 0) {
    let adminUser = 'admin';
    let adminPass = 'admincesi123!';
    let mustChange = 1;

    // Si le script d'installation install.sh a transmis des identifiants personnalisés
    if (fs.existsSync(adminSetupFile)) {
      try {
        const rawSetup = fs.readFileSync(adminSetupFile, 'utf-8');
        const setupData = JSON.parse(rawSetup);
        if (setupData.username && setupData.username.trim()) {
          adminUser = setupData.username.trim();
        }
        if (setupData.password && setupData.password.trim()) {
          adminPass = setupData.password.trim();
          mustChange = 0; // Mot de passe personnalisé déjà défini lors de l'installation
        }
      } catch (err) {
        console.error('[DB] Erreur lecture fichier configuration administrateur temporaire:', err);
      } finally {
        try {
          fs.unlinkSync(adminSetupFile);
          console.log('[DB] Fichier temporaire d’installation administrateur nettoyé avec succès.');
        } catch (e) {}
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const initialHash = bcrypt.hashSync(adminPass, salt);
    const now = new Date().toISOString();
    
    db.run(
      `INSERT INTO administrateurs (id, username, password_hash, date_creation, doit_changer_mot_de_passe)
       VALUES (?, ?, ?, ?, ?)`,
      ['admin-initial-id', adminUser, initialHash, now, mustChange]
    );
    console.log(`[DB] Compte administrateur initial créé : ${adminUser} (changement obligatoire : ${mustChange === 1 ? 'oui' : 'non'})`);
  } else {
    // Si la base contient déjà un administrateur, ne jamais écraser silencieusement !
    if (fs.existsSync(adminSetupFile)) {
      try {
        fs.unlinkSync(adminSetupFile);
        console.log('[DB] Base existante détectée avec compte administrateur actif. Fichier temporaire nettoyé sans modification.');
      } catch (e) {}
    }
  }

  // Seed paramètres par défaut si absents
  const defaultParams: Record<string, string> = {
    'quiz_titre': 'Tous acteurs de notre cybersécurité',
    'quiz_sous_titre': 'Testez vos connaissances et contribuez à une culture numérique plus responsable.',
    'quiz_actif': '1',
    'ordre_questions': 'fixe', // 'fixe' ou 'aleatoire'
    'politique_confidentialite': 'Dans le cadre de notre démarche d’engagement RSE et de sensibilisation à la sécurité informatique, cette session recueille vos réponses de manière sécurisée afin de mesurer l’impact pédagogique global. Si vous choisissez le mode anonyme, aucune donnée nominative n’est stockée.',
    'duree_conservation': '12 mois',
    'contact_dpo': 'dpo-cybersecurite@entreprise.fr',
    'temps_estime': '5 minutes',
    'restriction_mode': 'delay', // 'none', 'delay', 'unique'
    'restriction_jours': '30'
  };

  for (const [cle, valeur] of Object.entries(defaultParams)) {
    const check = db.exec(`SELECT COUNT(*) FROM parametres WHERE cle = '${cle}'`);
    const count = check.length > 0 && check[0].values.length > 0 ? (check[0].values[0][0] as number) : 0;
    if (count === 0) {
      db.run("INSERT INTO parametres (cle, valeur) VALUES (?, ?)", [cle, valeur]);
    }
  }

  // Seed question de démonstration unique requise par le cahier des charges
  const questionCheck = db.exec("SELECT COUNT(*) FROM questions");
  const qCount = questionCheck.length > 0 && questionCheck[0].values.length > 0 ? (questionCheck[0].values[0][0] as number) : 0;

  if (qCount === 0) {
    const qId = 'q-demo-1';
    const vId = 'vq-demo-1-v1';
    const now = new Date().toISOString();

    // 1 question de démonstration à réponse unique
    db.run(
      `INSERT INTO questions (id, type, position, statut, version_courante, date_creation, date_modification)
       VALUES (?, 'unique', 1, 'actif', 1, ?, ?)`,
      [qId, now, now]
    );

    db.run(
      `INSERT INTO versions_questions (id, question_id, version_numero, enonce, explication, date_creation)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [
        vId,
        qId,
        'Exemple de question de démonstration : Vous recevez un e-mail inattendu contenant une pièce jointe et vous demandant de vérifier d’urgence vos identifiants. Quel réflexe devez-vous adopter ?',
        'Explication pédagogique de test : Ne jamais cliquer sur les liens ni ouvrir les pièces jointes suspectes. Vérifiez l’adresse de l’expéditeur et signalez le message à votre équipe sécurité ou DSI via les canaux officiels.',
        now
      ]
    );

    // Propositions fictives
    db.run(
      `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
       VALUES (?, ?, ?, ?, ?)`,
      ['prop-demo-1', vId, 'Ouvrir immédiatement la pièce jointe pour vérifier son contenu', 0, 1]
    );
    db.run(
      `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
       VALUES (?, ?, ?, ?, ?)`,
      ['prop-demo-2', vId, 'Ne pas ouvrir la pièce jointe et signaler l’e-mail au service sécurité / DSI', 1, 2]
    );
    db.run(
      `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
       VALUES (?, ?, ?, ?, ?)`,
      ['prop-demo-3', vId, 'Transférer l’e-mail à tous vos collègues pour les avertir', 0, 3]
    );
    db.run(
      `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
       VALUES (?, ?, ?, ?, ?)`,
      ['prop-demo-4', vId, 'Répondre directement à l’expéditeur pour lui demander des explications', 0, 4]
    );

    console.log('[DB] Question de démonstration unique initialisée.');
  }

  saveDatabase();
}

// Helpers de requêtes SQL
export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const results = query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export function run(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  saveDatabase();
}
