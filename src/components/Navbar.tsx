import React from 'react';
import { ShieldCheck, Lock, ShieldAlert, Award } from 'lucide-react';

interface NavbarProps {
  onOpenAdmin: () => void;
  isAdminLoggedIn: boolean;
  onGoHome?: () => void;
  activeView: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAdmin, isAdminLoggedIn, onGoHome, activeView }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-950/60 bg-[#070b18]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo & Titre */}
        <div 
          onClick={onGoHome}
          className="flex items-center gap-3 cursor-pointer group transition-all"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.25)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all">
            <div className="w-full h-full bg-[#070b18] rounded-[11px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                CyberQuiz
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                RSE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Sensibilisation & Engagement Numérique</p>
          </div>
        </div>

        {/* Bouton d'accès administrateur discret */}
        <div className="flex items-center gap-3">
          {activeView === 'admin' ? (
            <button
              onClick={onGoHome}
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/50 flex items-center gap-1.5"
            >
              <span>← Retour au quiz public</span>
            </button>
          ) : null}

          <button
            onClick={onOpenAdmin}
            title="Accès administration"
            aria-label="Accès administration"
            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-medium ${
              isAdminLoggedIn
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-cyan-400 hover:border-cyan-800/60 hover:bg-slate-800/60'
            }`}
          >
            <Lock className="w-4 h-4" />
            {isAdminLoggedIn ? (
              <span className="hidden md:inline">Espace Admin</span>
            ) : null}
          </button>
        </div>

      </div>
    </header>
  );
};
