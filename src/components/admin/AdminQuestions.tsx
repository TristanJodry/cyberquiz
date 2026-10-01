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
  XCircle, 
  AlertCircle, 
  HelpCircle,
  Archive,
  Check
} from 'lucide-react';
import { QuestionAdmin, QuestionType, QuestionStatus } from '../../types.ts';

interface AdminQuestionsProps {
  token: string;
}

export const AdminQuestions: React.FC<AdminQuestionsProps> = ({ token }) => {
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionAdmin | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionAdmin | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formulaire d'édition / création
  const [formEnonce, setFormEnonce] = useState('');
  const [formType, setFormType] = useState<QuestionType>('unique');
  const [formExplication, setFormExplication] = useState('');
  const [formStatut, setFormStatut] = useState<QuestionStatus>('actif');
  const [formPropositions, setFormPropositions] = useState<Array<{ texte: string; est_correcte: boolean }>>([
    { texte: '', est_correcte: true },
    { texte: '', est_correcte: false },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchQuestions();
  }, []);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormEnonce('');
    setFormType('unique');
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
        // En mode unique : seule cette case devient vraie
        copy.forEach((p, i) => { p.est_correcte = i === idx; });
      } else {
        // En mode multiple : bascule libre
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
        fetchQuestions();
      }
    } catch (err) {
      setError('Erreur lors de la modification du statut.');
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

  return (
    <div className="space-y-6">
      
      {/* Messages d'alerte ou succès */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Barre d'actions supérieure */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c142b] p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Banque de questions ({questions.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gérez vos questions en mode réponse unique ou QCM. Ajoutez, modifiez ou supprimez des questions à tout moment.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter une question</span>
        </button>
      </div>

      {/* Tableau des questions */}
      <div className="bg-[#0c142b] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Chargement des questions...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-base font-medium text-slate-300">Aucune question n'est enregistrée.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cliquez sur « Ajouter une question » ci-dessus pour composer votre questionnaire de sensibilisation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">Pos.</th>
                  <th className="py-3 px-4">Énoncé</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* Position & flèches */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-cyan-400 font-bold text-xs">{idx + 1}</span>
                        <div className="flex items-center gap-0.5 mt-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, 'up')}
                            className="p-0.5 rounded text-slate-500 hover:text-cyan-400 disabled:opacity-20"
                            title="Monter"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            disabled={idx === questions.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            className="p-0.5 rounded text-slate-500 hover:text-cyan-400 disabled:opacity-20"
                            title="Descendre"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Énoncé */}
                    <td className="py-3 px-4 max-w-lg">
                      <p className="font-semibold text-white leading-snug">{q.enonce}</p>
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        q.type === 'unique'
                          ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                          : 'bg-purple-950/60 border-purple-800 text-purple-300'
                      }`}>
                        {q.type === 'unique' ? 'Unique' : 'QCM'}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(q)}
                        disabled={q.statut === 'archive'}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                          q.statut === 'actif'
                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                            : q.statut === 'inactif'
                            ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            : 'bg-rose-950/40 border-rose-900 text-rose-400'
                        }`}
                      >
                        {q.statut === 'actif' ? 'Actif' : q.statut === 'inactif' ? 'Inactif' : 'Archivé'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewQuestion(q)}
                          title="Prévisualiser"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(q)}
                          title="Modifier"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(q.id)}
                          title="Dupliquer"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {q.statut !== 'archive' && (
                          <button
                            onClick={() => handleArchive(q.id)}
                            title="Archiver"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-amber-950/60 text-slate-400 hover:text-amber-400 transition"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CRÉATION / ÉDITION DE QUESTION */}
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
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
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
                      // Ajuster pour qu'une seule proposition soit cochée
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
                  placeholder="Ex: Que devez-vous faire si vous trouvez une clé USB abandonnée dans le hall de l'entreprise ?"
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
                      {/* Bouton pour marquer comme bonne réponse */}
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

                      {/* Texte de la proposition */}
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

                      {/* Supprimer la proposition */}
                      <button
                        type="button"
                        onClick={() => handleRemoveProposition(idx)}
                        className="p-2.5 rounded-xl bg-slate-900 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition shrink-0"
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
                  placeholder="Expliquez pourquoi cette réponse est la bonne et quel comportement adopter..."
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
                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
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

      {/* MODAL DE PRÉVISUALISATION */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-cyan-900/60 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setPreviewQuestion(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-950 border border-cyan-800 text-cyan-400">
                Prévisualisation participant
              </span>
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

      {/* MODAL DE CONFIRMATION DE SUPPRESSION DÉFINITIVE */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Supprimer la question</h3>
                <p className="text-xs text-rose-300">Cette action est définitive et irréversible</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement cette question de votre banque de quiz ?
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-white block mb-1">Énoncé :</span>
              <p className="text-slate-400 italic line-clamp-3 leading-relaxed">"{questionToDelete.enonce}"</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-[0_0_15px_rgba(225,29,72,0.3)]"
              >
                {isDeleting ? <span>Suppression en cours...</span> : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer définitivement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
