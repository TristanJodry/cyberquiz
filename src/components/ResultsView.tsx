import React, { useState, useEffect } from 'react';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Eye, 
  MessageSquareHeart, 
  HelpCircle, 
  Sparkles, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizResults } from '../types.ts';

interface ResultsViewProps {
  results: QuizResults;
  onGoToRex: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, onGoToRex }) => {
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

  useEffect(() => {
    // Si bon score (> 70%), lancer un éclat de confettis
    if (results.pourcentageReussite >= 70) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // ignore si non supporté
      }
    }
  }, [results.pourcentageReussite]);

  // Message bienveillant et valorisant adapté au score
  const getFeedbackMessage = (pct: number) => {
    if (pct >= 80) {
      return {
        titre: 'Félicitations pour votre vigilance !',
        texte: 'Vous maîtrisez parfaitement les règles essentielles de sécurité numérique. Vous êtes un véritable ambassadeur de la cyber-résilience au sein de votre collectif.'
      };
    } else if (pct >= 50) {
      return {
        titre: 'Bonne implication citoyenne !',
        texte: 'Vous avez de solides réflexes, mais certains pièges méritent une attention particulière. N’hésitez pas à consulter le détail de vos réponses pour ancrer les bonnes pratiques.'
      };
    } else {
      return {
        titre: 'Un pas important vers une meilleure protection !',
        texte: 'La cybersécurité est un apprentissage continu. Chaque erreur identifiée aujourd’hui vous permettra d’éviter les pièges dans votre quotidien professionnel et personnel.'
      };
    }
  };

  const feedback = getFeedbackMessage(results.pourcentageReussite);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
      
      {/* Carte principale de synthèse */}
      <div className="bg-[#0c142b] border border-cyan-900/50 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl w-full text-center relative overflow-hidden">
        
        {/* Glow de fond */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Badge / Icône de résultat */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[2px] shadow-[0_0_25px_rgba(6,182,212,0.3)] mb-6">
          <div className="w-full h-full bg-[#070b18] rounded-[14px] flex items-center justify-center">
            <Award className="w-10 h-10 text-cyan-400" />
          </div>
        </div>

        {/* Titre & Pourcentage */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          Synthèse de votre participation
        </h1>
        <p className="text-sm sm:text-base text-slate-300 font-medium mb-6">
          Votre résultat : <span className="font-bold text-cyan-300">{results.scoreFinal} / {results.totalQuestions}</span> — <span className="text-emerald-400 font-bold">{results.pourcentageReussite}% de réussite</span>
        </p>

        {/* Graphique de jauge circulaire / barre visuelle */}
        <div className="max-w-md mx-auto mb-8 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
          <div className="flex justify-between items-center text-xs font-semibold mb-2">
            <span className="text-slate-400">Score global</span>
            <span className="text-cyan-400 font-mono text-sm">{results.scoreFinal} pt{results.scoreFinal > 1 ? 's' : ''}</span>
          </div>

          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              style={{ width: `${Math.max(results.pourcentageReussite, 4)}%` }}
            />
          </div>

          {/* Grille de stats secondaires */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{results.bonnesReponses} bonne{results.bonnesReponses > 1 ? 's' : ''} réponse{results.bonnesReponses > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span>{results.mauvaisesReponses} mauvaise{results.mauvaisesReponses > 1 ? 's' : ''} réponse{results.mauvaisesReponses > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Message encourageant */}
        <div className="p-5 rounded-2xl bg-cyan-950/30 border border-cyan-900/40 text-left mb-8 max-w-lg mx-auto">
          <h3 className="text-sm font-bold text-cyan-300 mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>{feedback.titre}</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            {feedback.texte}
          </p>
        </div>

        {/* Actions principales */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-lg mx-auto">
          <button
            onClick={() => setShowReviewModal(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-slate-400" />
            <span>Revoir mes réponses</span>
          </button>

          <button
            onClick={onGoToRex}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <span>Donner mon avis (REX)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Modal de relecture complète des réponses */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-cyan-900/60 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header du modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Revue complète de vos réponses (Lecture seule)</h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Corps défilable */}
            <div className="p-6 overflow-y-auto space-y-6 text-left">
              {results.questions.map((q) => {
                const rep = q.reponseUtilisateur;
                const isCorrect = rep ? rep.est_correct : false;

                return (
                  <div key={q.numero} className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                          Question {q.numero} ({q.type === 'unique' ? 'Réponse unique' : 'Choix multiple'})
                        </span>
                        <h4 className="text-base font-semibold text-white mt-1">
                          {q.enonce}
                        </h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 border ${
                        isCorrect
                          ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                          : 'bg-rose-950/60 border-rose-700 text-rose-300'
                      }`}>
                        {isCorrect ? '+1 point' : '0 point'}
                      </span>
                    </div>

                    {/* Liste des propositions avec état */}
                    <div className="space-y-2">
                      {q.propositions.map((prop, idx) => {
                        const wasSelected = rep?.selectedIds.includes(prop.id);
                        const isGood = prop.est_correcte;

                        let style = 'bg-slate-950/40 border-slate-800/60 text-slate-400';
                        if (wasSelected && isGood) {
                          style = 'bg-emerald-950/50 border-emerald-600 text-emerald-200';
                        } else if (wasSelected && !isGood) {
                          style = 'bg-rose-950/50 border-rose-600 text-rose-200';
                        } else if (!wasSelected && isGood) {
                          style = 'bg-emerald-950/20 border-dashed border-emerald-600/80 text-emerald-300';
                        }

                        return (
                          <div key={prop.id} className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-3 ${style}`}>
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{prop.texte}</span>
                            </div>

                            <div className="text-xs font-semibold shrink-0">
                              {wasSelected && isGood && <span className="text-emerald-400 font-bold">Votre choix ✓</span>}
                              {wasSelected && !isGood && <span className="text-rose-400 font-bold">Votre choix ✗</span>}
                              {!wasSelected && isGood && <span className="text-emerald-400/90 italic">Bonne réponse oubliée</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explication */}
                    {q.explication && (
                      <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-900/40 text-xs text-slate-300 leading-relaxed">
                        <span className="font-bold text-cyan-400 block mb-1">Explication :</span>
                        {q.explication}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pied du modal */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
              >
                Fermer la relecture
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
