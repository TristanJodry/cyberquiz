import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  HelpCircle, 
  Lightbulb, 
  Info, 
  ShieldQuestion, 
  Check,
  AlertCircle
} from 'lucide-react';
import { QuestionClient, SubmitAnswerResult } from '../types.ts';

interface QuizViewProps {
  question: QuestionClient;
  onSubmitAnswer: (selectedIds: string[]) => Promise<SubmitAnswerResult | null>;
  onNextQuestion: () => void;
  onFinishQuiz: () => void;
  isSubmitting: boolean;
  scoreActuel: number;
}

export const QuizView: React.FC<QuizViewProps> = ({
  question,
  onSubmitAnswer,
  onNextQuestion,
  onFinishQuiz,
  isSubmitting,
  scoreActuel
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<SubmitAnswerResult | null>(null);

  // Synchroniser l'état local si la question a déjà été répondue (ex: reprise de session)
  useEffect(() => {
    if (question.isAnswered && question.reponse) {
      setSelectedIds(question.reponse.selectedIds);
      setValidationResult({
        success: true,
        est_correct: question.reponse.est_correct,
        points: question.reponse.points,
        bonnes_reponses_ids: question.propositions.filter(p => p.est_correcte).map(p => p.id),
        explication: question.reponse.explication,
        est_derniere_question: question.index === question.totalQuestions,
        score_actuel: scoreActuel
      });
    } else {
      setSelectedIds([]);
      setValidationResult(null);
    }
  }, [question.index, question.isAnswered]);

  const hasValidated = !!validationResult || question.isAnswered;

  // Gestion du clic sur une proposition
  const handleSelectProposition = async (propId: string) => {
    if (hasValidated || isSubmitting) return;

    if (question.type === 'unique') {
      // Pour une réponse unique : sélection et soumission instantanée
      setSelectedIds([propId]);
      const res = await onSubmitAnswer([propId]);
      if (res) {
        setValidationResult(res);
      }
    } else {
      // Pour un QCM à choix multiple : bascule libre de sélection
      setSelectedIds(prev => 
        prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
      );
    }
  };

  // Soumission manuelle pour le QCM
  const handleValidateMultiple = async () => {
    if (hasValidated || isSubmitting || selectedIds.length === 0) return;
    const res = await onSubmitAnswer(selectedIds);
    if (res) {
      setValidationResult(res);
    }
  };

  // Calcul du pourcentage de progression : incrémenté uniquement dès que la question est faite
  // (ex: question 10/10 à 90% avant réponse, puis 100% dès qu'on a répondu)
  const questionsCompleted = hasValidated ? question.index : question.index - 1;
  const progressPct = Math.min(100, Math.max(0, Math.round((questionsCompleted / question.totalQuestions) * 100)));

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-start py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      
      {/* Barre de progression & Compteur */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-800/50 text-cyan-400 font-mono">
              Question {question.index} / {question.totalQuestions}
            </span>
            <span className="text-slate-400 text-xs hidden sm:inline">
              {question.type === 'unique' ? '— Réponse unique' : '— Choix multiple'}
            </span>
          </div>
          <span className="text-slate-400 font-mono text-xs">{progressPct}% complété</span>
        </div>

        {/* Barre animée */}
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Carte principale de la question */}
      <div className="bg-[#0c142b] border border-cyan-900/40 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md relative overflow-hidden transition-all">
        
        {/* En-tête de question */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-cyan-300 mb-3">
            <ShieldQuestion className="w-4 h-4 text-cyan-400" />
            <span>
              {question.type === 'unique' 
                ? 'Une seule réponse possible' 
                : 'Plusieurs réponses possibles'}
            </span>
          </div>

          <h2 className="text-lg sm:text-2xl font-bold text-white leading-snug">
            {question.enonce}
          </h2>
        </div>

        {/* Propositions interactives */}
        <div className="space-y-3 mb-6">
          {question.propositions.map((prop, idx) => {
            const isSelected = selectedIds.includes(prop.id);
            const isCorrectAnswer = validationResult?.bonnes_reponses_ids.includes(prop.id) ?? prop.est_correcte;

            // Styles dynamiques après validation
            let cardStyle = 'bg-slate-900/70 border-slate-800 text-slate-200 hover:border-cyan-700/60 hover:bg-slate-800/60 cursor-pointer';
            let indicator = null;

            if (hasValidated) {
              if (isSelected && isCorrectAnswer) {
                // Bonne réponse sélectionnée
                cardStyle = 'bg-emerald-950/50 border-emerald-500 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
                indicator = (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bonne réponse
                  </span>
                );
              } else if (isSelected && !isCorrectAnswer) {
                // Mauvaise réponse sélectionnée
                cardStyle = 'bg-rose-950/50 border-rose-500 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.2)]';
                indicator = (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-700">
                    <XCircle className="w-3.5 h-3.5" /> Réponse incorrecte
                  </span>
                );
              } else if (!isSelected && isCorrectAnswer) {
                // Bonne réponse oubliée (non cochée)
                cardStyle = 'bg-emerald-950/20 border-emerald-600/80 border-dashed text-emerald-200';
                indicator = (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                    <Check className="w-3.5 h-3.5" /> Bonne réponse non cochée
                  </span>
                );
              } else {
                // Mauvaise réponse non sélectionnée (neutre)
                cardStyle = 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60';
              }
            } else if (isSelected) {
              // En cours de sélection (avant validation)
              cardStyle = 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]';
            }

            return (
              <div
                key={prop.id}
                onClick={() => handleSelectProposition(prop.id)}
                className={`p-4 rounded-xl border transition-all duration-200 flex items-start justify-between gap-4 select-none ${cardStyle}`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Badge lettre / checkbox */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                    isSelected 
                      ? 'bg-cyan-500 text-slate-950 font-extrabold'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  
                  <span className="text-sm sm:text-base font-medium leading-relaxed">
                    {prop.texte}
                  </span>
                </div>

                {indicator && <div className="shrink-0 mt-0.5">{indicator}</div>}
              </div>
            );
          })}
        </div>

        {/* Bouton de validation pour QCM (Type B) */}
        {!hasValidated && question.type === 'multiple' && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleValidateMultiple}
              disabled={selectedIds.length === 0 || isSubmitting}
              className="py-3 px-6 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>Valider ma réponse</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section explications pédagogiques après validation */}
        {hasValidated && validationResult && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
            
            {/* Bannière de verdict */}
            <div className={`p-4 rounded-xl border flex items-center justify-between mb-4 ${
              validationResult.est_correct
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
            }`}>
              <div className="flex items-center gap-3">
                {validationResult.est_correct ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm sm:text-base">
                    {validationResult.est_correct ? 'Excellente réponse ! (+1 pt)' : 'Réponse incorrecte (0 pt)'}
                  </h4>
                  <p className="text-xs opacity-90">
                    {validationResult.est_correct 
                      ? 'Vos connaissances sur ce sujet sont bien assimilées.' 
                      : 'Prenez le temps de lire l’explication ci-dessous pour adopter le bon réflexe.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Encadré d'explication pédagogique */}
            {validationResult.explication && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-900/50 space-y-2 mb-6">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4 text-cyan-400" />
                  <span>Explication pédagogique</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                  {validationResult.explication}
                </p>
              </div>
            )}

            {/* Bouton de passage à la question suivante */}
            <div className="flex justify-end">
              {validationResult.est_derniere_question ? (
                <button
                  onClick={onFinishQuiz}
                  className="py-3 px-7 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Consulter mes résultats finaux</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={onNextQuestion}
                  className="py-3 px-6 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Question suivante</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
