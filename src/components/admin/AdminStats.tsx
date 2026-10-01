import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Building2, 
  Users, 
  Calendar, 
  CheckCircle, 
  Award,
  Sparkles,
  PieChart
} from 'lucide-react';
import { StatsResponse } from '../../types.ts';

interface AdminStatsProps {
  token: string;
}

export const AdminStats: React.FC<AdminStatsProps> = ({ token }) => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [periode, setPeriode] = useState<string>('all'); // 'all', 'today', '7d', '30d'
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/statistiques?periode=${periode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Erreur chargement stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [periode]);

  if (isLoading || !stats) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        Calcul des statistiques RSE en cours...
      </div>
    );
  }

  const totalDistribution = Object.values(stats.distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      
      {/* En-tête et sélecteur de période */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c142b] p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span>Statistiques avancées & Métriques RSE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyse comparative de l'impact pédagogique et diagnostic des vulnérabilités comportementales.
          </p>
        </div>

        {/* Filtre temporel */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1" />
          {[
            { id: 'all', label: 'Tout' },
            { id: '30d', label: '30 jours' },
            { id: '7d', label: '7 jours' },
            { id: 'today', label: 'Aujourd’hui' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                periode === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1 : Distribution des notes et Évolution temporelle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Distribution des notes */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">Distribution des résultats (%)</h3>
            </div>
            <span className="text-xs text-slate-400">{totalDistribution} sessions analysées</span>
          </div>

          <div className="space-y-3 pt-2">
            {Object.entries(stats.distribution).map(([range, count]) => {
              const pct = totalDistribution > 0 ? Math.round((count / totalDistribution) * 100) : 0;
              let barColor = 'from-cyan-500 to-blue-500';
              if (range === '81-100%') barColor = 'from-emerald-400 to-teal-400';
              if (range === '0-20%') barColor = 'from-rose-500 to-amber-500';

              return (
                <div key={range} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">{range}</span>
                    <span className="text-slate-400 font-mono">{count} participants ({pct}%)</span>
                  </div>
                  <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Évolution temporelle */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Évolution des participations par jour</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Volume journalier</span>
          </div>

          {stats.timeline.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Aucune participation sur la période sélectionnée.
            </div>
          ) : (
            <div className="space-y-2 pt-2 max-h-56 overflow-y-auto pr-1">
              {stats.timeline.map((item) => (
                <div key={item.jour} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="font-mono text-cyan-300 font-semibold">{item.jour}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">{item.count} quiz</span>
                    <span className="text-emerald-400 font-mono">
                      {item.avg_pct !== null ? `${Math.round(item.avg_pct)}% moy.` : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Section 2 : Top 5 des questions les plus échouées (Diagnostic RSE) */}
      <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="font-bold text-white text-sm">
              Questions générant le plus d'erreurs (Points de vigilance prioritaires)
            </h3>
            <p className="text-xs text-slate-400">
              Ces questions révèlent les concepts de cybersécurité à approfondir lors des futures campagnes.
            </p>
          </div>
        </div>

        {stats.questionsDifficiles.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Pas encore assez de réponses pour établir le classement des questions difficiles.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {stats.questionsDifficiles.map((q, idx) => (
              <div key={q.questionId} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                    #{idx + 1}
                  </span>
                  <p className="text-xs font-semibold text-slate-200 line-clamp-2 flex-1">
                    {q.enonce}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400">{q.wrong} erreur{q.wrong > 1 ? 's' : ''} sur {q.total} réponses</span>
                  <span className="font-bold text-rose-400 font-mono">{q.tauxReussite}% réussite</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3 : Statistiques comparatives par Entreprise */}
      <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-sm">
                Comparatif par entreprise & entité
              </h3>
              <p className="text-xs text-slate-400">
                Les participations anonymes sont isolées dans une catégorie dédiée sans attribution arbitraire.
              </p>
            </div>
          </div>
        </div>

        {stats.companyStats.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Aucune donnée d'entreprise disponible sur cette période.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-3">Organisation / Entité</th>
                  <th className="py-2.5 px-3 text-center">Participations</th>
                  <th className="py-2.5 px-3 text-center">Score moyen</th>
                  <th className="py-2.5 px-3 text-center">Taux de réussite</th>
                  <th className="py-2.5 px-3 text-center">Satisfaction REX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {stats.companyStats.map((c) => (
                  <tr key={c.entreprise} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-semibold text-white">
                      {c.isAnonyme ? (
                        <span className="text-cyan-400 flex items-center gap-1.5 font-bold">
                          <span>🔒 Participations anonymes</span>
                        </span>
                      ) : (
                        <span>{c.entreprise}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                      {c.nbParticipations}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-cyan-300">
                      {c.scoreMoyen} pts
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        c.tauxReussite >= 75
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}>
                        {c.tauxReussite}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-amber-400">
                      {c.satisfactionMoyenne ? `${c.satisfactionMoyenne} / 5 ★` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
