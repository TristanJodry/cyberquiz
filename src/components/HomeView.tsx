import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  EyeOff, 
  Building, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Info, 
  LockKeyhole, 
  Sparkles, 
  Clock, 
  CheckCircle2,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { PublicConfig } from '../types.ts';
import { checkParticipationRestriction } from '../utils/restriction.ts';

interface HomeViewProps {
  config: PublicConfig | null;
  onStartQuiz: (data: { anonyme: boolean; nom?: string; prenom?: string; entreprise?: string }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onResumeSession?: () => void;
  hasActiveSession?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({ 
  config, 
  onStartQuiz, 
  isLoading, 
  error,
  onResumeSession,
  hasActiveSession 
}) => {
  const [anonyme, setAnonyme] = useState<boolean>(false);
  const [nom, setNom] = useState<string>('');
  const [prenom, setPrenom] = useState<string>('');
  const [entreprise, setEntreprise] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!anonyme) {
      if (!nom.trim() || !prenom.trim() || !entreprise.trim()) {
        setFormError('Veuillez renseigner votre Nom, Prénom et Entreprise, ou cocher la case pour participer anonymement.');
        return;
      }
    }

    await onStartQuiz({
      anonyme,
      nom: anonyme ? undefined : nom.trim(),
      prenom: anonyme ? undefined : prenom.trim(),
      entreprise: anonyme ? undefined : entreprise.trim(),
    });
  };

  const isQuizInactive = config && !config.quiz_actif;
  const restriction = checkParticipationRestriction(config);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Glow d'arrière-plan cyber */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        
        {/* En-tête de bienvenue */}
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-800/50 text-cyan-300 text-xs font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Démarche RSE & Citoyenneté Numérique</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 text-xs font-medium shadow-sm">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Temps estimé : {config?.temps_estime || '5 minutes'}</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            {config?.titre || 'Tous acteurs de notre cybersécurité'}
          </h1>
          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            {config?.sous_titre || 'Testez vos connaissances et contribuez à une culture numérique plus responsable.'}
          </p>
        </div>

        {/* Message d'indisponibilité si le quiz est désactivé */}
        {isQuizInactive ? (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-6 text-center shadow-xl backdrop-blur-md">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-amber-200 mb-2">Quiz momentanément indisponible</h2>
            <p className="text-slate-300 text-sm mb-3">
              Le quiz est actuellement indisponible. Merci de revenir ultérieurement.
            </p>
            {config?.contact_dpo && (
              <p className="text-xs text-slate-400">
                Contact Responsable / DPO : <span className="text-cyan-400 font-medium">{config.contact_dpo}</span>
              </p>
            )}
          </div>
        ) : restriction.isRestricted ? (
          /* Écran de remerciement et d'indication de participation déjà effectuée */
          <div className="bg-[#0c142b]/95 border border-cyan-800/60 rounded-3xl p-6 sm:p-9 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-xl text-center space-y-6 animate-in fade-in duration-300">
            
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Participation déjà enregistrée</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Merci pour votre contribution !
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg mx-auto">
                Vous avez déjà complété ce quiz de sensibilisation et transmis votre retour d'expérience. Vos réponses ont bien été prises en compte dans le cadre de notre démarche d'engagement citoyen et de cybersécurité.
              </p>
            </div>

            {/* Reprise de session si une session interrompue est détectée */}
            {hasActiveSession && onResumeSession && (
              <div className="p-3.5 rounded-xl bg-cyan-950/50 border border-cyan-700/60 flex items-center justify-between gap-3 text-left">
                <div className="text-xs text-cyan-200">
                  <span className="font-bold block">Session en cours détectée</span>
                  <span className="text-cyan-400/90 text-[11px]">Vous pouvez reprendre votre session là où vous vous étiez arrêté.</span>
                </div>
                <button
                  type="button"
                  onClick={onResumeSession}
                  className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition cursor-pointer shrink-0"
                >
                  Reprendre
                </button>
              </div>
            )}

            {/* Pied de carte avec lien RGPD & contact DPO */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-2"
              >
                <LockKeyhole className="w-3.5 h-3.5" />
                <span>Politique de confidentialité & conservation</span>
              </button>

              {config?.contact_dpo && (
                <span className="text-slate-400">
                  DPO : <span className="text-slate-300 font-medium">{config.contact_dpo}</span>
                </span>
              )}
            </div>

          </div>
        ) : (
          /* Formulaire de participation */
          <div className="bg-[#0c142b]/95 border border-cyan-900/40 rounded-2xl p-6 sm:p-8 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all">
            
            {(error || formError) && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>{formError || error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Option Participation Anonyme */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-800/50 transition-colors">
                <label className="flex items-start gap-3.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={anonyme}
                    onChange={(e) => {
                      setAnonyme(e.target.checked);
                      if (e.target.checked) setFormError(null);
                    }}
                    className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 transition cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm sm:text-base">
                        Participer anonymement
                      </span>
                      <EyeOff className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Si vous cochez cette option, aucun nom, prénom ou entreprise ne sera collecté. Vos réponses seront enregistrées sous la mention « Anonyme ».
                    </p>
                  </div>
                </label>
              </div>

              {/* Champs nominatifs (masqués si anonyme) */}
              {!anonyme ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Prénom <span className="text-cyan-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required={!anonyme}
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          placeholder="Ex: Sophie"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Nom <span className="text-cyan-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required={!anonyme}
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          placeholder="Ex: Martin"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Entreprise / Organisation <span className="text-cyan-400">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required={!anonyme}
                        value={entreprise}
                        onChange={(e) => setEntreprise(e.target.value)}
                        placeholder="Ex: TechCorp Solutions"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Champ texte libre (société, filiale ou département)</p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-xs flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>Mode anonyme activé : vous participez sans transmettre vos coordonnées.</span>
                </div>
              )}

              {/* Bouton d'action principal */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-teal-300 hover:from-cyan-300 hover:to-teal-200 active:scale-[0.99] transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>Initialisation du quiz...</span>
                ) : (
                  <>
                    <span>Commencer le quiz</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Information de confidentialité */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-xs text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-2"
                >
                  <LockKeyhole className="w-3.5 h-3.5" />
                  <span>Politique de confidentialité & conservation des données</span>
                </button>
              </div>

            </form>
          </div>
        )}

      </div>

      {/* Modal d'information sur la confidentialité */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0d162d] border border-cyan-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
                <ShieldCheck className="w-5 h-5" />
                <span>Confidentialité & Démarche de sensibilisation</span>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="text-sm text-slate-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                {config?.politique_confidentialite ||
                  'Les résultats sont collectés dans le cadre d’une démarche d’engagement RSE visant à renforcer la culture de sécurité numérique en entreprise.'}
              </p>
              
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold">Finalité du traitement :</span>
                  <p className="text-slate-200">Évaluation anonymisée ou nominative de l’impact des actions de sensibilisation à la cybersécurité.</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">Durée de conservation :</span>
                  <p className="text-slate-200">{config?.duree_conservation || '12 mois'}</p>
                </div>
                {config?.contact_dpo && (
                  <div>
                    <span className="text-slate-400 font-semibold">Contact responsable / DPO :</span>
                    <p className="text-cyan-400">{config.contact_dpo}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Vous pouvez à tout moment choisir l’option « Participer anonymement » afin qu’aucune donnée nominative ne soit enregistrée dans la base de données.
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
