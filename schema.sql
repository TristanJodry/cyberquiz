-- ==============================================================================
-- CyberQuiz RSE - Schéma SQL Relationnel (MariaDB / MySQL / PostgreSQL / SQLite)
-- Sensibilisation à la Cybersécurité & Mesure d'Impact RSE
-- ==============================================================================

-- 1. Table des administrateurs
CREATE TABLE IF NOT EXISTS administrateurs (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  date_creation VARCHAR(40) NOT NULL,
  date_derniere_connexion VARCHAR(40),
  doit_changer_mot_de_passe INT NOT NULL DEFAULT 1
);

-- 2. Table des paramètres applicatifs
CREATE TABLE IF NOT EXISTS parametres (
  cle VARCHAR(100) PRIMARY KEY,
  valeur TEXT NOT NULL
);

-- 3. Table des participants
CREATE TABLE IF NOT EXISTS participants (
  id VARCHAR(64) PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  prenom VARCHAR(150) NOT NULL,
  entreprise VARCHAR(200) NOT NULL,
  anonyme INT NOT NULL DEFAULT 0,
  date_creation VARCHAR(40) NOT NULL
);

-- 4. Table des questions (entité chapeau pour gestion et position)
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK(type IN ('unique', 'multiple')),
  position INT NOT NULL DEFAULT 1,
  statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK(statut IN ('actif', 'inactif', 'archive')),
  version_courante INT NOT NULL DEFAULT 1,
  date_creation VARCHAR(40) NOT NULL,
  date_modification VARCHAR(40) NOT NULL
);

-- 5. Table des versions de questions (immutabilité historique)
-- Chaque modification d'une question déjà utilisée engendre une nouvelle version
CREATE TABLE IF NOT EXISTS versions_questions (
  id VARCHAR(64) PRIMARY KEY,
  question_id VARCHAR(64) NOT NULL,
  version_numero INT NOT NULL,
  enonce TEXT NOT NULL,
  explication TEXT NOT NULL,
  date_creation VARCHAR(40) NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- 6. Table des propositions par version de question
CREATE TABLE IF NOT EXISTS propositions (
  id VARCHAR(64) PRIMARY KEY,
  version_question_id VARCHAR(64) NOT NULL,
  texte TEXT NOT NULL,
  est_correcte INT NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 1,
  FOREIGN KEY (version_question_id) REFERENCES versions_questions(id) ON DELETE CASCADE
);

-- 7. Table des sessions de participation
CREATE TABLE IF NOT EXISTS participations (
  id VARCHAR(64) PRIMARY KEY,
  participant_id VARCHAR(64) NOT NULL,
  date_debut VARCHAR(40) NOT NULL,
  date_fin VARCHAR(40),
  date_finalisation VARCHAR(40),
  statut VARCHAR(30) NOT NULL DEFAULT 'en_cours' CHECK(statut IN ('en_cours', 'quiz_termine', 'termine', 'abandonne')),
  score_final INT NOT NULL DEFAULT 0,
  nombre_questions INT NOT NULL DEFAULT 0,
  pourcentage_reussite REAL NOT NULL DEFAULT 0.0,
  ordre_questions TEXT NOT NULL,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- 8. Table des réponses détaillées des participants
CREATE TABLE IF NOT EXISTS reponses_utilisateurs (
  id VARCHAR(64) PRIMARY KEY,
  participation_id VARCHAR(64) NOT NULL,
  version_question_id VARCHAR(64) NOT NULL,
  propositions_selectionnees TEXT NOT NULL, -- JSON array des IDs de propositions choisies
  est_correct INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  date_validation VARCHAR(40) NOT NULL,
  FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE,
  FOREIGN KEY (version_question_id) REFERENCES versions_questions(id) ON DELETE CASCADE
);

-- 9. Table des retours d'expérience (REX)
CREATE TABLE IF NOT EXISTS rex (
  id VARCHAR(64) PRIMARY KEY,
  participation_id VARCHAR(64) UNIQUE NOT NULL,
  note_satisfaction INT NOT NULL CHECK(note_satisfaction BETWEEN 1 AND 5),
  commentaire TEXT,
  date_soumission VARCHAR(40) NOT NULL,
  FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE
);

-- 10. Table de sécurité (anti-bruteforce admin)
CREATE TABLE IF NOT EXISTS tentatives_connexion (
  ip VARCHAR(64) PRIMARY KEY,
  tentatives INT NOT NULL DEFAULT 0,
  dernier_essai BIGINT NOT NULL,
  verrouille_jusqua BIGINT NOT NULL DEFAULT 0
);

-- Index pour optimiser les performances des tableaux de bord et statistiques
CREATE INDEX IF NOT EXISTS idx_participations_date ON participations(date_debut);
CREATE INDEX IF NOT EXISTS idx_participations_statut ON participations(statut);
CREATE INDEX IF NOT EXISTS idx_participants_ent ON participants(entreprise);
CREATE INDEX IF NOT EXISTS idx_reponses_part ON reponses_utilisateurs(participation_id);
CREATE INDEX IF NOT EXISTS idx_reponses_version ON reponses_utilisateurs(version_question_id);
CREATE INDEX IF NOT EXISTS idx_rex_part ON rex(participation_id);
