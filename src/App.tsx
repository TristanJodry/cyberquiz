import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { HomeView } from './components/HomeView.tsx';
import { QuizView } from './components/QuizView.tsx';
import { ResultsView } from './components/ResultsView.tsx';
import { RexView } from './components/RexView.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { AboutQuizModal } from './components/AboutQuizModal.tsx';
import { PublicConfig, QuestionClient, SubmitAnswerResult, QuizResults, AdminUser } from './types.ts';
import { recordParticipationCompletion } from './utils/restriction.ts';

type AppView = 'home' | 'quiz' | 'results' | 'rex' | 'admin';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [config, setConfig] = useState<PublicConfig | null>(null);

  // Session quiz du participant
  const [participationId, setParticipationId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(1);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionClient | null>(null);
  const [scoreActuel, setScoreActuel] = useState<number>(0);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);

  // États de chargement et erreurs
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Authentification administrateur
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('cyberquiz_admin_token'));
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('cyberquiz_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Charger la configuration publique au démarrage
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/public/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error('Erreur chargement config:', e);
    }
  };

  useEffect(() => {
    loadConfig();

    // Vérifier si un token admin existant est encore valide
    if (adminToken) {
      fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
      .then(res => {
        if (!res.ok) {
          handleAdminLogout();
        }
      })
      .catch(() => handleAdminLogout());
    }

    // Reprise de session participant si existante en cours
    const savedSessionId = sessionStorage.getItem('cyberquiz_session_id');
    if (savedSessionId) {
      fetchSessionState(savedSessionId);
    }
  }, []);

  // Récupérer l'état de la session (reprise automatique après rafraîchissement)
  const fetchSessionState = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/public/session/${sessionId}`);
      if (res.ok) {
        const session = await res.json();
        setParticipationId(sessionId);

        if (session.statut === 'termine') {
          // Déjà complété avec REX
          sessionStorage.removeItem('cyberquiz_session_id');
          setView('home');
        } else if (session.statut === 'quiz_termine') {
          // Quiz terminé, REX en attente
          await loadResults(sessionId);
          setView('results');
        } else {
          // En cours
          setCurrentQuestionIndex(session.currentQuestionIndex);
          await loadQuestion(sessionId, session.currentQuestionIndex);
          setView('quiz');
        }
      } else {
        sessionStorage.removeItem('cyberquiz_session_id');
      }
    } catch (e) {
      console.error('Erreur reprise session:', e);
    }
  };

  // Démarrer une nouvelle participation
  const handleStartQuiz = async (data: { anonyme: boolean; nom?: string; prenom?: string; entreprise?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Erreur lors du démarrage du quiz.');
      }

      const newId = result.participationId;
      setParticipationId(newId);
      setCurrentQuestionIndex(1);
      setScoreActuel(0);
      sessionStorage.setItem('cyberquiz_session_id', newId);

      await loadQuestion(newId, 1);
      setView('quiz');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger une question par son index (1-based)
  const loadQuestion = async (sessionId: string, index: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/public/session/${sessionId}/question/${index}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur chargement question.');
      }
      const q = await res.json();
      setCurrentQuestion(q);
      setCurrentQuestionIndex(index);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Soumettre une réponse
  const handleSubmitAnswer = async (selectedIds: string[]): Promise<SubmitAnswerResult | null> => {
    if (!participationId) return null;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/public/session/${participationId}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: currentQuestionIndex,
          selectedPropositionIds: selectedIds
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur validation.');
      }

      setScoreActuel(data.score_actuel);
      return data;
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la validation.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Passer à la question suivante
  const handleNextQuestion = async () => {
    if (!participationId) return;
    const nextIdx = currentQuestionIndex + 1;
    await loadQuestion(participationId, nextIdx);
  };

  // Charger les résultats finaux
  const loadResults = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/public/session/${sessionId}/results`);
      if (res.ok) {
        const data = await res.json();
        setQuizResults(data);
      }
    } catch (e) {
      console.error('Erreur chargement résultats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Terminer le quiz et afficher les résultats
  const handleFinishQuiz = async () => {
    if (!participationId) return;
    await loadResults(participationId);
    setView('results');
  };

  // Soumettre le REX
  const handleSubmitRex = async (
    note: number, 
    commentaire: string, 
    apprisQuelqueChose: boolean | null, 
    apprisCommentaire: string
  ): Promise<boolean> => {
    if (!participationId) return false;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/public/session/${participationId}/submit-rex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          note_satisfaction: note, 
          commentaire,
          appris_quelque_chose: apprisQuelqueChose,
          appris_commentaire: apprisCommentaire
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur enregistrement REX.');
      }

      // Enregistrer la complétion complète (Quiz + REX) pour la temporisation par navigateur
      recordParticipationCompletion();

      // Nettoyer la session terminée
      sessionStorage.removeItem('cyberquiz_session_id');
      return true;
    } catch (e: any) {
      alert(e.message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gestion Admin
  const handleLoginSuccess = (token: string, admin: AdminUser) => {
    setAdminToken(token);
    setAdminUser(admin);
    localStorage.setItem('cyberquiz_admin_token', token);
    localStorage.setItem('cyberquiz_admin_user', JSON.stringify(admin));
    setIsAdminModalOpen(false);
    setView('admin');
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setAdminUser(null);
    localStorage.removeItem('cyberquiz_admin_token');
    localStorage.removeItem('cyberquiz_admin_user');
    setView('home');
  };

  return (
    <div className="min-h-screen bg-[#070b18] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Barre de navigation globale */}
      <Navbar
        activeView={view}
        isAdminLoggedIn={!!adminToken}
        onOpenAdmin={() => {
          if (adminToken) {
            if (view === 'admin') {
              loadConfig();
              setView('home');
            } else {
              setView('admin');
            }
          } else {
            setIsAdminModalOpen(true);
          }
        }}
        onGoHome={() => {
          setView('home');
          loadConfig();
        }}
      />

      {/* Contenu principal selon la vue */}
      <main className="flex-1">
        
        {/* VUE 1 : ACCUEIL */}
        {view === 'home' && (
          <HomeView
            config={config}
            onStartQuiz={handleStartQuiz}
            isLoading={isLoading}
            error={error}
            hasActiveSession={Boolean(sessionStorage.getItem('cyberquiz_session_id'))}
            onResumeSession={() => {
              const savedId = sessionStorage.getItem('cyberquiz_session_id');
              if (savedId) fetchSessionState(savedId);
            }}
          />
        )}

        {/* VUE 2 : QUESTIONNAIRE DU QUIZ */}
        {view === 'quiz' && currentQuestion && (
          <QuizView
            question={currentQuestion}
            onSubmitAnswer={handleSubmitAnswer}
            onNextQuestion={handleNextQuestion}
            onFinishQuiz={handleFinishQuiz}
            isSubmitting={isSubmitting}
            scoreActuel={scoreActuel}
          />
        )}

        {/* VUE 3 : RÉSULTATS DU QUIZ */}
        {view === 'results' && quizResults && (
          <ResultsView
            results={quizResults}
            onGoToRex={() => setView('rex')}
          />
        )}

        {/* VUE 4 : RETOUR D'EXPÉRIENCE (REX) */}
        {view === 'rex' && (
          <RexView
            onSubmitRex={handleSubmitRex}
            isSubmitting={isSubmitting}
            onGoHome={() => {
              setView('home');
              loadConfig();
            }}
          />
        )}

        {/* VUE 5 : TABLEAU DE BORD ADMINISTRATEUR */}
        {view === 'admin' && adminToken && adminUser && (
          <AdminDashboard
            token={adminToken}
            admin={adminUser}
            onLogout={handleAdminLogout}
            onConfigUpdated={loadConfig}
          />
        )}

      </main>

      {/* Modal de connexion administrateur */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Bouton d'information et modale En savoir plus sur ce quiz */}
      {view !== 'admin' && <AboutQuizModal />}
    </div>
  );
}
