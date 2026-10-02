import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Eye, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle,
  Archive,
  Check,
  Layers,
  Sparkles,
  Shuffle,
  Save,
  CheckCircle2,
  RefreshCw,
  Info,
  Power,
  PowerOff,
  ToggleLeft,
  ToggleRight,
  Sliders
} from 'lucide-react';
import { 
  QuestionAdmin, 
  QuestionType, 
  QuestionStatus, 
  QuestionDifficulty, 
  PoolSettings 
} from '../../types.ts';

interface AdminQuestionsProps {
  token: string;
}

export const AdminQuestions: React.FC<AdminQuestionsProps> = ({ token }) => {
  // Onglet principal : 'banque' ou 'pool'
  const [activeTab, setActiveTab] = useState<'banque' | 'pool'>('banque');

  // Banque de questions
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'facile' | 'moyen' | 'difficile'>('all');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionAdmin | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionAdmin | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formulaire d'édition / création
  const [formEnonce, setFormEnonce] = useState('');
  const [formType, setFormType] = useState<QuestionType>('unique');
  const [formDifficulte, setFormDifficulte] = useState<QuestionDifficulty>('moyen');
  const [formExplication, setFormExplication] = useState('');
  const [formStatut, setFormStatut] = useState<QuestionStatus>('actif');
  const [formPropositions, setFormPropositions] = useState<Array<{ texte: string; est_correcte: boolean }>>([
    { texte: '', est_correcte: true },
    { texte: '', est_correcte: false },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Paramètres du Pool de questions
  const [poolSettings, setPoolSettings] = useState<PoolSettings>({
    ordre_questions: 'difficulte_croissante',
    pool_actif: false,
    pool_taille: 10,
    pool_mode_repartition: 'global',
    pool_nb_facile: 3,
    pool_nb_moyen: 4,
    pool_nb_difficile: 3,
    total_questions_actives: 0,
    count_facile: 0,
    count_moyen: 0,
    count_difficile: 0
  });
  const [isSavingPool, setIsSavingPool] = useState(false);
  const [poolMsg, setPoolMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [simulationSample, setSimulationSample] = useState<Array<{
    index: number;
    enonce: string;
    difficulte: QuestionDifficulty;
    type: QuestionType;
  }> | null>(null);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/questions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (err: any) {
      setError('Impossible de charger les questions.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPoolSettings = async () => {
    try {
      const res = await fetch('/api/admin/pool-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPoolSettings(data);
      }
    } catch (err) {
      console.error('Erreur chargement pool settings:', err);
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchPoolSettings();
  }, []);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormEnonce('');
    setFormType('unique');
    setFormDifficulte('moyen');
    setFormExplication('');
    setFormStatut('actif');
    setFormPropositions([
      { texte: '', est_correcte: true },
      { texte: '', est_correcte: false },
      { texte: '', est_correcte: false }
    ]);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openEditModal = (q: QuestionAdmin) => {
    setEditingQuestion(q);
    setFormEnonce(q.enonce);
    setFormType(q.type);
    setFormDifficulte(q.difficulte || 'moyen');
    setFormExplication(q.explication);
    setFormStatut(q.statut);
    setFormPropositions(q.propositions.map(p => ({ texte: p.texte, est_correcte: p.est_correcte })));
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleAddProposition = () => {
    setFormPropositions(prev => [...prev, { texte: '', est_correcte: false }]);
  };

  const handleRemoveProposition = (idx: number) => {
    if (formPropositions.length <= 2) {
      setFormError('Une question doit comporter au moins 2 propositions.');
      return;
    }
    setFormPropositions(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePropTextChange = (idx: number, val: string) => {
    setFormPropositions(prev => {
      const copy = [...prev];
      copy[idx].texte = val;
      return copy;
    });
  };

  const handleTogglePropCorrect = (idx: number) => {
    setFormPropositions(prev => {
      const copy = [...prev];
      if (formType === 'unique') {
        copy.forEach((p, i) => { p.est_correcte = i === idx; });
      } else {
        copy[idx].est_correcte = !copy[idx].est_correcte;
      }
      return copy;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formEnonce.trim()) {
      setFormError('L’énoncé de la question est obligatoire.');
      return;
    }

    if (formPropositions.some(p => !p.texte.trim())) {
      setFormError('Toutes les propositions doivent avoir un texte non vide.');
      return;
    }

    const correctCount = formPropositions.filter(p => p.est_correcte).length;
    if (correctCount === 0) {
      setFormError('Veuillez désigner au moins une bonne réponse (cochez l’icône verte correspondante).');
      return;
    }

    if (formType === 'unique' && correctCount > 1) {
      setFormError('Une question à réponse unique ne peut avoir qu’une seule bonne réponse.');
      return;
    }

    try {
      const url = editingQuestion ? `/api/admin/questions/${editingQuestion.id}` : '/api/admin/questions';
      const method = editingQuestion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: formType,
          difficulte: formDifficulte,
          enonce: formEnonce,
          explication: formExplication,
          propositions: formPropositions,
          statut: formStatut
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’enregistrement.');

      setIsEditModalOpen(false);
      setSuccessMsg(data.message || 'Opération réussie.');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchQuestions();
      fetchPoolSettings();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDuplicate = async (qId: string) => {
    try {
      const res = await fetch(`/api/admin/questions/${qId}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccessMsg('Question dupliquée avec succès.');
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchQuestions();
        fetchPoolSettings();
      }
    } catch (err) {
      setError('Erreur lors de la duplication.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/questions/${questionToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Question supprimée avec succès.');
        setTimeout(() => setSuccessMsg(null), 3500);
        setQuestionToDelete(null);
        fetchQuestions();
        fetchPoolSettings();
      } else {
        setError(data.error || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      setError('Erreur lors de la suppression de la question.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (q: QuestionAdmin) => {
    const nextStatus = q.statut === 'actif' ? 'inactif' : 'actif';
    try {
      const res = await fetch(`/api/admin/questions/${q.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ statut: nextStatus })
      });
      if (res.ok) {
        setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, statut: nextStatus } : item));
        fetchPoolSettings();
      }
    } catch (err) {
      setError('Erreur lors de la modification du statut.');
    }
  };

  const handleChangeDifficulty = async (qId: string, diff: QuestionDifficulty) => {
    try {
      const res = await fetch(`/api/admin/questions/${qId}/difficulty`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ difficulte: diff })
      });
      if (res.ok) {
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, difficulte: diff } : q));
        fetchPoolSettings();
      }
    } catch (err) {
      console.error('Erreur changement difficulté:', err);
    }
  };

  const handleArchive = async (qId: string) => {
    try {
      const res = await fetch(`/api/admin/questions/${qId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ statut: 'archive' })
      });
      if (res.ok) {
        setSuccessMsg('Question archivée.');
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchQuestions();
        fetchPoolSettings();
      }
    } catch (err) {
      setError('Erreur lors de l’archivage.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const copy = [...questions];
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];

    try {
      const res = await fetch('/api/admin/questions/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderedIds: copy.map(q => q.id) })
      });
      if (res.ok) {
        setQuestions(copy);
      }
    } catch (err) {
      setError('Erreur lors du réordonnancement.');
    }
  };

  // Enregistrement des paramètres Pool
  const handleSavePoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPool(true);
    setPoolMsg(null);

    try {
      const res = await fetch('/api/admin/pool-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(poolSettings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde.');

      setPoolMsg({ type: 'success', text: 'Configuration du Pool enregistrée avec succès !' });
      fetchPoolSettings();
      setTimeout(() => setPoolMsg(null), 4000);
    } catch (err: any) {
      setPoolMsg({ type: 'error', text: err.message });
    } finally {
      setIsSavingPool(false);
    }
  };

  // Répartition automatique équitable
  const handleAutoDistribute = () => {
    const total = poolSettings.pool_taille;
    const third = Math.floor(total / 3);
    const rem = total % 3;

    // Répartit avec légère priorité au niveau moyen si reste
    let nbFacile = third;
    let nbMoyen = third + (rem > 0 ? 1 : 0);
    let nbDifficile = third + (rem > 1 ? 1 : 0);

    setPoolSettings(prev => ({
      ...prev,
      pool_nb_facile: Math.min(nbFacile, countActiveFacile || nbFacile),
      pool_nb_moyen: Math.min(nbMoyen, countActiveMoyen || nbMoyen),
      pool_nb_difficile: Math.min(nbDifficile, countActiveDifficile || nbDifficile)
    }));
  };

  // Simulateur de tirage aléatoire
  const runSimulation = () => {
    const actives = questions.filter(q => q.statut === 'actif');
    if (actives.length === 0) {
      setSimulationSample([]);
      return;
    }

    const shuffle = <T,>(arr: T[]): T[] => {
      const r = [...arr];
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    };

    let selected: typeof actives = [];

    if (poolSettings.pool_actif) {
      if (poolSettings.pool_mode_repartition === 'par_difficulte') {
        const faciles = shuffle(actives.filter(q => (q.difficulte || 'moyen') === 'facile'));
        const moyens = shuffle(actives.filter(q => (q.difficulte || 'moyen') === 'moyen'));
        const difficiles = shuffle(actives.filter(q => (q.difficulte || 'moyen') === 'difficile'));

        const pickedF = faciles.slice(0, Math.max(0, poolSettings.pool_nb_facile));
        const pickedM = moyens.slice(0, Math.max(0, poolSettings.pool_nb_moyen));
        const pickedD = difficiles.slice(0, Math.max(0, poolSettings.pool_nb_difficile));

        selected = [...pickedF, ...pickedM, ...pickedD];
        if (selected.length === 0) {
          selected = shuffle(actives).slice(0, Math.min(poolSettings.pool_taille, actives.length));
        }
      } else {
        const target = Math.max(1, Math.min(poolSettings.pool_taille, actives.length));
        selected = shuffle(actives).slice(0, target);
      }
    } else {
      selected = [...actives];
    }

    let ordered: typeof actives = [];
    if (poolSettings.ordre_questions === 'difficulte_croissante') {
      const qF = shuffle(selected.filter(q => (q.difficulte || 'moyen') === 'facile'));
      const qM = shuffle(selected.filter(q => (q.difficulte || 'moyen') === 'moyen'));
      const qD = shuffle(selected.filter(q => (q.difficulte || 'moyen') === 'difficile'));
      ordered = [...qF, ...qM, ...qD];
    } else if (poolSettings.ordre_questions === 'aleatoire') {
      ordered = shuffle(selected);
    } else {
      ordered = [...selected].sort((a, b) => a.position - b.position);
    }

    setSimulationSample(ordered.map((q, idx) => ({
      index: idx + 1,
      enonce: q.enonce,
      difficulte: q.difficulte || 'moyen',
      type: q.type
    })));
  };

  // Filtrage des questions dans la banque
  const filteredQuestions = questions.filter(q => {
    if (filterDifficulty === 'all') return true;
    return (q.difficulte || 'moyen') === filterDifficulty;
  });

  const countFacile = questions.filter(q => (q.difficulte || 'moyen') === 'facile').length;
  const countMoyen = questions.filter(q => (q.difficulte || 'moyen') === 'moyen').length;
  const countDifficile = questions.filter(q => (q.difficulte || 'moyen') === 'difficile').length;

  const countActiveFacile = questions.filter(q => q.statut === 'actif' && (q.difficulte || 'moyen') === 'facile').length;
  const countActiveMoyen = questions.filter(q => q.statut === 'actif' && (q.difficulte || 'moyen') === 'moyen').length;
  const countActiveDifficile = questions.filter(q => q.statut === 'actif' && (q.difficulte || 'moyen') === 'difficile').length;
  const countActiveTotal = questions.filter(q => q.statut === 'actif').length;

  const sumParDifficulte = (poolSettings.pool_nb_facile || 0) + (poolSettings.pool_nb_moyen || 0) + (poolSettings.pool_nb_difficile || 0);

  const renderDifficultyBadge = (diff: QuestionDifficulty) => {
    switch (diff) {
      case 'facile':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 border border-emerald-700/80 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Facile</span>
          </span>
        );
      case 'difficile':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/70 border border-rose-700/80 text-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>Difficile</span>
          </span>
        );
      case 'moyen':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/70 border border-amber-700/80 text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Moyen</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Messages d'alerte ou succès globaux */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Barre d'onglets principale */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('banque')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'banque'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Banque de questions</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
              {questions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pool')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'pool'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Pool de questions</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              poolSettings.pool_actif
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              {poolSettings.pool_actif ? `Actif (${poolSettings.pool_taille} Q)` : 'Désactivé'}
            </span>
          </button>
        </div>

        {activeTab === 'banque' && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une question</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : BANQUE DE QUESTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'banque' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Barre de filtres par difficulté */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c142b] p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-300 mr-1">Filtrer par difficulté :</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterDifficulty('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  filterDifficulty === 'all'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Toutes ({questions.length})
              </button>
              <button
                onClick={() => setFilterDifficulty('facile')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
                  filterDifficulty === 'facile'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Facile ({countFacile})</span>
              </button>
              <button
                onClick={() => setFilterDifficulty('moyen')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
                  filterDifficulty === 'moyen'
                    ? 'bg-amber-950 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Moyen ({countMoyen})</span>
              </button>
              <button
                onClick={() => setFilterDifficulty('difficile')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
                  filterDifficulty === 'difficile'
                    ? 'bg-rose-950 border-rose-500 text-rose-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Difficile ({countDifficile})</span>
              </button>
            </div>
          </div>

          {/* Tableau des questions */}
          <div className="bg-[#0c142b] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Chargement des questions...</div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-base font-medium text-slate-300">
                  {filterDifficulty === 'all' 
                    ? "Aucune question n'est enregistrée." 
                    : `Aucune question dans la catégorie « ${filterDifficulty} »`}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {filterDifficulty === 'all'
                    ? "Cliquez sur « Ajouter une question » ci-dessus pour composer votre questionnaire de sensibilisation."
                    : "Modifiez la difficulté d'une question ou ajoutez-en une nouvelle avec ce niveau."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 w-12 text-center">Pos.</th>
                      <th className="py-3 px-3 text-center">Statut</th>
                      <th className="py-3 px-4">Énoncé</th>
                      <th className="py-3 px-3 text-center">Difficulté</th>
                      <th className="py-3 px-3 text-center">Type</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredQuestions.map((q, idx) => {
                      const isActif = q.statut === 'actif';
                      const isArchive = q.statut === 'archive';

                      return (
                        <tr key={q.id} className="hover:bg-slate-900/40 transition-colors">
                          {/* Position & flèches */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-cyan-400 font-bold text-xs">{q.position || idx + 1}</span>
                              <div className="flex items-center gap-0.5 mt-1">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleMove(idx, 'up')}
                                  className="p-0.5 rounded text-slate-500 hover:text-cyan-400 disabled:opacity-20 cursor-pointer"
                                  title="Monter"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  disabled={idx === filteredQuestions.length - 1}
                                  onClick={() => handleMove(idx, 'down')}
                                  className="p-0.5 rounded text-slate-500 hover:text-cyan-400 disabled:opacity-20 cursor-pointer"
                                  title="Descendre"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Statut avec logo / icône visuelle claire (Actif vs Inactif) */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(q)}
                              disabled={isArchive}
                              title={
                                isArchive
                                  ? 'Question archivée'
                                  : isActif
                                  ? 'Question active (diffusée) - Cliquer pour désactiver'
                                  : 'Question inactive (masquée) - Cliquer pour activer'
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                isActif
                                  ? 'bg-emerald-950/70 border-emerald-600/80 text-emerald-300 hover:bg-emerald-900/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                  : isArchive
                                  ? 'bg-rose-950/40 border-rose-900 text-rose-400 cursor-not-allowed opacity-80'
                                  : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                              }`}
                            >
                              {isActif ? (
                                <>
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                                  </span>
                                  <Power className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Active</span>
                                </>
                              ) : isArchive ? (
                                <>
                                  <Archive className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Archivée</span>
                                </>
                              ) : (
                                <>
                                  <PowerOff className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Inactive</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Énoncé */}
                          <td className="py-3 px-4 max-w-md lg:max-w-lg">
                            <div className="flex items-start gap-2">
                              <div>
                                <p className={`font-semibold leading-snug ${isActif ? 'text-white' : 'text-slate-400 line-through decoration-slate-600'}`}>
                                  {q.enonce}
                                </p>
                                {q.explication && (
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                                    {q.explication}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Difficulté avec menu rapide */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <select
                              value={q.difficulte || 'moyen'}
                              onChange={(e) => handleChangeDifficulty(q.id, e.target.value as QuestionDifficulty)}
                              className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition cursor-pointer bg-slate-950 focus:outline-none ${
                                (q.difficulte || 'moyen') === 'facile'
                                  ? 'border-emerald-700/80 text-emerald-300'
                                  : (q.difficulte || 'moyen') === 'difficile'
                                  ? 'border-rose-700/80 text-rose-300'
                                  : 'border-amber-700/80 text-amber-300'
                              }`}
                            >
                              <option value="facile" className="bg-slate-900 text-emerald-300 font-semibold">● Facile</option>
                              <option value="moyen" className="bg-slate-900 text-amber-300 font-semibold">● Moyen</option>
                              <option value="difficile" className="bg-slate-900 text-rose-300 font-semibold">● Difficile</option>
                            </select>
                          </td>

                          {/* Type */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              q.type === 'unique'
                                ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                                : 'bg-purple-950/60 border-purple-800 text-purple-300'
                            }`}>
                              {q.type === 'unique' ? 'Unique' : 'QCM'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPreviewQuestion(q)}
                                title="Prévisualiser"
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(q)}
                                title="Modifier"
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDuplicate(q.id)}
                                title="Dupliquer"
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {!isArchive && (
                                <button
                                  onClick={() => handleArchive(q.id)}
                                  title="Archiver"
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-amber-950/60 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setQuestionToDelete(q)}
                                title="Supprimer la question"
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : POOL DE QUESTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'pool' && (
        <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto">
          
          {/* Notification feedback */}
          {poolMsg && (
            <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
              poolMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}>
              {poolMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{poolMsg.text}</span>
            </div>
          )}

          {/* En-tête et métriques */}
          <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-purple-400" />
                <span>Configuration du Pool de questions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Le mode Pool permet de constituer un questionnaire allégé : les participants reçoivent un tirage au sort personnalisé (ex : 10 questions parmi 20) pour que chacun n'ait pas les mêmes questions.
              </p>
            </div>

            {/* Cartes métriques */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <span className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Actives au total</span>
                <span className="text-xl font-extrabold text-white mt-0.5 block">{countActiveTotal}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center">
                <span className="block text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Faciles</span>
                <span className="text-xl font-extrabold text-emerald-300 mt-0.5 block">{countActiveFacile}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-center">
                <span className="block text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Moyennes</span>
                <span className="text-xl font-extrabold text-amber-300 mt-0.5 block">{countActiveMoyen}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-center">
                <span className="block text-[11px] text-rose-400 font-semibold uppercase tracking-wider">Difficiles</span>
                <span className="text-xl font-extrabold text-rose-300 mt-0.5 block">{countActiveDifficile}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSavePoolSettings} className="space-y-6">
            
            {/* Boîte principale de configuration */}
            <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              
              {/* Activation du pool */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    Activer le pool de questions
                  </span>
                  <p className="text-xs text-slate-400">
                    Tirage au sort d'un sous-ensemble de questions pour chaque participant
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={poolSettings.pool_actif}
                    onChange={(e) => setPoolSettings(prev => ({ ...prev, pool_actif: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500 shadow-sm"></div>
                </label>
              </div>

              {poolSettings.pool_actif ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* ÉTAPE 1 : Nombre de questions par participant */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider">
                          Nombre de questions souhaité par participant
                        </label>
                        <p className="text-xs text-slate-400">
                          Chaque participant recevra ce nombre de questions parmi les {countActiveTotal} actives.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPoolSettings(prev => ({ 
                            ...prev, 
                            pool_taille: Math.max(1, prev.pool_taille - 1) 
                          }))}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, countActiveTotal)}
                          value={poolSettings.pool_taille}
                          onChange={(e) => setPoolSettings(prev => ({ 
                            ...prev, 
                            pool_taille: Math.max(1, parseInt(e.target.value, 10) || 1) 
                          }))}
                          className="w-16 px-2 py-1.5 bg-slate-950 border border-purple-500/60 rounded-xl text-white font-mono font-bold text-base text-center focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setPoolSettings(prev => ({ 
                            ...prev, 
                            pool_taille: Math.min(Math.max(1, countActiveTotal), prev.pool_taille + 1) 
                          }))}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                        <span className="text-xs text-slate-300 font-semibold ml-1">questions</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={Math.max(1, countActiveTotal)}
                      value={Math.min(poolSettings.pool_taille, Math.max(1, countActiveTotal))}
                      onChange={(e) => setPoolSettings(prev => ({ ...prev, pool_taille: parseInt(e.target.value, 10) }))}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>

                  {/* ÉTAPE 2 : SOUS-OPTION : Répartition par difficulté */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Option : Définir le nombre de questions par difficulté
                        </span>
                        <p className="text-xs text-slate-400">
                          Spécifiez le nombre de questions Faciles, Moyennes et Difficiles à tirer pour atteindre les {poolSettings.pool_taille} questions
                        </p>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={poolSettings.pool_mode_repartition === 'par_difficulte'}
                          onChange={(e) => setPoolSettings(prev => ({ 
                            ...prev, 
                            pool_mode_repartition: e.target.checked ? 'par_difficulte' : 'global' 
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>

                    {poolSettings.pool_mode_repartition === 'par_difficulte' ? (
                      <div className="space-y-3.5 pt-2 animate-in fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Faciles */}
                          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-300">Faciles</span>
                              <span className="text-[10px] text-slate-400">Dispo : {countActiveFacile}</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={countActiveFacile}
                              value={poolSettings.pool_nb_facile}
                              onChange={(e) => setPoolSettings(prev => ({ 
                                ...prev, 
                                pool_nb_facile: Math.max(0, parseInt(e.target.value, 10) || 0) 
                              }))}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-emerald-600/60 rounded-lg text-white font-mono font-bold text-sm text-center focus:outline-none"
                            />
                          </div>

                          {/* Moyennes */}
                          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-300">Moyennes</span>
                              <span className="text-[10px] text-slate-400">Dispo : {countActiveMoyen}</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={countActiveMoyen}
                              value={poolSettings.pool_nb_moyen}
                              onChange={(e) => setPoolSettings(prev => ({ 
                                ...prev, 
                                pool_nb_moyen: Math.max(0, parseInt(e.target.value, 10) || 0) 
                              }))}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-amber-600/60 rounded-lg text-white font-mono font-bold text-sm text-center focus:outline-none"
                            />
                          </div>

                          {/* Difficiles */}
                          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-rose-300">Difficiles</span>
                              <span className="text-[10px] text-slate-400">Dispo : {countActiveDifficile}</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={countActiveDifficile}
                              value={poolSettings.pool_nb_difficile}
                              onChange={(e) => setPoolSettings(prev => ({ 
                                ...prev, 
                                pool_nb_difficile: Math.max(0, parseInt(e.target.value, 10) || 0) 
                              }))}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-rose-600/60 rounded-lg text-white font-mono font-bold text-sm text-center focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Récapitulatif et cohérence de la somme */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                          <div>
                            <span className="text-slate-400">Total réparti : </span>
                            <span className="font-mono font-bold text-white mr-2">
                              {sumParDifficulte} / {poolSettings.pool_taille} questions
                            </span>
                            {sumParDifficulte === poolSettings.pool_taille ? (
                              <span className="text-emerald-400 font-semibold">✓ Correspond parfaitement au total</span>
                            ) : (
                              <span className="text-amber-400 font-semibold">
                                ⚠️ {poolSettings.pool_taille - sumParDifficulte > 0 
                                  ? `Il reste ${poolSettings.pool_taille - sumParDifficulte} question(s) à attribuer` 
                                  : `${sumParDifficulte - poolSettings.pool_taille} question(s) en trop`}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={handleAutoDistribute}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-purple-800/60 text-[11px] font-semibold cursor-pointer transition"
                          >
                            Répartir automatiquement
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        Mode global : le tirage au sort des {poolSettings.pool_taille} questions s'effectue librement parmi toutes les questions actives sans quota par niveau.
                      </div>
                    )}
                  </div>

                  {/* Simulateur de tirage */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Simulateur de tirage aléatoire</span>
                        </h5>
                        <p className="text-[11px] text-slate-400">
                          Aperçu concret d'une session participant avec la configuration actuelle
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={runSimulation}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-cyan-800/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tester un tirage</span>
                      </button>
                    </div>

                    {simulationSample && (
                      <div className="space-y-2 pt-2 border-t border-slate-800/80 animate-in fade-in">
                        <div className="text-[11px] text-slate-300 flex items-center justify-between font-semibold">
                          <span>Échantillon généré ({simulationSample.length} questions) :</span>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {simulationSample.map((sim) => (
                            <div 
                              key={sim.index}
                              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden mr-2">
                                <span className="font-mono text-cyan-400 font-bold shrink-0">#{sim.index}</span>
                                <span className="text-white truncate">{sim.enonce}</span>
                              </div>
                              <div className="shrink-0">
                                {renderDifficultyBadge(sim.difficulte)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Le mode Pool est actuellement <strong>désactivé</strong> : chaque participant recevra l'ensemble des <strong>{countActiveTotal} questions actives</strong>.
                  </span>
                </div>
              )}

              {/* Bouton de sauvegarde */}
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSavingPool}
                  className="px-6 py-3 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-purple-400 via-purple-300 to-cyan-300 hover:from-purple-300 hover:to-cyan-200 active:scale-[0.99] transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingPool ? 'Enregistrement...' : 'Enregistrer la configuration du Pool'}</span>
                </button>
              </div>

            </div>

          </form>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CRÉATION / ÉDITION DE QUESTION */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-cyan-900/60 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div>
                <h3 className="font-bold text-white text-base">
                  {editingQuestion ? 'Modifier la question' : 'Nouvelle question de cybersécurité'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Corps formulaire */}
            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-5 text-left">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
                  {formError}
                </div>
              )}

              {/* Type de question */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Type de question
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('unique');
                      setFormPropositions(prev => {
                        let hadOne = false;
                        return prev.map(p => {
                          if (p.est_correcte && !hadOne) {
                            hadOne = true;
                            return p;
                          }
                          return { ...p, est_correcte: false };
                        });
                      });
                    }}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                      formType === 'unique'
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Réponse unique (Type A)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('multiple')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                      formType === 'multiple'
                        ? 'bg-purple-950/60 border-purple-400 text-purple-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Choix multiple QCM (Type B)</span>
                  </button>
                </div>
              </div>

              {/* Niveau de difficulté */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Niveau de difficulté
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormDifficulte('facile')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer transition ${
                      formDifficulte === 'facile'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-bold">Facile</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Réflexes de base</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormDifficulte('moyen')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer transition ${
                      formDifficulte === 'moyen'
                        ? 'bg-amber-950/70 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span className="font-bold">Moyen</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Vigilance quotidienne</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormDifficulte('difficile')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer transition ${
                      formDifficulte === 'difficile'
                        ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <span className="font-bold">Difficile</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Attaques avancées</span>
                  </button>
                </div>
              </div>

              {/* Énoncé */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Énoncé de la question *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formEnonce}
                  onChange={(e) => setFormEnonce(e.target.value)}
                  placeholder="Ex: Que devez-vous faire si vous recevez un SMS d'un livreur contenant un lien vous demandant de payer des frais de douane ?"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Propositions dynamiques */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Propositions de réponse *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Cochez l'icône verte pour marquer la ou les bonnes réponses
                  </span>
                </div>

                <div className="space-y-2.5">
                  {formPropositions.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      {/* Bouton bonne réponse */}
                      <button
                        type="button"
                        onClick={() => handleTogglePropCorrect(idx)}
                        title={p.est_correcte ? 'Bonne réponse' : 'Marquer comme bonne réponse'}
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition cursor-pointer ${
                          p.est_correcte
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                            : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Check className="w-5 h-5 font-bold" />
                      </button>

                      {/* Texte */}
                      <input
                        type="text"
                        required
                        value={p.texte}
                        onChange={(e) => handlePropTextChange(idx, e.target.value)}
                        placeholder={`Proposition ${String.fromCharCode(65 + idx)}...`}
                        className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-white text-sm focus:outline-none transition ${
                          p.est_correcte ? 'border-emerald-700/80 bg-emerald-950/20' : 'border-slate-700 focus:border-cyan-400'
                        }`}
                      />

                      {/* Supprimer proposition */}
                      <button
                        type="button"
                        onClick={() => handleRemoveProposition(idx)}
                        className="p-2.5 rounded-xl bg-slate-900 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddProposition}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une proposition supplémentaire</span>
                </button>
              </div>

              {/* Explication pédagogique */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Explication pédagogique *
                </label>
                <textarea
                  rows={3}
                  value={formExplication}
                  onChange={(e) => setFormExplication(e.target.value)}
                  placeholder="Expliquez pourquoi cette réponse est la bonne et quel réflexe adopter au quotidien..."
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Statut */}
              <div className="flex items-center gap-4 pt-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Statut de la question :
                </label>
                <select
                  value={formStatut}
                  onChange={(e) => setFormStatut(e.target.value as QuestionStatus)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs cursor-pointer"
                >
                  <option value="actif">Actif (diffusée dans les sessions)</option>
                  <option value="inactif">Inactif (masquée temporairement)</option>
                  <option value="archive">Archivée</option>
                </select>
              </div>

              {/* Boutons d'actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                {editingQuestion ? (
                  <button
                    type="button"
                    onClick={() => {
                      const q = editingQuestion;
                      setIsEditModalOpen(false);
                      setQuestionToDelete(q);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>Supprimer cette question</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-xs transition cursor-pointer"
                  >
                    {editingQuestion ? 'Mettre à jour la question' : 'Créer la question'}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE PRÉVISUALISATION */}
      {/* ========================================================================= */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-cyan-900/60 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setPreviewQuestion(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-950 border border-cyan-800 text-cyan-400">
                Prévisualisation participant
              </span>
              {renderDifficultyBadge(previewQuestion.difficulte || 'moyen')}
              <span className="text-xs text-slate-400">
                {previewQuestion.type === 'unique' ? 'Réponse unique' : 'Choix multiple'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white mb-5 leading-snug">
              {previewQuestion.enonce}
            </h3>

            <div className="space-y-2.5 mb-5">
              {previewQuestion.propositions.map((p, i) => (
                <div 
                  key={p.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
                    p.est_correcte
                      ? 'bg-emerald-950/40 border-emerald-600 text-emerald-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{p.texte}</span>
                  </div>
                  {p.est_correcte && (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
                      Bonne réponse
                    </span>
                  )}
                </div>
              ))}
            </div>

            {previewQuestion.explication && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed mb-5">
                <span className="font-bold text-cyan-400 block mb-1">Explication pédagogique :</span>
                {previewQuestion.explication}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Fermer l'aperçu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMATION DE SUPPRESSION DÉFINITIVE */}
      {/* ========================================================================= */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-white text-base">Supprimer définitivement la question ?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer cette question ?
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 italic">
              « {questionToDelete.enonce} »
            </div>
            <p className="text-[11px] text-rose-400">
              ⚠️ Cette action effacera également toutes ses versions antérieures et ses propositions.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
