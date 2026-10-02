export type QuestionType = 'unique' | 'multiple';
export type QuestionDifficulty = 'facile' | 'moyen' | 'difficile';
export type QuestionStatus = 'actif' | 'inactif' | 'archive';
export type QuestionOrderMode = 'fixe' | 'aleatoire' | 'difficulte_croissante';
export type RestrictionMode = 'none' | 'delay' | 'unique';

export interface PublicConfig {
  titre: string;
  sous_titre: string;
  quiz_actif: boolean;
  politique_confidentialite: string;
  duree_conservation: string;
  contact_dpo: string;
  temps_estime?: string;
  restriction_mode: RestrictionMode;
  restriction_jours: number;
  nombre_questions_actives: number;
  pool_actif?: boolean;
  pool_taille?: number;
  pool_mode_repartition?: 'global' | 'par_difficulte';
  ordre_questions?: QuestionOrderMode;
}

export interface PoolSettings {
  ordre_questions: QuestionOrderMode;
  pool_actif: boolean;
  pool_taille: number;
  pool_mode_repartition: 'global' | 'par_difficulte';
  pool_nb_facile: number;
  pool_nb_moyen: number;
  pool_nb_difficile: number;
  total_questions_actives?: number;
  count_facile?: number;
  count_moyen?: number;
  count_difficile?: number;
}

export interface PropositionClient {
  id: string;
  texte: string;
  est_correcte?: boolean;
}

export interface QuestionClient {
  index: number;
  totalQuestions: number;
  type: QuestionType;
  enonce: string;
  propositions: PropositionClient[];
  isAnswered: boolean;
  reponse?: {
    selectedIds: string[];
    est_correct: boolean;
    points: number;
    explication: string;
  } | null;
}

export interface SubmitAnswerResult {
  success: boolean;
  est_correct: boolean;
  points: number;
  bonnes_reponses_ids: string[];
  explication: string;
  est_derniere_question: boolean;
  score_actuel: number;
}

export interface QuizResults {
  participationId: string;
  statut: string;
  totalQuestions: number;
  bonnesReponses: number;
  mauvaisesReponses: number;
  scoreFinal: number;
  pourcentageReussite: number;
  hasSubmittedRex: boolean;
  questions: Array<{
    numero: number;
    type: QuestionType;
    enonce: string;
    explication: string;
    propositions: Array<{
      id: string;
      texte: string;
      est_correcte: boolean;
    }>;
    reponseUtilisateur?: {
      selectedIds: string[];
      est_correct: boolean;
      points: number;
    } | null;
  }>;
}

export interface AdminUser {
  id: string;
  username: string;
  doitChangerMotDePasse: boolean;
  date_derniere_connexion?: string;
}

export interface QuestionAdmin {
  id: string;
  type: QuestionType;
  difficulte: QuestionDifficulty;
  position: number;
  statut: QuestionStatus;
  version_courante: number;
  date_creation: string;
  date_modification: string;
  enonce: string;
  explication: string;
  version_id: string;
  propositions: Array<{
    id: string;
    texte: string;
    est_correcte: boolean;
    position: number;
  }>;
  stats?: {
    totalReponses: number;
    totalCorrect: number;
    tauxReussite: number;
  };
}

export interface DashboardKPIs {
  totalParticipations: number;
  participationsAnonymes: number;
  participationsIdentifiees: number;
  questionnairesTermines: number;
  rexRecus: number;
  scoreMoyen: number;
  tauxReussiteMoyen: number;
  noteSatisfactionMoyenne: number;
}

export interface StatsResponse {
  distribution: Record<string, number>;
  timeline: Array<{ jour: string; count: number; avg_pct: number }>;
  questionsStats: Array<{
    questionId: string;
    enonce: string;
    total: number;
    correct: number;
    wrong: number;
    tauxReussite: number;
  }>;
  questionsDifficiles: Array<{
    questionId: string;
    enonce: string;
    total: number;
    correct: number;
    wrong: number;
    tauxReussite: number;
  }>;
  companyStats: Array<{
    entreprise: string;
    isAnonyme: boolean;
    nbParticipations: number;
    scoreMoyen: number;
    tauxReussite: number;
    satisfactionMoyenne: number | null;
  }>;
}
