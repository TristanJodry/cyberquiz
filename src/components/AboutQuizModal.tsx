import React, { useState } from 'react';
import { HelpCircle, X, ShieldCheck, GraduationCap, Sparkles } from 'lucide-react';

export const AboutQuizModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Bouton flottant en bas à droite */}
      <div className="fixed bottom-5 right-5 z-40 group">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="En savoir plus sur ce quiz"
          title="En savoir plus sur ce quiz"
          className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-400 text-slate-950 font-bold flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-cyan-300/40"
        >
          <HelpCircle className="w-6 h-6 text-slate-950" />
        </button>

        {/* Infobulle au survol */}
        <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-cyan-800/80 text-cyan-300 text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
          En savoir plus sur ce quiz
        </div>
      </div>

      {/* Modale d'information */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-cyan-900/60 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Bouton fermeture */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* En-tête */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-950/80 border border-cyan-800 text-cyan-400">
                    Mastère MICSI • CESI
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Projet RSE
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  En savoir plus sur ce quiz
                </h3>
              </div>
            </div>

            {/* Contenu textuel officiel */}
            <div className="text-slate-300 text-xs sm:text-sm leading-relaxed space-y-3.5 bg-slate-950/70 p-4 sm:p-5 rounded-2xl border border-slate-800">
              <p>
                Ce quiz a été réalisé dans le cadre de mon projet d'engagement citoyen et de Responsabilité Sociétale des Entreprises (RSE), au cours de mon Mastère Manager en Infrastructures et Cybersécurité des Systèmes d'Information (MICSI) au CESI.
              </p>
              <p>
                Son objectif est de sensibiliser les collaborateurs aux enjeux de la cybersécurité, de rappeler que chacun joue un rôle dans la protection de l'entreprise et de promouvoir une culture numérique responsable et collective.
              </p>
              <p>
                Vos réponses et retours d'expérience permettront également de mesurer l'impact de cette initiative et d'identifier des pistes d'amélioration pour les futures actions de sensibilisation.
              </p>
            </div>

            {/* Pied de modale */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Culture numérique responsable</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition text-xs cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
