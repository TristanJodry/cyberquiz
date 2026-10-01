import React, { useEffect, useState } from 'react';
import { 
  Users, 
  CheckCircle, 
  HelpCircle, 
  Star, 
  TrendingUp, 
  Award, 
  MessageSquare, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight,
  Plus
} from 'lucide-react';
import { DashboardKPIs } from '../../types.ts';

interface AdminOverviewProps {
  token: string;
  onNavigateTab: (tabId: string) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ token, onNavigateTab }) => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKpis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard-kpis', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
      }
    } catch (e) {
      console.error('Erreur chargement KPIs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        Chargement des indicateurs en temps réel...
      </div>
    );
  }

  const k = kpis || {
    totalParticipations: 0,
    participationsAnonymes: 0,
    participationsIdentifiees: 0,
    questionnairesTermines: 0,
    rexRecus: 0,
    scoreMoyen: 0,
    tauxReussiteMoyen: 0,
    noteSatisfactionMoyenne: 0
  };

  return (
    <div className="space-y-8">
      
      {/* En-tête de bienvenue RSE */}
      <div className="bg-gradient-to-r from-[#0c142b] via-[#0d1b3d] to-[#0a1b30] border border-cyan-900/50 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Tableau de bord RSE & Sensibilisation Cybersécurité</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            Suivi des performances et impact pédagogique
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl">
            Toutes les données ci-dessous proviennent directement de votre base SQL persistante. Elles mesurent le niveau d’adoption des bonnes pratiques et l’engagement des collaborateurs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigateTab('questions')}
            className="px-4 py-2.5 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center gap-2 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une question</span>
          </button>
          <button
            onClick={() => onNavigateTab('participations')}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition"
          >
            <span>Voir les participations</span>
          </button>
        </div>
      </div>

      {/* Grille des 8 indicateurs clés (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 : Total participations */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total participations</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">{k.totalParticipations}</span>
            <span className="text-xs text-slate-500">sessions créées</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Identifiées : <strong className="text-slate-200">{k.participationsIdentifiees}</strong></span>
            <span>Anonymes : <strong className="text-cyan-400">{k.participationsAnonymes}</strong></span>
          </div>
        </div>

        {/* KPI 2 : Questionnaires terminés */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Quiz finalisés</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">{k.questionnairesTermines}</span>
            <span className="text-xs text-slate-500">
              ({k.totalParticipations > 0 ? Math.round((k.questionnairesTermines / k.totalParticipations) * 100) : 0}% complétion)
            </span>
          </div>
          <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2">
            En cours / abandonnés : <strong className="text-amber-400">{k.totalParticipations - k.questionnairesTermines}</strong>
          </div>
        </div>

        {/* KPI 3 : Taux de réussite moyen */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Taux de réussite moyen</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-cyan-400 font-mono">{k.tauxReussiteMoyen}%</span>
            <span className="text-xs text-slate-500">moyenne globale</span>
          </div>
          <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2">
            Score moyen : <strong className="text-slate-200">{k.scoreMoyen} points</strong>
          </div>
        </div>

        {/* KPI 4 : Satisfaction moyenne (REX) */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Satisfaction globale (REX)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400 font-mono">{k.noteSatisfactionMoyenne}</span>
            <span className="text-slate-400 text-sm">/ 5</span>
          </div>
          <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2">
            Retours d'expérience : <strong className="text-slate-200">{k.rexRecus}</strong> reçus
          </div>
        </div>

      </div>

      {/* Raccourcis et statut du questionnaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div 
          onClick={() => onNavigateTab('questions')}
          className="p-6 rounded-2xl bg-[#0c142b] border border-slate-800 hover:border-cyan-700/60 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base group-hover:text-cyan-300 transition-colors">
            Gestion du questionnaire
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Créez des questions (choix unique ou QCM multiple), ordonnez-les et prévisualisez le rendu sans jamais modifier l’historique passé.
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 pt-1">
            <span>Accéder aux questions</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div 
          onClick={() => onNavigateTab('statistiques')}
          className="p-6 rounded-2xl bg-[#0c142b] border border-slate-800 hover:border-cyan-700/60 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800/50 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors">
            Statistiques & Analyse RSE
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Consultez les graphiques d’évolution temporelle, la ventilation par entreprise et identifiez les questions nécessitant des piqûres de rappel.
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 pt-1">
            <span>Voir les graphiques</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div 
          onClick={() => onNavigateTab('rex')}
          className="p-6 rounded-2xl bg-[#0c142b] border border-slate-800 hover:border-cyan-700/60 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800/50 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
            Retours d'expérience (REX)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Lisez les avis des collaborateurs, les notes attribuées et exportez l'ensemble en CSV ou Excel pour vos bilans de gouvernance.
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 pt-1">
            <span>Consulter les avis</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

      </div>

    </div>
  );
};
