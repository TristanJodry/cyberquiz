import React, { useState } from 'react';
import { Star, MessageSquareHeart, CheckCircle, ArrowRight, ShieldCheck, Sparkles, Home } from 'lucide-react';

interface RexViewProps {
  onSubmitRex: (
    note: number, 
    commentaire: string, 
    apprisQuelqueChose: boolean | null, 
    apprisCommentaire: string
  ) => Promise<boolean>;
  isSubmitting: boolean;
  onGoHome: () => void;
}

export const RexView: React.FC<RexViewProps> = ({ onSubmitRex, isSubmitting, onGoHome }) => {
  const [note, setNote] = useState<number>(0);
  const [hoveredNote, setHoveredNote] = useState<number>(0);
  const [commentaire, setCommentaire] = useState<string>('');
  const [apprisQuelqueChose, setApprisQuelqueChose] = useState<boolean | null>(null);
  const [apprisCommentaire, setApprisCommentaire] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const starLabels: Record<number, string> = {
    1: 'Très insatisfaisant',
    2: 'Peu satisfaisant',
    3: 'Moyen',
    4: 'Satisfaisant',
    5: 'Très satisfaisant'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (note < 1 || note > 5) {
      setError('Veuillez sélectionner une note de 1 à 5 étoiles.');
      return;
    }

    const success = await onSubmitRex(note, commentaire, apprisQuelqueChose, apprisCommentaire);
    if (success) {
      setIsSuccess(true);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto w-full text-center">
        <div className="bg-[#0c142b] border border-emerald-800/60 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
          
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <CheckCircle className="w-9 h-9" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Merci pour votre participation !
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
            Votre implication contribue à renforcer notre culture collective de cybersécurité et l’efficacité de nos actions d’engagement citoyen.
          </p>

          <button
            onClick={onGoHome}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 text-sm mx-auto cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Retourner à l’accueil</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto w-full">
      <div className="bg-[#0c142b] border border-cyan-900/50 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl w-full">
        
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-800/40 text-cyan-300 text-xs font-semibold mb-3">
            <MessageSquareHeart className="w-3.5 h-3.5 text-cyan-400" />
            <span>Étape obligatoire pour finaliser</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Votre avis nous intéresse
          </h1>
          <p className="text-sm text-slate-300">
            Aidez-nous à améliorer nos prochaines actions de sensibilisation.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Note de satisfaction 1 à 5 étoiles */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 text-center space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Note globale de satisfaction <span className="text-cyan-400">*</span>
            </label>

            <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = (hoveredNote || note) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNote(star)}
                    onMouseEnter={() => setHoveredNote(star)}
                    onMouseLeave={() => setHoveredNote(0)}
                    className="p-1 rounded-lg transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        isActive
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-semibold text-cyan-400 h-4">
              {starLabels[hoveredNote || note] || 'Cliquez sur une étoile pour noter'}
            </p>
          </div>

          {/* Application concrète au travail */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-left">
            <label className="block text-xs font-bold text-slate-200 leading-snug">
              Ce quiz vous a-t-il appris quelque chose que vous pourrez appliquer au travail ?
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setApprisQuelqueChose(true)}
                className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  apprisQuelqueChose === true
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-950/60 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <span>Oui</span>
              </button>

              <button
                type="button"
                onClick={() => setApprisQuelqueChose(false)}
                className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  apprisQuelqueChose === false
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-950/60 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <span>Non</span>
              </button>
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Si oui, que pourrez-vous appliquer concrètement ? <span className="text-slate-500 font-normal">(facultatif)</span>
              </label>
              <input
                type="text"
                value={apprisCommentaire}
                onChange={(e) => setApprisCommentaire(e.target.value)}
                placeholder="Ex: Vérifier l'expéditeur d'un e-mail, signaler les messages suspects..."
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Commentaire libre */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Commentaire ou suggestions d'amélioration <span className="text-slate-500 font-normal lowercase">(facultatif)</span>
            </label>
            <textarea
              rows={4}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Que pensez-vous de la clarté des questions ? Avez-vous appris de nouveaux réflexes ? Quelles thématiques souhaiteriez-vous aborder ?"
              className="w-full p-4 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition resize-none leading-relaxed"
            />
          </div>

          {/* Bouton de validation */}
          <button
            type="submit"
            disabled={isSubmitting || note === 0}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <span>Enregistrement du REX...</span>
            ) : (
              <>
                <span>Envoyer mon retour d'expérience</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};
