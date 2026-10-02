import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase, query, queryOne, run } from './db.js';
import * as XLSX from 'xlsx';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cyberquiz-rse-secret-super-secure-key-2026';

// ============================================================================
// 0. CONTRÔLE DE SANTÉ (HEALTH CHECK)
// ============================================================================

router.get('/health', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    // Test direct de connectivité et de fonctionnement de la base SQL
    const check = queryOne<{ ok: number }>('SELECT 1 as ok');
    if (!check || check.ok !== 1) {
      res.status(503).json({ status: 'error', database: 'unavailable' });
      return;
    }

    res.json({
      status: 'ok',
      service: 'cyberquiz',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({ status: 'error', message: 'Service temporairement indisponible' });
  }
});


// Middleware d'authentification Administrateur
export interface AuthRequest extends Request {
  adminId?: string;
  username?: string;
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Accès non autorisé. Token administrateur manquant.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string; username: string };
    req.adminId = decoded.adminId;
    req.username = decoded.username;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
    return;
  }
}

// ============================================================================
// 1. ROUTES PUBLIQUES (Quiz & Session Participant)
// ============================================================================

// Configuration publique pour la page d'accueil
router.get('/public/config', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const rows = query<{ cle: string; valeur: string }>('SELECT cle, valeur FROM parametres');
    const config: Record<string, string> = {};
    rows.forEach(r => { config[r.cle] = r.valeur; });

    // Compter le nombre de questions actives
    const qCountRow = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM questions WHERE statut = 'actif'"
    );

    const poolActif = config['pool_actif'] === '1';
    const poolTaille = parseInt(config['pool_taille'] || '10', 10) || 10;
    const totalActives = qCountRow ? qCountRow.count : 0;
    const effectiveQuestionCount = poolActif ? Math.min(poolTaille, totalActives) : totalActives;

    res.json({
      titre: config['quiz_titre'] || 'Tous acteurs de notre cybersécurité',
      sous_titre: config['quiz_sous_titre'] || 'Testez vos connaissances et contribuez à une culture numérique plus responsable.',
      quiz_actif: config['quiz_actif'] === '1',
      politique_confidentialite: config['politique_confidentialite'] || '',
      duree_conservation: config['duree_conservation'] || '12 mois',
      contact_dpo: config['contact_dpo'] || '',
      temps_estime: config['temps_estime'] || '5 minutes',
      restriction_mode: (['none', 'delay', 'unique'].includes(config['restriction_mode']) ? config['restriction_mode'] : 'delay') as any,
      restriction_jours: parseInt(config['restriction_jours'] || '30', 10) || 30,
      nombre_questions_actives: effectiveQuestionCount,
      pool_actif: poolActif,
      pool_taille: poolTaille,
      pool_mode_repartition: config['pool_mode_repartition'] || 'global',
      ordre_questions: (['fixe', 'aleatoire', 'difficulte_croissante'].includes(config['ordre_questions']) ? config['ordre_questions'] : 'fixe') as any
    });
  } catch (err: any) {
    console.error('Erreur config publique:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la configuration.' });
  }
});

// Helper pour mélanger un tableau (algorithme de Fisher-Yates)
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Démarrer une nouvelle participation
router.post('/public/start-session', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { anonyme, nom, prenom, entreprise } = req.body;

    // Vérifier si le quiz est actif
    const configRow = queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'quiz_actif'");
    if (configRow && configRow.valeur !== '1') {
      res.status(403).json({ error: 'Le quiz est actuellement indisponible. Merci de revenir ultérieurement.' });
      return;
    }

    const estAnonyme = Boolean(anonyme);
    let finalNom = 'Anonyme';
    let finalPrenom = 'Anonyme';
    let finalEntreprise = 'Anonyme';

    if (!estAnonyme) {
      if (!nom || !prenom || !entreprise || !nom.trim() || !prenom.trim() || !entreprise.trim()) {
        res.status(400).json({ error: 'Veuillez renseigner votre Nom, Prénom et Entreprise, ou choisir la participation anonyme.' });
        return;
      }
      finalNom = nom.trim();
      finalPrenom = prenom.trim();
      finalEntreprise = entreprise.trim();
    }

    // Récupérer les questions actives avec leur version courante et difficulté
    const activeQuestions = query<{
      id: string;
      type: string;
      difficulte: string;
      position: number;
      version_courante: number;
      version_id: string;
    }>(`
      SELECT q.id, q.type, COALESCE(q.difficulte, 'moyen') as difficulte, q.position, q.version_courante, v.id as version_id
      FROM questions q
      JOIN versions_questions v ON v.question_id = q.id AND v.version_numero = q.version_courante
      WHERE q.statut = 'actif'
      ORDER BY q.position ASC
    `);

    if (activeQuestions.length === 0) {
      res.status(400).json({ error: 'Aucune question active n’est disponible pour le moment. Veuillez contacter l’administrateur.' });
      return;
    }

    // Récupérer les paramètres de diffusion et de pool
    const ordreParam = queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'ordre_questions'");
    const ordreMode = ordreParam?.valeur || 'fixe'; // 'fixe', 'aleatoire', 'difficulte_croissante'

    const poolActifParam = queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'pool_actif'");
    const poolActif = poolActifParam?.valeur === '1';

    const poolTailleParam = queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'pool_taille'");
    const poolTaille = parseInt(poolTailleParam?.valeur || '10', 10) || 10;

    const poolModeParam = queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'pool_mode_repartition'");
    const poolMode = poolModeParam?.valeur || 'global'; // 'global' ou 'par_difficulte'

    const poolNbFacile = parseInt(queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'pool_nb_facile'")?.valeur || '3', 10) || 0;
    const poolNbMoyen = parseInt(queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'pool_nb_moyen'")?.valeur || '4', 10) || 0;
    const poolNbDifficile = parseInt(queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'pool_nb_difficile'")?.valeur || '3', 10) || 0;

    // 1. Sélection des questions (Tirage Pool ou totalité des questions actives)
    let selectedQuestions: typeof activeQuestions = [];

    if (poolActif) {
      if (poolMode === 'par_difficulte') {
        const faciles = shuffleArray(activeQuestions.filter(q => q.difficulte === 'facile'));
        const moyens = shuffleArray(activeQuestions.filter(q => q.difficulte === 'moyen'));
        const difficiles = shuffleArray(activeQuestions.filter(q => q.difficulte === 'difficile'));

        const pickedFacile = faciles.slice(0, Math.max(0, poolNbFacile));
        const pickedMoyen = moyens.slice(0, Math.max(0, poolNbMoyen));
        const pickedDifficile = difficiles.slice(0, Math.max(0, poolNbDifficile));

        selectedQuestions = [...pickedFacile, ...pickedMoyen, ...pickedDifficile];
        if (selectedQuestions.length === 0) {
          selectedQuestions = shuffleArray(activeQuestions).slice(0, Math.min(poolTaille, activeQuestions.length));
        }
      } else {
        // Mode global : tirage aléatoire de N questions
        const target = Math.max(1, Math.min(poolTaille, activeQuestions.length));
        selectedQuestions = shuffleArray(activeQuestions).slice(0, target);
      }
    } else {
      selectedQuestions = [...activeQuestions];
    }

    // 2. Ordonnancement des questions sélectionnées
    let questionsOrder: typeof activeQuestions = [];

    if (ordreMode === 'difficulte_croissante') {
      // Commence par les questions faciles (aléatoires au sein de la catégorie),
      // puis moyennes (aléatoires), puis difficiles (aléatoires)
      const qFaciles = shuffleArray(selectedQuestions.filter(q => q.difficulte === 'facile'));
      const qMoyens = shuffleArray(selectedQuestions.filter(q => q.difficulte === 'moyen'));
      const qDifficiles = shuffleArray(selectedQuestions.filter(q => q.difficulte === 'difficile'));

      questionsOrder = [...qFaciles, ...qMoyens, ...qDifficiles];
    } else if (ordreMode === 'aleatoire') {
      // Aléatoire complet
      questionsOrder = shuffleArray(selectedQuestions);
    } else {
      // Ordre fixe (respecte la position d'origine)
      questionsOrder = [...selectedQuestions].sort((a, b) => a.position - b.position);
    }

    const sessionQuestions = questionsOrder.map(q => ({
      questionId: q.id,
      versionQuestionId: q.version_id,
      type: q.type
    }));

    const now = new Date().toISOString();
    const participantId = 'part_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const participationId = 'sess_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();

    // Insertion Participant
    run(
      `INSERT INTO participants (id, nom, prenom, entreprise, anonyme, date_creation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [participantId, finalNom, finalPrenom, finalEntreprise, estAnonyme ? 1 : 0, now]
    );

    // Insertion Participation avec figeage des versions de questions
    run(
      `INSERT INTO participations (id, participant_id, date_debut, statut, score_final, nombre_questions, pourcentage_reussite, ordre_questions)
       VALUES (?, ?, ?, 'en_cours', 0, ?, 0.0, ?)`,
      [participationId, participantId, now, sessionQuestions.length, JSON.stringify(sessionQuestions)]
    );

    res.json({
      participationId,
      nombreQuestions: sessionQuestions.length,
      currentQuestionIndex: 1
    });
  } catch (err: any) {
    console.error('Erreur start-session:', err);
    res.status(500).json({ error: 'Erreur lors de l’initialisation de la session.' });
  }
});

// Récupérer l'état de la session (permet la reprise après rafraîchissement)
router.get('/public/session/:id', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;

    const participation = queryOne<{
      id: string;
      participant_id: string;
      statut: string;
      score_final: number;
      nombre_questions: number;
      ordre_questions: string;
    }>('SELECT * FROM participations WHERE id = ?', [id]);

    if (!participation) {
      res.status(404).json({ error: 'Session introuvable.' });
      return;
    }

    const questionsList: Array<{ questionId: string; versionQuestionId: string; type: string }> = JSON.parse(participation.ordre_questions);

    // Récupérer les réponses déjà données
    const reponses = query<{
      version_question_id: string;
      est_correct: number;
      points: number;
    }>('SELECT version_question_id, est_correct, points FROM reponses_utilisateurs WHERE participation_id = ?', [id]);

    const answeredCount = reponses.length;

    res.json({
      participationId: participation.id,
      statut: participation.statut,
      totalQuestions: questionsList.length,
      answeredCount,
      currentQuestionIndex: Math.min(answeredCount + 1, questionsList.length),
      isCompleted: participation.statut === 'quiz_termine' || participation.statut === 'termine'
    });
  } catch (err: any) {
    console.error('Erreur get session:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la session.' });
  }
});

// Récupérer la question actuelle pour une session (sans révéler les bonnes réponses !)
router.get('/public/session/:id/question/:index', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;
    const index = parseInt(req.params.index, 10); // 1-based index

    const participation = queryOne<{
      id: string;
      statut: string;
      ordre_questions: string;
    }>('SELECT * FROM participations WHERE id = ?', [id]);

    if (!participation) {
      res.status(404).json({ error: 'Session introuvable.' });
      return;
    }

    const questionsList: Array<{ questionId: string; versionQuestionId: string; type: string }> = JSON.parse(participation.ordre_questions);

    if (index < 1 || index > questionsList.length) {
      res.status(400).json({ error: 'Numéro de question hors limites.' });
      return;
    }

    const currentItem = questionsList[index - 1];

    // Vérifier si cette question a déjà été répondue
    const existingReponse = queryOne<{
      id: string;
      propositions_selectionnees: string;
      est_correct: number;
      points: number;
    }>('SELECT * FROM reponses_utilisateurs WHERE participation_id = ? AND version_question_id = ?', [id, currentItem.versionQuestionId]);

    // Récupérer l'énoncé et les propositions de la version
    const versionData = queryOne<{
      id: string;
      enonce: string;
      explication: string;
    }>('SELECT id, enonce, explication FROM versions_questions WHERE id = ?', [currentItem.versionQuestionId]);

    if (!versionData) {
      res.status(404).json({ error: 'Contenu de la question introuvable.' });
      return;
    }

    // Récupérer les propositions
    // IMPORTANT : si la question n'est PAS encore répondue, on NE renvoie JAMAIS est_correcte !
    const props = query<{
      id: string;
      texte: string;
      est_correcte: number;
      position: number;
    }>('SELECT id, texte, est_correcte, position FROM propositions WHERE version_question_id = ? ORDER BY position ASC', [currentItem.versionQuestionId]);

    const isAnswered = !!existingReponse;

    // Propositions sans la clé de sécurité est_correcte tant que non validé
    const propositionsClient = props.map(p => ({
      id: p.id,
      texte: p.texte,
      // Ne transmettre est_correcte QUE si la question est déjà validée
      est_correcte: isAnswered ? p.est_correcte === 1 : undefined
    }));

    res.json({
      index,
      totalQuestions: questionsList.length,
      type: currentItem.type,
      enonce: versionData.enonce,
      propositions: propositionsClient,
      isAnswered,
      reponse: isAnswered ? {
        selectedIds: JSON.parse(existingReponse.propositions_selectionnees),
        est_correct: existingReponse.est_correct === 1,
        points: existingReponse.points,
        explication: versionData.explication
      } : null
    });
  } catch (err: any) {
    console.error('Erreur get question:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la question.' });
  }
});

// Soumettre une réponse à une question
router.post('/public/session/:id/submit-answer', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;
    const { questionIndex, selectedPropositionIds } = req.body;

    if (!Array.isArray(selectedPropositionIds) || selectedPropositionIds.length === 0) {
      res.status(400).json({ error: 'Veuillez sélectionner au moins une réponse.' });
      return;
    }

    const participation = queryOne<{
      id: string;
      statut: string;
      ordre_questions: string;
      score_final: number;
      nombre_questions: number;
    }>('SELECT * FROM participations WHERE id = ?', [id]);

    if (!participation) {
      res.status(404).json({ error: 'Session introuvable.' });
      return;
    }

    if (participation.statut === 'quiz_termine' || participation.statut === 'termine') {
      res.status(400).json({ error: 'Le quiz est déjà terminé pour cette session.' });
      return;
    }

    const questionsList: Array<{ questionId: string; versionQuestionId: string; type: string }> = JSON.parse(participation.ordre_questions);
    const qIndex = parseInt(questionIndex, 10);

    if (qIndex < 1 || qIndex > questionsList.length) {
      res.status(400).json({ error: 'Numéro de question invalide.' });
      return;
    }

    const currentItem = questionsList[qIndex - 1];

    // Vérifier si déjà répondue (interdire la modification d'une réponse validée)
    const existingReponse = queryOne(
      'SELECT id FROM reponses_utilisateurs WHERE participation_id = ? AND version_question_id = ?',
      [id, currentItem.versionQuestionId]
    );

    if (existingReponse) {
      res.status(400).json({ error: 'Cette question a déjà été validée. Impossible de modifier votre réponse.' });
      return;
    }

    // Récupérer les propositions réelles avec leur statut correct
    const realProps = query<{
      id: string;
      est_correcte: number;
    }>('SELECT id, est_correcte FROM propositions WHERE version_question_id = ?', [currentItem.versionQuestionId]);

    const correctIds = realProps.filter(p => p.est_correcte === 1).map(p => p.id);
    const selectedIds: string[] = selectedPropositionIds;

    let isCorrect = false;

    if (currentItem.type === 'unique') {
      // Question à réponse unique : 1 seule réponse possible
      if (selectedIds.length === 1 && correctIds.includes(selectedIds[0])) {
        isCorrect = true;
      }
    } else {
      // QCM à plusieurs réponses possibles :
      // 1 point uniquement si TOUTES les bonnes réponses sont sélectionnées ET AUCUNE mauvaise réponse sélectionnée.
      const hasAllCorrect = correctIds.every(cid => selectedIds.includes(cid));
      const hasNoIncorrect = selectedIds.every(sid => correctIds.includes(sid));
      isCorrect = hasAllCorrect && hasNoIncorrect;
    }

    const points = isCorrect ? 1 : 0;
    const now = new Date().toISOString();
    const reponseId = 'rep_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    // Enregistrement sécurisé de la réponse en base SQL
    run(
      `INSERT INTO reponses_utilisateurs (id, participation_id, version_question_id, propositions_selectionnees, est_correct, points, date_validation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reponseId, id, currentItem.versionQuestionId, JSON.stringify(selectedIds), isCorrect ? 1 : 0, points, now]
    );

    // Mettre à jour le score cumulé
    const newScore = participation.score_final + points;
    const isLastQuestion = qIndex === questionsList.length;

    if (isLastQuestion) {
      const pct = Math.round((newScore / questionsList.length) * 100 * 10) / 10;
      run(
        `UPDATE participations
         SET score_final = ?, statut = 'quiz_termine', date_fin = ?, pourcentage_reussite = ?
         WHERE id = ?`,
        [newScore, now, pct, id]
      );
    } else {
      run(
        `UPDATE participations SET score_final = ? WHERE id = ?`,
        [newScore, id]
      );
    }

    // Récupérer l'explication pédagogique
    const versionRow = queryOne<{ explication: string }>(
      'SELECT explication FROM versions_questions WHERE id = ?',
      [currentItem.versionQuestionId]
    );

    res.json({
      success: true,
      est_correct: isCorrect,
      points,
      bonnes_reponses_ids: correctIds,
      explication: versionRow ? versionRow.explication : '',
      est_derniere_question: isLastQuestion,
      score_actuel: newScore
    });
  } catch (err: any) {
    console.error('Erreur submit-answer:', err);
    res.status(500).json({ error: 'Erreur lors de la validation de la réponse.' });
  }
});

// Résultats détaillés d'une participation
router.get('/public/session/:id/results', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;

    const participation = queryOne<{
      id: string;
      statut: string;
      score_final: number;
      nombre_questions: number;
      pourcentage_reussite: number;
      ordre_questions: string;
      date_debut: string;
      date_fin: string;
    }>('SELECT * FROM participations WHERE id = ?', [id]);

    if (!participation) {
      res.status(404).json({ error: 'Session introuvable.' });
      return;
    }

    const questionsList: Array<{ questionId: string; versionQuestionId: string; type: string }> = JSON.parse(participation.ordre_questions);

    // Récupérer toutes les réponses de l'utilisateur
    const reponses = query<{
      version_question_id: string;
      propositions_selectionnees: string;
      est_correct: number;
      points: number;
    }>('SELECT version_question_id, propositions_selectionnees, est_correct, points FROM reponses_utilisateurs WHERE participation_id = ?', [id]);

    const reponsesMap = new Map(reponses.map(r => [r.version_question_id, r]));

    // Construire le détail de chaque question pour la relecture
    const questionsDetail = questionsList.map((item, idx) => {
      const v = queryOne<{ enonce: string; explication: string }>(
        'SELECT enonce, explication FROM versions_questions WHERE id = ?',
        [item.versionQuestionId]
      );
      const props = query<{ id: string; texte: string; est_correcte: number }>(
        'SELECT id, texte, est_correcte FROM propositions WHERE version_question_id = ? ORDER BY position ASC',
        [item.versionQuestionId]
      );
      const rep = reponsesMap.get(item.versionQuestionId);

      return {
        numero: idx + 1,
        type: item.type,
        enonce: v ? v.enonce : '',
        explication: v ? v.explication : '',
        propositions: props.map(p => ({
          id: p.id,
          texte: p.texte,
          est_correcte: p.est_correcte === 1
        })),
        reponseUtilisateur: rep ? {
          selectedIds: JSON.parse(rep.propositions_selectionnees),
          est_correct: rep.est_correct === 1,
          points: rep.points
        } : null
      };
    });

    const bonnesReponses = reponses.filter(r => r.est_correct === 1).length;
    const mauvaisesReponses = questionsList.length - bonnesReponses;

    // Vérifier si un REX a déjà été envoyé pour cette session
    const existingRex = queryOne('SELECT id FROM rex WHERE participation_id = ?', [id]);

    res.json({
      participationId: participation.id,
      statut: participation.statut,
      totalQuestions: questionsList.length,
      bonnesReponses,
      mauvaisesReponses,
      scoreFinal: participation.score_final,
      pourcentageReussite: participation.pourcentage_reussite,
      hasSubmittedRex: !!existingRex,
      questions: questionsDetail
    });
  } catch (err: any) {
    console.error('Erreur get results:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des résultats.' });
  }
});

// Soumettre le retour d'expérience (REX) obligatoire
router.post('/public/session/:id/submit-rex', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;
    const { note_satisfaction, commentaire, appris_quelque_chose, appris_commentaire } = req.body;

    const note = parseInt(note_satisfaction, 10);
    if (isNaN(note) || note < 1 || note > 5) {
      res.status(400).json({ error: 'Veuillez attribuer une note de satisfaction entre 1 et 5 étoiles.' });
      return;
    }

    const participation = queryOne<{ id: string; statut: string }>('SELECT id, statut FROM participations WHERE id = ?', [id]);
    if (!participation) {
      res.status(404).json({ error: 'Session introuvable.' });
      return;
    }

    // Vérifier si déjà envoyé
    const existingRex = queryOne('SELECT id FROM rex WHERE participation_id = ?', [id]);
    if (existingRex) {
      res.status(400).json({ error: 'Vous avez déjà transmis votre retour d’expérience pour cette participation.' });
      return;
    }

    const rexId = 'rex_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const now = new Date().toISOString();
    const sanitizedComment = commentaire ? String(commentaire).trim().slice(0, 2000) : '';

    let apprisVal: number | null = null;
    if (appris_quelque_chose === true || appris_quelque_chose === 1 || appris_quelque_chose === 'oui') {
      apprisVal = 1;
    } else if (appris_quelque_chose === false || appris_quelque_chose === 0 || appris_quelque_chose === 'non') {
      apprisVal = 0;
    }
    const sanitizedApprisComment = appris_commentaire ? String(appris_commentaire).trim().slice(0, 2000) : null;

    // Enregistrement REX
    run(
      `INSERT INTO rex (id, participation_id, note_satisfaction, commentaire, appris_quelque_chose, appris_commentaire, date_soumission)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rexId, id, note, sanitizedComment, apprisVal, sanitizedApprisComment, now]
    );

    // Finaliser la participation
    run(
      `UPDATE participations SET statut = 'termine', date_finalisation = ? WHERE id = ?`,
      [now, id]
    );

    res.json({
      success: true,
      message: 'Merci pour votre participation ! Votre implication contribue à renforcer notre culture collective de cybersécurité.'
    });
  } catch (err: any) {
    console.error('Erreur submit-rex:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du retour d’expérience.' });
  }
});

// ============================================================================
// 2. AUTHENTIFICATION ADMINISTRATEUR & SÉCURITÉ
// ============================================================================

// Connexion admin avec protection anti-bruteforce
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    await getDatabase();
    const { username, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    // Vérifier les tentatives de connexion pour cette IP
    const attempt = queryOne<{
      ip: string;
      tentatives: number;
      dernier_essai: number;
      verrouille_jusqua: number;
    }>('SELECT * FROM tentatives_connexion WHERE ip = ?', [ip]);

    if (attempt && attempt.verrouille_jusqua > now) {
      const waitSeconds = Math.ceil((attempt.verrouille_jusqua - now) / 1000);
      res.status(429).json({
        error: `Trop de tentatives de connexion échouées. Compte temporairement verrouillé pour cette adresse. Réessayez dans ${waitSeconds} secondes.`
      });
      return;
    }

    if (!username || !password) {
      res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
      return;
    }

    const admin = queryOne<{
      id: string;
      username: string;
      password_hash: string;
      doit_changer_mot_de_passe: number;
    }>('SELECT * FROM administrateurs WHERE username = ?', [username]);

    const isValid = admin && bcrypt.compareSync(password, admin.password_hash);

    if (!isValid) {
      // Enregistrer l'échec
      const newAttempts = (attempt ? attempt.tentatives : 0) + 1;
      let lockUntil = 0;
      if (newAttempts >= 5) {
        // Verrouillage de 15 minutes
        lockUntil = now + (15 * 60 * 1000);
      }

      run(
        `INSERT OR REPLACE INTO tentatives_connexion (ip, tentatives, dernier_essai, verrouille_jusqua)
         VALUES (?, ?, ?, ?)`,
        [ip, newAttempts, now, lockUntil]
      );

      res.status(401).json({ error: 'Identifiants administrateur incorrects.' });
      return;
    }

    // Réinitialiser les tentatives en cas de succès
    run('DELETE FROM tentatives_connexion WHERE ip = ?', [ip]);

    // Mettre à jour la date de dernière connexion
    const isoNow = new Date().toISOString();
    run('UPDATE administrateurs SET date_derniere_connexion = ? WHERE id = ?', [isoNow, admin.id]);

    // Générer JWT
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        doitChangerMotDePasse: admin.doit_changer_mot_de_passe === 1
      }
    });
  } catch (err: any) {
    console.error('Erreur admin login:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion administrateur.' });
  }
});

// Modifier le mot de passe administrateur
router.post('/admin/change-password', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { ancien_mot_de_passe, nouveau_mot_de_passe, confirmation } = req.body;

    if (!ancien_mot_de_passe || !nouveau_mot_de_passe || !confirmation) {
      res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
      return;
    }

    if (nouveau_mot_de_passe !== confirmation) {
      res.status(400).json({ error: 'Le nouveau mot de passe et sa confirmation ne correspondent pas.' });
      return;
    }

    if (nouveau_mot_de_passe.length < 8) {
      res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
      return;
    }

    const admin = queryOne<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM administrateurs WHERE id = ?',
      [req.adminId]
    );

    if (!admin || !bcrypt.compareSync(ancien_mot_de_passe, admin.password_hash)) {
      res.status(400).json({ error: 'L’ancien mot de passe est incorrect.' });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(nouveau_mot_de_passe, salt);

    run(
      'UPDATE administrateurs SET password_hash = ?, doit_changer_mot_de_passe = 0 WHERE id = ?',
      [newHash, admin.id]
    );

    res.json({ success: true, message: 'Mot de passe administrateur modifié avec succès.' });
  } catch (err: any) {
    console.error('Erreur change-password:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du mot de passe.' });
  }
});

// Vérifier l'état de la session admin actuelle
router.get('/admin/me', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const admin = queryOne<{
      id: string;
      username: string;
      doit_changer_mot_de_passe: number;
      date_derniere_connexion: string;
    }>('SELECT id, username, doit_changer_mot_de_passe, date_derniere_connexion FROM administrateurs WHERE id = ?', [req.adminId]);

    if (!admin) {
      res.status(404).json({ error: 'Administrateur introuvable.' });
      return;
    }

    res.json({
      id: admin.id,
      username: admin.username,
      doitChangerMotDePasse: admin.doit_changer_mot_de_passe === 1,
      date_derniere_connexion: admin.date_derniere_connexion
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================================================================
// 3. GESTION DES QUESTIONS (CRUD & VERSIONING RSE)
// ============================================================================

// Lister toutes les questions avec leur version courante et leurs statistiques
router.get('/admin/questions', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();

    const questions = query<{
      id: string;
      type: string;
      difficulte: string;
      position: number;
      statut: string;
      version_courante: number;
      date_creation: string;
      date_modification: string;
      enonce: string;
      explication: string;
      version_id: string;
    }>(`
      SELECT q.id, q.type, COALESCE(q.difficulte, 'moyen') as difficulte, q.position, q.statut, q.version_courante, q.date_creation, q.date_modification,
             v.enonce, v.explication, v.id as version_id
      FROM questions q
      JOIN versions_questions v ON v.question_id = q.id AND v.version_numero = q.version_courante
      ORDER BY q.position ASC
    `);

    // Pour chaque question, charger ses propositions actuelles et stats
    const detailed = questions.map(q => {
      const props = query<{
        id: string;
        texte: string;
        est_correcte: number;
        position: number;
      }>('SELECT id, texte, est_correcte, position FROM propositions WHERE version_question_id = ? ORDER BY position ASC', [q.version_id]);

      // Nombre total de participations ayant répondu à cette question (toutes versions confondues)
      const statsRow = queryOne<{ total: number; correct: number }>(`
        SELECT COUNT(*) as total, SUM(CASE WHEN est_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM reponses_utilisateurs
        WHERE version_question_id IN (SELECT id FROM versions_questions WHERE question_id = ?)
      `, [q.id]);

      return {
        ...q,
        difficulte: (['facile', 'moyen', 'difficile'].includes(q.difficulte) ? q.difficulte : 'moyen') as any,
        propositions: props.map(p => ({
          id: p.id,
          texte: p.texte,
          est_correcte: p.est_correcte === 1,
          position: p.position
        })),
        stats: {
          totalReponses: statsRow ? statsRow.total : 0,
          totalCorrect: statsRow ? (statsRow.correct || 0) : 0,
          tauxReussite: statsRow && statsRow.total > 0 ? Math.round(((statsRow.correct || 0) / statsRow.total) * 100) : 0
        }
      };
    });

    res.json(detailed);
  } catch (err: any) {
    console.error('Erreur get questions:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des questions.' });
  }
});

// Créer une nouvelle question
router.post('/admin/questions', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { type, difficulte, enonce, explication, propositions, statut } = req.body;

    if (!enonce || !enonce.trim()) {
      res.status(400).json({ error: 'L’énoncé de la question est obligatoire.' });
      return;
    }

    if (type !== 'unique' && type !== 'multiple') {
      res.status(400).json({ error: 'Type de question invalide (unique ou multiple).' });
      return;
    }

    const validDiff = ['facile', 'moyen', 'difficile'].includes(difficulte) ? difficulte : 'moyen';

    if (!Array.isArray(propositions) || propositions.length < 2) {
      res.status(400).json({ error: 'Une question doit comporter au moins 2 propositions.' });
      return;
    }

    const correctCount = propositions.filter((p: any) => p.est_correcte).length;
    if (correctCount === 0) {
      res.status(400).json({ error: 'Veuillez définir au moins une bonne réponse.' });
      return;
    }

    if (type === 'unique' && correctCount > 1) {
      res.status(400).json({ error: 'Une question à réponse unique ne peut avoir qu’une seule bonne réponse.' });
      return;
    }

    // Déterminer la position suivante
    const maxPosRow = queryOne<{ max_pos: number }>('SELECT MAX(position) as max_pos FROM questions');
    const nextPos = (maxPosRow && maxPosRow.max_pos ? maxPosRow.max_pos : 0) + 1;

    const qId = 'q_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    const vId = 'vq_' + qId + '_v1';
    const now = new Date().toISOString();

    // 1. Insertion questions avec difficulte
    run(
      `INSERT INTO questions (id, type, difficulte, position, statut, version_courante, date_creation, date_modification)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [qId, type, validDiff, nextPos, statut === 'inactif' ? 'inactif' : 'actif', now, now]
    );

    // 2. Insertion versions_questions
    run(
      `INSERT INTO versions_questions (id, question_id, version_numero, enonce, explication, date_creation)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [vId, qId, enonce.trim(), (explication || '').trim(), now]
    );

    // 3. Insertion propositions
    propositions.forEach((p: any, idx: number) => {
      const pId = 'p_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      run(
        `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
         VALUES (?, ?, ?, ?, ?)`,
        [pId, vId, p.texte.trim(), p.est_correcte ? 1 : 0, idx + 1]
      );
    });

    res.json({ success: true, message: 'Question créée avec succès.', questionId: qId });
  } catch (err: any) {
    console.error('Erreur create question:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la question.' });
  }
});

// Mettre à jour une question avec GESTION DU VERSIONING
router.put('/admin/questions/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;
    const { type, difficulte, enonce, explication, propositions, statut } = req.body;

    const question = queryOne<{
      id: string;
      version_courante: number;
    }>('SELECT id, version_courante FROM questions WHERE id = ?', [id]);

    if (!question) {
      res.status(404).json({ error: 'Question introuvable.' });
      return;
    }

    if (!enonce || !enonce.trim()) {
      res.status(400).json({ error: 'L’énoncé est obligatoire.' });
      return;
    }

    const validDiff = ['facile', 'moyen', 'difficile'].includes(difficulte) ? difficulte : 'moyen';

    if (!Array.isArray(propositions) || propositions.length < 2) {
      res.status(400).json({ error: 'Au moins 2 propositions sont requises.' });
      return;
    }

    const correctCount = propositions.filter((p: any) => p.est_correcte).length;
    if (correctCount === 0) {
      res.status(400).json({ error: 'Au moins une bonne réponse doit être cochée.' });
      return;
    }

    if (type === 'unique' && correctCount > 1) {
      res.status(400).json({ error: 'Une question à réponse unique ne peut avoir qu’une seule bonne réponse.' });
      return;
    }

    const now = new Date().toISOString();

    // Mise à jour directe de la question
    const currentVersion = queryOne<{ id: string }>(
      'SELECT id FROM versions_questions WHERE question_id = ? ORDER BY version_numero DESC LIMIT 1',
      [id]
    );

    if (currentVersion) {
      run(
        `UPDATE versions_questions SET enonce = ?, explication = ? WHERE id = ?`,
        [enonce.trim(), (explication || '').trim(), currentVersion.id]
      );

      // Remplacer les propositions
      run('DELETE FROM propositions WHERE version_question_id = ?', [currentVersion.id]);
      propositions.forEach((p: any, idx: number) => {
        const pId = 'p_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        run(
          `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
           VALUES (?, ?, ?, ?, ?)`,
          [pId, currentVersion.id, p.texte.trim(), p.est_correcte ? 1 : 0, idx + 1]
        );
      });
    }

    run(
      `UPDATE questions SET type = ?, difficulte = ?, statut = ?, date_modification = ? WHERE id = ?`,
      [type, validDiff, statut || 'actif', now, id]
    );

    res.json({ success: true, message: 'Question mise à jour avec succès.' });
  } catch (err: any) {
    console.error('Erreur update question:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la question.' });
  }
});

// Mettre à jour rapidement la difficulté d'une question
router.patch('/admin/questions/:id/difficulty', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;
    const { difficulte } = req.body;

    if (!['facile', 'moyen', 'difficile'].includes(difficulte)) {
      res.status(400).json({ error: 'Niveau de difficulté invalide (facile, moyen ou difficile).' });
      return;
    }

    const now = new Date().toISOString();
    run('UPDATE questions SET difficulte = ?, date_modification = ? WHERE id = ?', [difficulte, now, id]);

    res.json({ success: true, message: `Difficulté mise à jour : ${difficulte}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la difficulté.' });
  }
});

// Supprimer définitivement une question
router.delete('/admin/questions/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;

    const question = queryOne<{ id: string }>('SELECT id FROM questions WHERE id = ?', [id]);
    if (!question) {
      res.status(404).json({ error: 'Question introuvable.' });
      return;
    }

    // Récupérer toutes les versions de cette question pour nettoyer les propositions et réponses
    const versions = query<{ id: string }>('SELECT id FROM versions_questions WHERE question_id = ?', [id]);
    for (const v of versions) {
      run('DELETE FROM reponses_utilisateurs WHERE version_question_id = ?', [v.id]);
      run('DELETE FROM propositions WHERE version_question_id = ?', [v.id]);
    }
    run('DELETE FROM versions_questions WHERE question_id = ?', [id]);
    run('DELETE FROM questions WHERE id = ?', [id]);

    // Réajuster les positions séquentielles des questions restantes
    const remaining = query<{ id: string }>('SELECT id FROM questions ORDER BY position ASC');
    remaining.forEach((rem, idx) => {
      run('UPDATE questions SET position = ? WHERE id = ?', [idx + 1, rem.id]);
    });

    res.json({ success: true, message: 'Question supprimée avec succès.' });
  } catch (err: any) {
    console.error('Erreur delete question:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la question.' });
  }
});

// Dupliquer une question
router.post('/admin/questions/:id/duplicate', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;

    const original = queryOne<{
      type: string;
      difficulte: string;
      version_courante: number;
    }>('SELECT type, COALESCE(difficulte, \'moyen\') as difficulte, version_courante FROM questions WHERE id = ?', [id]);

    if (!original) {
      res.status(404).json({ error: 'Question introuvable.' });
      return;
    }

    const versionData = queryOne<{
      id: string;
      enonce: string;
      explication: string;
    }>('SELECT id, enonce, explication FROM versions_questions WHERE question_id = ? AND version_numero = ?', [id, original.version_courante]);

    if (!versionData) {
      res.status(404).json({ error: 'Données de la question introuvables.' });
      return;
    }

    const props = query<{ texte: string; est_correcte: number; position: number }>(
      'SELECT texte, est_correcte, position FROM propositions WHERE version_question_id = ? ORDER BY position ASC',
      [versionData.id]
    );

    const maxPosRow = queryOne<{ max_pos: number }>('SELECT MAX(position) as max_pos FROM questions');
    const nextPos = (maxPosRow && maxPosRow.max_pos ? maxPosRow.max_pos : 0) + 1;

    const newQId = 'q_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    const newVId = `vq_${newQId}_v1`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO questions (id, type, difficulte, position, statut, version_courante, date_creation, date_modification)
       VALUES (?, ?, ?, ?, 'actif', 1, ?, ?)`,
      [newQId, original.type, original.difficulte || 'moyen', nextPos, now, now]
    );

    run(
      `INSERT INTO versions_questions (id, question_id, version_numero, enonce, explication, date_creation)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [newVId, newQId, `[Copie] ${versionData.enonce}`, versionData.explication, now]
    );

    props.forEach(p => {
      const pId = 'p_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      run(
        `INSERT INTO propositions (id, version_question_id, texte, est_correcte, position)
         VALUES (?, ?, ?, ?, ?)`,
        [pId, newVId, p.texte, p.est_correcte, p.position]
      );
    });

    res.json({ success: true, message: 'Question dupliquée avec succès.' });
  } catch (err: any) {
    console.error('Erreur duplicate question:', err);
    res.status(500).json({ error: 'Erreur lors de la duplication.' });
  }
});

// Changer le statut (actif, inactif, archive)
router.patch('/admin/questions/:id/status', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;
    const { statut } = req.body;

    if (!['actif', 'inactif', 'archive'].includes(statut)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }

    const now = new Date().toISOString();
    run('UPDATE questions SET statut = ?, date_modification = ? WHERE id = ?', [statut, now, id]);

    res.json({ success: true, message: `Statut mis à jour : ${statut}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut.' });
  }
});

// Réorganiser l'ordre des questions
router.post('/admin/questions/reorder', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'Format invalide.' });
      return;
    }

    orderedIds.forEach((qId: string, idx: number) => {
      run('UPDATE questions SET position = ? WHERE id = ?', [idx + 1, qId]);
    });

    res.json({ success: true, message: 'Ordre des questions mis à jour.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la réorganisation des questions.' });
  }
});

// Récupérer les paramètres du Pool et d'ordonnancement avec décompte par difficulté
router.get('/admin/pool-settings', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const rows = query<{ cle: string; valeur: string }>('SELECT cle, valeur FROM parametres');
    const pMap: Record<string, string> = {};
    rows.forEach(r => { pMap[r.cle] = r.valeur; });

    // Compter par niveau de difficulté pour les questions actives
    const countFacile = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM questions WHERE statut = 'actif' AND difficulte = 'facile'")?.count || 0;
    const countMoyen = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM questions WHERE statut = 'actif' AND (difficulte = 'moyen' OR difficulte IS NULL)")?.count || 0;
    const countDifficile = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM questions WHERE statut = 'actif' AND difficulte = 'difficile'")?.count || 0;
    const totalActives = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM questions WHERE statut = 'actif'")?.count || 0;

    res.json({
      ordre_questions: ['fixe', 'aleatoire', 'difficulte_croissante'].includes(pMap['ordre_questions']) ? pMap['ordre_questions'] : 'fixe',
      pool_actif: pMap['pool_actif'] === '1',
      pool_taille: parseInt(pMap['pool_taille'] || '10', 10) || 10,
      pool_mode_repartition: pMap['pool_mode_repartition'] === 'par_difficulte' ? 'par_difficulte' : 'global',
      pool_nb_facile: parseInt(pMap['pool_nb_facile'] || '3', 10) || 3,
      pool_nb_moyen: parseInt(pMap['pool_nb_moyen'] || '4', 10) || 4,
      pool_nb_difficile: parseInt(pMap['pool_nb_difficile'] || '3', 10) || 3,
      total_questions_actives: totalActives,
      count_facile: countFacile,
      count_moyen: countMoyen,
      count_difficile: countDifficile
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du chargement des réglages de pool.' });
  }
});

// Enregistrer les paramètres du Pool et d'ordonnancement
router.put('/admin/pool-settings', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const {
      ordre_questions,
      pool_actif,
      pool_taille,
      pool_mode_repartition,
      pool_nb_facile,
      pool_nb_moyen,
      pool_nb_difficile
    } = req.body;

    const validOrdre = ['fixe', 'aleatoire', 'difficulte_croissante'].includes(ordre_questions) ? ordre_questions : 'fixe';
    const validPoolActif = pool_actif ? '1' : '0';
    const parsedTaille = Math.max(1, parseInt(pool_taille, 10) || 10).toString();
    const validMode = pool_mode_repartition === 'par_difficulte' ? 'par_difficulte' : 'global';
    const validNbFacile = Math.max(0, parseInt(pool_nb_facile, 10) || 0).toString();
    const validNbMoyen = Math.max(0, parseInt(pool_nb_moyen, 10) || 0).toString();
    const validNbDifficile = Math.max(0, parseInt(pool_nb_difficile, 10) || 0).toString();

    const updates: Record<string, string> = {
      ordre_questions: validOrdre,
      pool_actif: validPoolActif,
      pool_taille: parsedTaille,
      pool_mode_repartition: validMode,
      pool_nb_facile: validNbFacile,
      pool_nb_moyen: validNbMoyen,
      pool_nb_difficile: validNbDifficile
    };

    for (const [cle, valeur] of Object.entries(updates)) {
      run('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)', [cle, valeur]);
    }

    res.json({ success: true, message: 'Paramètres du Pool et de l’ordre de diffusion enregistrés avec succès.' });
  } catch (err: any) {
    console.error('Erreur save pool settings:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des paramètres du pool.' });
  }
});

// ============================================================================
// 4. TABLEAU DE BORD & STATISTIQUES AVANCÉES (RSE)
// ============================================================================

// KPIs du Tableau de bord
router.get('/admin/dashboard-kpis', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();

    const totalPart = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM participations')?.count || 0;
    const anonymes = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM participants WHERE anonyme = 1')?.count || 0;
    const identifiees = totalPart - anonymes;

    const termines = queryOne<{ count: number }>("SELECT COUNT(*) as count FROM participations WHERE statut IN ('quiz_termine', 'termine')")?.count || 0;
    const rexCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM rex')?.count || 0;

    const avgScoreRow = queryOne<{ avg_score: number; avg_pct: number }>(`
      SELECT AVG(score_final) as avg_score, AVG(pourcentage_reussite) as avg_pct
      FROM participations
      WHERE statut IN ('quiz_termine', 'termine')
    `);

    const avgRexRow = queryOne<{ avg_note: number }>('SELECT AVG(note_satisfaction) as avg_note FROM rex');

    res.json({
      totalParticipations: totalPart,
      participationsAnonymes: anonymes,
      participationsIdentifiees: identifiees,
      questionnairesTermines: termines,
      rexRecus: rexCount,
      scoreMoyen: avgScoreRow && avgScoreRow.avg_score !== null ? Math.round(avgScoreRow.avg_score * 10) / 10 : 0,
      tauxReussiteMoyen: avgScoreRow && avgScoreRow.avg_pct !== null ? Math.round(avgScoreRow.avg_pct * 10) / 10 : 0,
      noteSatisfactionMoyenne: avgRexRow && avgRexRow.avg_note !== null ? Math.round(avgRexRow.avg_note * 10) / 10 : 0
    });
  } catch (err: any) {
    console.error('Erreur KPIs:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des indicateurs.' });
  }
});

// Statistiques détaillées avec filtres temporels
router.get('/admin/statistiques', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { periode } = req.query; // 'all', 'today', '7d', '30d'

    let dateFilterSql = '';
    const now = new Date();

    if (periode === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      dateFilterSql = `AND p.date_debut >= '${startOfDay}'`;
    } else if (periode === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      dateFilterSql = `AND p.date_debut >= '${past7}'`;
    } else if (periode === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      dateFilterSql = `AND p.date_debut >= '${past30}'`;
    }

    // 1. Distribution des notes
    const scores = query<{ pourcentage_reussite: number }>(`
      SELECT pourcentage_reussite FROM participations p
      WHERE p.statut IN ('quiz_termine', 'termine') ${dateFilterSql}
    `);

    const distribution = {
      '0-20%': 0,
      '21-40%': 0,
      '41-60%': 0,
      '61-80%': 0,
      '81-100%': 0
    };

    scores.forEach(s => {
      const pct = s.pourcentage_reussite;
      if (pct <= 20) distribution['0-20%']++;
      else if (pct <= 40) distribution['21-40%']++;
      else if (pct <= 60) distribution['41-60%']++;
      else if (pct <= 80) distribution['61-80%']++;
      else distribution['81-100%']++;
    });

    // 2. Évolution temporelle (par jour)
    const timelineRows = query<{ jour: string; count: number; avg_pct: number }>(`
      SELECT SUBSTR(p.date_debut, 1, 10) as jour, COUNT(*) as count, AVG(p.pourcentage_reussite) as avg_pct
      FROM participations p
      WHERE 1=1 ${dateFilterSql}
      GROUP BY SUBSTR(p.date_debut, 1, 10)
      ORDER BY jour ASC
    `);

    // 3. Statistiques par question
    const questionsStats = query<{
      question_id: string;
      enonce: string;
      total: number;
      correct: number;
    }>(`
      SELECT q.id as question_id, v.enonce,
             COUNT(r.id) as total,
             SUM(CASE WHEN r.est_correct = 1 THEN 1 ELSE 0 END) as correct
      FROM questions q
      JOIN versions_questions v ON v.question_id = q.id AND v.version_numero = q.version_courante
      LEFT JOIN versions_questions v_all ON v_all.question_id = q.id
      LEFT JOIN reponses_utilisateurs r ON r.version_question_id = v_all.id
      LEFT JOIN participations p ON p.id = r.participation_id
      WHERE 1=1 ${dateFilterSql}
      GROUP BY q.id, v.enonce
      ORDER BY q.position ASC
    `);

    const formattedQuestionsStats = questionsStats.map(q => {
      const total = q.total || 0;
      const correct = q.correct || 0;
      const wrong = total - correct;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        questionId: q.question_id,
        enonce: q.enonce,
        total,
        correct,
        wrong,
        tauxReussite: pct
      };
    });

    // Questions les plus échouées (ordre croissant du taux de réussite pour celles avec au moins 1 réponse)
    const questionsDifficiles = [...formattedQuestionsStats]
      .filter(q => q.total > 0)
      .sort((a, b) => a.tauxReussite - b.tauxReussite)
      .slice(0, 5);

    // 4. Statistiques par entreprise (avec regroupement insensible à la casse et gestion distincte de l'anonymat)
    // Permet de regrouper "CESI", "cesi", "Cesi" sous une même et unique entité
    const companyStats = query<{
      raw_entreprise: string;
      norm_entreprise: string;
      anonyme: number;
      nb_participations: number;
      score_moyen: number;
      taux_reussite_moyen: number;
    }>(`
      SELECT 
        CASE 
          WHEN part.anonyme = 1 THEN 'Participations anonymes' 
          ELSE TRIM(part.entreprise) 
        END as raw_entreprise,
        CASE 
          WHEN part.anonyme = 1 THEN '__anonyme__' 
          ELSE LOWER(TRIM(part.entreprise)) 
        END as norm_entreprise,
        part.anonyme,
        COUNT(p.id) as nb_participations,
        AVG(p.score_final) as score_moyen,
        AVG(p.pourcentage_reussite) as taux_reussite_moyen
      FROM participants part
      JOIN participations p ON p.participant_id = part.id
      WHERE p.statut IN ('quiz_termine', 'termine') ${dateFilterSql}
      GROUP BY 
        CASE WHEN part.anonyme = 1 THEN '__anonyme__' ELSE LOWER(TRIM(part.entreprise)) END, 
        part.anonyme
      ORDER BY nb_participations DESC
    `);

    // Satisfaction moyenne par entreprise et harmonisation de la casse (ex: privilégier CESI plutôt que cesi)
    const formattedCompanyStats = companyStats.map(c => {
      let displayName = c.raw_entreprise;

      if (c.anonyme !== 1) {
        const allSpellings = query<{ ent: string }>(`
          SELECT DISTINCT TRIM(part.entreprise) as ent
          FROM participants part
          JOIN participations p ON p.participant_id = part.id
          WHERE part.anonyme = 0 
            AND LOWER(TRIM(part.entreprise)) = ?
            AND p.statut IN ('quiz_termine', 'termine') ${dateFilterSql}
        `, [c.norm_entreprise]);

        if (allSpellings.length > 0) {
          // Préférer un acronyme tout en majuscules (ex: CESI, SNCF)
          const uppercaseMatch = allSpellings.find(s => s.ent === s.ent.toUpperCase() && s.ent.length >= 2);
          if (uppercaseMatch) {
            displayName = uppercaseMatch.ent;
          } else {
            // Sinon préférer une graphie avec la première lettre majuscule
            const capitalizedMatch = allSpellings.find(s => s.ent[0] === s.ent[0].toUpperCase());
            displayName = capitalizedMatch ? capitalizedMatch.ent : allSpellings[0].ent;
          }
        }
      }

      const avgSat = queryOne<{ avg_note: number }>(`
        SELECT AVG(r.note_satisfaction) as avg_note
        FROM rex r
        JOIN participations p ON p.id = r.participation_id
        JOIN participants part ON part.id = p.participant_id
        WHERE part.anonyme = ? 
          AND (
            part.anonyme = 1 
            OR LOWER(TRIM(part.entreprise)) = ?
          )
      `, [c.anonyme, c.norm_entreprise]);

      return {
        entreprise: displayName,
        isAnonyme: c.anonyme === 1,
        nbParticipations: c.nb_participations,
        scoreMoyen: Math.round((c.score_moyen || 0) * 10) / 10,
        tauxReussite: Math.round((c.taux_reussite_moyen || 0) * 10) / 10,
        satisfactionMoyenne: avgSat && avgSat.avg_note ? Math.round(avgSat.avg_note * 10) / 10 : null
      };
    });

    res.json({
      distribution,
      timeline: timelineRows,
      questionsStats: formattedQuestionsStats,
      questionsDifficiles,
      companyStats: formattedCompanyStats
    });
  } catch (err: any) {
    console.error('Erreur statistiques:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques.' });
  }
});

// ============================================================================
// 5. GESTION DES PARTICIPATIONS (Tableau dynamique & Exports)
// ============================================================================

// Tableau dynamique des participations
router.get('/admin/participations', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { search, entreprise, anonyme, statut } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (part.nom LIKE ? OR part.prenom LIKE ? OR part.entreprise LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (entreprise) {
      whereClause += ` AND LOWER(TRIM(part.entreprise)) = LOWER(TRIM(?))`;
      params.push(entreprise);
    }

    if (anonyme === '1') {
      whereClause += ` AND part.anonyme = 1`;
    } else if (anonyme === '0') {
      whereClause += ` AND part.anonyme = 0`;
    }

    if (statut) {
      whereClause += ` AND p.statut = ?`;
      params.push(statut);
    }

    // Récupérer toutes les participations correspondant aux filtres
    const participations = query<{
      id: string;
      participant_id: string;
      date_debut: string;
      date_fin: string;
      date_finalisation: string;
      statut: string;
      score_final: number;
      nombre_questions: number;
      pourcentage_reussite: number;
      ordre_questions: string;
      nom: string;
      prenom: string;
      entreprise: string;
      anonyme: number;
      rex_note: number | null;
      rex_commentaire: string | null;
    }>(`
      SELECT p.*, part.nom, part.prenom, part.entreprise, part.anonyme,
             r.note_satisfaction as rex_note, r.commentaire as rex_commentaire
      FROM participations p
      JOIN participants part ON part.id = p.participant_id
      LEFT JOIN rex r ON r.participation_id = p.id
      ${whereClause}
      ORDER BY p.date_debut DESC
    `, params);

    // Récupérer la liste ordonnée des questions existantes pour générer les colonnes dynamiques Q1, Q2, etc.
    const allQuestions = query<{ id: string; position: number; enonce: string }>(`
      SELECT q.id, q.position, v.enonce
      FROM questions q
      JOIN versions_questions v ON v.question_id = q.id AND v.version_numero = q.version_courante
      ORDER BY q.position ASC
    `);

    // Pour chaque participation, récupérer ses réponses indexées par questionId
    const rows = participations.map(p => {
      const userResponses = query<{
        question_id: string;
        est_correct: number;
      }>(`
        SELECT v.question_id, r.est_correct
        FROM reponses_utilisateurs r
        JOIN versions_questions v ON v.id = r.version_question_id
        WHERE r.participation_id = ?
      `, [p.id]);

      const respMap = new Map(userResponses.map(r => [r.question_id, r.est_correct === 1]));

      // Dynamique Q1, Q2...
      const questionsResult: Record<string, string> = {};
      allQuestions.forEach((q, idx) => {
        const colKey = `Q${idx + 1}`;
        if (respMap.has(q.id)) {
          questionsResult[colKey] = respMap.get(q.id) ? 'Vrai' : 'Faux';
        } else {
          questionsResult[colKey] = '-';
        }
      });

      return {
        id: p.id,
        nom: p.anonyme === 1 ? 'Anonyme' : p.nom,
        prenom: p.anonyme === 1 ? 'Anonyme' : p.prenom,
        entreprise: p.anonyme === 1 ? 'Anonyme' : p.entreprise,
        anonyme: p.anonyme === 1,
        dateDebut: p.date_debut,
        dateFin: p.date_fin,
        statut: p.statut,
        scoreFinal: p.score_final,
        nombreQuestions: p.nombre_questions,
        pourcentageReussite: p.pourcentage_reussite,
        questionsResult,
        rex: p.rex_note ? {
          note: p.rex_note,
          commentaire: p.rex_commentaire
        } : null
      };
    });

    res.json({
      columns: allQuestions.map((q, idx) => ({ key: `Q${idx + 1}`, label: `Q${idx + 1}`, id: q.id })),
      participations: rows
    });
  } catch (err: any) {
    console.error('Erreur get participations:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des participations.' });
  }
});

// Supprimer une participation (politique de conservation des données)
router.delete('/admin/participations/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { id } = req.params;

    const part = queryOne<{ participant_id: string }>('SELECT participant_id FROM participations WHERE id = ?', [id]);
    if (!part) {
      res.status(404).json({ error: 'Participation introuvable.' });
      return;
    }

    // Supprimer la participation et les tables associées en cascade
    run('DELETE FROM reponses_utilisateurs WHERE participation_id = ?', [id]);
    run('DELETE FROM rex WHERE participation_id = ?', [id]);
    run('DELETE FROM participations WHERE id = ?', [id]);
    run('DELETE FROM participants WHERE id = ?', [part.participant_id]);

    res.json({ success: true, message: 'Participation supprimée avec succès.' });
  } catch (err: any) {
    console.error('Erreur delete participation:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la participation.' });
  }
});

// Export CSV des participations
router.get('/admin/export/participations.csv', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const participations = query<{
      id: string;
      date_debut: string;
      date_fin: string;
      statut: string;
      score_final: number;
      nombre_questions: number;
      pourcentage_reussite: number;
      nom: string;
      prenom: string;
      entreprise: string;
      anonyme: number;
      rex_note: number | null;
      rex_commentaire: string | null;
    }>(`
      SELECT p.*, part.nom, part.prenom, part.entreprise, part.anonyme,
             r.note_satisfaction as rex_note, r.commentaire as rex_commentaire
      FROM participations p
      JOIN participants part ON part.id = p.participant_id
      LEFT JOIN rex r ON r.participation_id = p.id
      ORDER BY p.date_debut DESC
    `);

    const allQuestions = query<{ id: string }>(`SELECT id FROM questions ORDER BY position ASC`);

    const headers = [
      'Date Début', 'Date Fin', 'Statut', 'Nom', 'Prénom', 'Entreprise', 'Anonyme',
      ...allQuestions.map((_, i) => `Q${i + 1}`),
      'Score', 'Total Questions', '% Réussite', 'Note REX', 'Commentaire REX'
    ];

    const rows = participations.map(p => {
      const userResponses = query<{ question_id: string; est_correct: number }>(`
        SELECT v.question_id, r.est_correct
        FROM reponses_utilisateurs r
        JOIN versions_questions v ON v.id = r.version_question_id
        WHERE r.participation_id = ?
      `, [p.id]);

      const respMap = new Map(userResponses.map(r => [r.question_id, r.est_correct === 1]));
      const qCols = allQuestions.map(q => respMap.has(q.id) ? (respMap.get(q.id) ? 'Vrai' : 'Faux') : '-');

      return [
        p.date_debut,
        p.date_fin || '-',
        p.statut,
        p.anonyme === 1 ? 'Anonyme' : `"${(p.nom || '').replace(/"/g, '""')}"`,
        p.anonyme === 1 ? 'Anonyme' : `"${(p.prenom || '').replace(/"/g, '""')}"`,
        p.anonyme === 1 ? 'Anonyme' : `"${(p.entreprise || '').replace(/"/g, '""')}"`,
        p.anonyme === 1 ? 'Oui' : 'Non',
        ...qCols,
        p.score_final,
        p.nombre_questions,
        `${p.pourcentage_reussite}%`,
        p.rex_note || '-',
        p.rex_commentaire ? `"${p.rex_commentaire.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '-'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cyberquiz_participations.csv"');
    res.send(csvContent);
  } catch (err: any) {
    console.error('Erreur export csv participations:', err);
    res.status(500).send('Erreur lors de l’export.');
  }
});

// Export XLSX des participations
router.get('/admin/export/participations.xlsx', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const participations = query<{
      id: string;
      date_debut: string;
      date_fin: string;
      statut: string;
      score_final: number;
      nombre_questions: number;
      pourcentage_reussite: number;
      nom: string;
      prenom: string;
      entreprise: string;
      anonyme: number;
      rex_note: number | null;
      rex_commentaire: string | null;
    }>(`
      SELECT p.*, part.nom, part.prenom, part.entreprise, part.anonyme,
             r.note_satisfaction as rex_note, r.commentaire as rex_commentaire
      FROM participations p
      JOIN participants part ON part.id = p.participant_id
      LEFT JOIN rex r ON r.participation_id = p.id
      ORDER BY p.date_debut DESC
    `);

    const allQuestions = query<{ id: string }>(`SELECT id FROM questions ORDER BY position ASC`);

    const dataRows = participations.map(p => {
      const userResponses = query<{ question_id: string; est_correct: number }>(`
        SELECT v.question_id, r.est_correct
        FROM reponses_utilisateurs r
        JOIN versions_questions v ON v.id = r.version_question_id
        WHERE r.participation_id = ?
      `, [p.id]);

      const respMap = new Map(userResponses.map(r => [r.question_id, r.est_correct === 1]));
      const rowObj: Record<string, any> = {
        'Date Début': p.date_debut,
        'Date Fin': p.date_fin || '-',
        'Statut': p.statut,
        'Nom': p.anonyme === 1 ? 'Anonyme' : p.nom,
        'Prénom': p.anonyme === 1 ? 'Anonyme' : p.prenom,
        'Entreprise': p.anonyme === 1 ? 'Anonyme' : p.entreprise,
        'Anonyme': p.anonyme === 1 ? 'Oui' : 'Non',
      };

      allQuestions.forEach((q, idx) => {
        rowObj[`Q${idx + 1}`] = respMap.has(q.id) ? (respMap.get(q.id) ? 'Vrai' : 'Faux') : '-';
      });

      rowObj['Score'] = p.score_final;
      rowObj['Total Questions'] = p.nombre_questions;
      rowObj['% Réussite'] = p.pourcentage_reussite;
      rowObj['Note REX / 5'] = p.rex_note || '-';
      rowObj['Commentaire REX'] = p.rex_commentaire || '-';

      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participations');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="cyberquiz_participations.xlsx"');
    res.send(buffer);
  } catch (err: any) {
    console.error('Erreur export xlsx:', err);
    res.status(500).send('Erreur lors de l’export Excel.');
  }
});

// ============================================================================
// 6. GESTION DES RETOURS D'EXPÉRIENCE (REX)
// ============================================================================

// Lister tous les retours d'expérience
router.get('/admin/retours-experience', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const { note, search } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (note) {
      whereClause += ' AND r.note_satisfaction = ?';
      params.push(parseInt(note as string, 10));
    }

    if (search) {
      whereClause += ' AND (r.commentaire LIKE ? OR part.entreprise LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const rexList = query<{
      id: string;
      participation_id: string;
      note_satisfaction: number;
      commentaire: string;
      appris_quelque_chose: number | null;
      appris_commentaire: string | null;
      date_soumission: string;
      nom: string;
      prenom: string;
      entreprise: string;
      anonyme: number;
      score_final: number;
      nombre_questions: number;
      pourcentage_reussite: number;
    }>(`
      SELECT r.*, part.nom, part.prenom, part.entreprise, part.anonyme,
             p.score_final, p.nombre_questions, p.pourcentage_reussite
      FROM rex r
      JOIN participations p ON p.id = r.participation_id
      JOIN participants part ON part.id = p.participant_id
      ${whereClause}
      ORDER BY r.date_soumission DESC
    `, params);

    // Métriques globales REX
    const avgRexRow = queryOne<{ avg_note: number }>('SELECT AVG(note_satisfaction) as avg_note FROM rex');
    const totalRex = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM rex')?.count || 0;

    // Répartition des notes 1 à 5
    const notesCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const groupRows = query<{ note_satisfaction: number; count: number }>(`
      SELECT note_satisfaction, COUNT(*) as count FROM rex GROUP BY note_satisfaction
    `);
    groupRows.forEach(g => { notesCount[g.note_satisfaction] = g.count; });

    res.json({
      total: totalRex,
      noteMoyenne: avgRexRow && avgRexRow.avg_note ? Math.round(avgRexRow.avg_note * 10) / 10 : 0,
      distribution: notesCount,
      retours: rexList.map(r => ({
        id: r.id,
        participationId: r.participation_id,
        date: r.date_soumission,
        nom: r.anonyme === 1 ? 'Anonyme' : r.nom,
        prenom: r.anonyme === 1 ? 'Anonyme' : r.prenom,
        entreprise: r.anonyme === 1 ? 'Anonyme' : r.entreprise,
        anonyme: r.anonyme === 1,
        note: r.note_satisfaction,
        commentaire: r.commentaire,
        apprisQuelqueChose: r.appris_quelque_chose === 1 ? 'Oui' : r.appris_quelque_chose === 0 ? 'Non' : null,
        apprisCommentaire: r.appris_commentaire || null,
        scoreQuiz: `${r.score_final} / ${r.nombre_questions} (${r.pourcentage_reussite}%)`
      }))
    });
  } catch (err: any) {
    console.error('Erreur get rex:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des retours d’expérience.' });
  }
});

// Export CSV des REX
router.get('/admin/export/rex.csv', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const rexList = query<{
      date_soumission: string;
      nom: string;
      prenom: string;
      entreprise: string;
      anonyme: number;
      note_satisfaction: number;
      commentaire: string;
      appris_quelque_chose: number | null;
      appris_commentaire: string | null;
      score_final: number;
      nombre_questions: number;
      pourcentage_reussite: number;
    }>(`
      SELECT r.date_soumission, r.note_satisfaction, r.commentaire, r.appris_quelque_chose, r.appris_commentaire,
             part.nom, part.prenom, part.entreprise, part.anonyme,
             p.score_final, p.nombre_questions, p.pourcentage_reussite
      FROM rex r
      JOIN participations p ON p.id = r.participation_id
      JOIN participants part ON part.id = p.participant_id
      ORDER BY r.date_soumission DESC
    `);

    const headers = ['Date', 'Nom', 'Prénom', 'Entreprise', 'Anonyme', 'Note / 5', 'Appris pour le travail', 'Détails application travail', 'Commentaire', 'Score Quiz', '% Réussite'];
    const rows = rexList.map(r => [
      r.date_soumission,
      r.anonyme === 1 ? 'Anonyme' : `"${(r.nom || '').replace(/"/g, '""')}"`,
      r.anonyme === 1 ? 'Anonyme' : `"${(r.prenom || '').replace(/"/g, '""')}"`,
      r.anonyme === 1 ? 'Anonyme' : `"${(r.entreprise || '').replace(/"/g, '""')}"`,
      r.anonyme === 1 ? 'Oui' : 'Non',
      r.note_satisfaction,
      r.appris_quelque_chose === 1 ? 'Oui' : r.appris_quelque_chose === 0 ? 'Non' : '-',
      r.appris_commentaire ? `"${r.appris_commentaire.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '-',
      r.commentaire ? `"${r.commentaire.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '-',
      `${r.score_final} / ${r.nombre_questions}`,
      `${r.pourcentage_reussite}%`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cyberquiz_rex.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).send('Erreur lors de l’export.');
  }
});

// ============================================================================
// 7. PARAMÈTRES ADMINISTRATEUR
// ============================================================================

router.get('/admin/settings', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const rows = query<{ cle: string; valeur: string }>('SELECT cle, valeur FROM parametres');
    const settings: Record<string, string> = {};
    rows.forEach(r => { settings[r.cle] = r.valeur; });

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du chargement des paramètres.' });
  }
});

router.put('/admin/settings', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await getDatabase();
    const {
      quiz_titre,
      quiz_sous_titre,
      quiz_actif,
      ordre_questions,
      politique_confidentialite,
      duree_conservation,
      contact_dpo,
      temps_estime,
      restriction_mode,
      restriction_jours,
      pool_actif,
      pool_taille,
      pool_mode_repartition,
      pool_nb_facile,
      pool_nb_moyen,
      pool_nb_difficile
    } = req.body;

    const validMode = ['none', 'delay', 'unique'].includes(restriction_mode) ? restriction_mode : 'delay';
    const parsedJours = parseInt(restriction_jours, 10);
    const validJours = (isNaN(parsedJours) || parsedJours < 1 ? 30 : parsedJours).toString();

    const validOrdre = ['fixe', 'aleatoire', 'difficulte_croissante'].includes(ordre_questions) ? ordre_questions : 'fixe';

    const updates: Record<string, string> = {
      quiz_titre: quiz_titre || 'Tous acteurs de notre cybersécurité',
      quiz_sous_titre: quiz_sous_titre || 'Testez vos connaissances et contribuez à une culture numérique plus responsable.',
      quiz_actif: quiz_actif ? '1' : '0',
      ordre_questions: validOrdre,
      politique_confidentialite: politique_confidentialite || '',
      duree_conservation: duree_conservation || '12 mois',
      contact_dpo: contact_dpo || '',
      temps_estime: temps_estime || '5 minutes',
      restriction_mode: validMode,
      restriction_jours: validJours
    };

    if (pool_actif !== undefined) {
      updates['pool_actif'] = pool_actif ? '1' : '0';
    }
    if (pool_taille !== undefined) {
      updates['pool_taille'] = Math.max(1, parseInt(pool_taille, 10) || 10).toString();
    }
    if (pool_mode_repartition !== undefined) {
      updates['pool_mode_repartition'] = pool_mode_repartition === 'par_difficulte' ? 'par_difficulte' : 'global';
    }
    if (pool_nb_facile !== undefined) {
      updates['pool_nb_facile'] = Math.max(0, parseInt(pool_nb_facile, 10) || 0).toString();
    }
    if (pool_nb_moyen !== undefined) {
      updates['pool_nb_moyen'] = Math.max(0, parseInt(pool_nb_moyen, 10) || 0).toString();
    }
    if (pool_nb_difficile !== undefined) {
      updates['pool_nb_difficile'] = Math.max(0, parseInt(pool_nb_difficile, 10) || 0).toString();
    }

    for (const [cle, valeur] of Object.entries(updates)) {
      run('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)', [cle, valeur]);
    }

    res.json({ success: true, message: 'Paramètres enregistrés avec succès.' });
  } catch (err: any) {
    console.error('Erreur save settings:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement des paramètres.' });
  }
});

export default router;
