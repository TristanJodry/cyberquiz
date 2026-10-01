import React, { useState, useEffect } from 'react';
import { 
  Star, 
  MessageSquare, 
  Download, 
  Search, 
  Filter, 
  Users, 
  Award,
  Sparkles,
  Calendar
} from 'lucide-react';

interface RexItem {
  id: string;
  participationId: string;
  date: string;
  nom: string;
  prenom: string;
  entreprise: string;
  anonyme: boolean;
  note: number;
  commentaire: string;
  apprisQuelqueChose?: string | null;
  apprisCommentaire?: string | null;
  scoreQuiz: string;
}

interface AdminRexProps {
  token: string;
}

export const AdminRex: React.FC<AdminRexProps> = ({ token }) => {
  const [retours, setRetours] = useState<RexItem[]>([]);
  const [total, setTotal] = useState(0);
  const [noteMoyenne, setNoteMoyenne] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [filterNote, setFilterNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchRex = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterNote) params.append('note', filterNote);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/admin/retours-experience?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRetours(data.retours);
        setTotal(data.total);
        setNoteMoyenne(data.noteMoyenne);
        setDistribution(data.distribution);
      }
    } catch (e) {
      console.error('Erreur chargement REX:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRex();
  }, [filterNote]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRex();
  };

  const handleExportCsv = () => {
    window.location.href = '/api/admin/export/rex.csv';
  };

  return (
    <div className="space-y-6">
      
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c142b] p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <span>Retours d'expérience des collaborateurs (REX)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Évaluation qualitative et suggestions pour adapter vos plans d'action de sensibilisation.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Exporter les REX (CSV)</span>
        </button>
      </div>

      {/* Cartes résumé de satisfaction */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Note moyenne */}
        <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Note globale de satisfaction</span>
          <div className="flex items-center gap-2">
            <span className="text-4xl font-extrabold text-amber-400 font-mono">{noteMoyenne}</span>
            <span className="text-slate-500 text-lg">/ 5</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(noteMoyenne)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-700'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500 pt-1">{total} avis enregistrés</span>
        </div>

        {/* Répartition par étoiles */}
        <div className="md:col-span-2 bg-[#0c142b] border border-slate-800 rounded-2xl p-6 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Ventilation des notes (1 à 5 étoiles)
          </h3>
          {[5, 4, 3, 2, 1].map((s) => {
            const count = distribution[s] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-slate-400 font-semibold flex items-center gap-1">
                  {s} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-slate-400">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>

      </div>

      {/* Barre de filtres */}
      <div className="bg-[#0c142b] p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher dans les commentaires ou entreprises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </form>

        <select
          value={filterNote}
          onChange={(e) => setFilterNote(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
        >
          <option value="">Toutes les notes</option>
          <option value="5">5 étoiles ★★★★★</option>
          <option value="4">4 étoiles ★★★★☆</option>
          <option value="3">3 étoiles ★★★☆☆</option>
          <option value="2">2 étoiles ★★☆☆☆</option>
          <option value="1">1 étoile ★☆☆☆☆</option>
        </select>

        <button
          onClick={fetchRex}
          className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl text-xs font-semibold transition"
        >
          Filtrer
        </button>
      </div>

      {/* Liste des avis */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Chargement des avis...</div>
        ) : retours.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-[#0c142b] rounded-2xl border border-slate-800 text-xs">
            Aucun retour d'expérience correspondant.
          </div>
        ) : (
          retours.map((r) => (
            <div key={r.id} className="p-5 rounded-2xl bg-[#0c142b] border border-slate-800 space-y-3 hover:border-slate-700 transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= r.note
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-white text-xs">
                    {r.nom} {r.prenom} {r.anonyme ? '(Anonyme)' : `• ${r.entreprise}`}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-mono">{r.scoreQuiz}</span>
                  <span className="font-mono text-[11px]">{r.date ? r.date.substring(0, 10) : ''}</span>
                </div>
              </div>

              {r.apprisQuelqueChose && (
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">Applicable au travail :</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.apprisQuelqueChose === 'Oui'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {r.apprisQuelqueChose}
                    </span>
                  </div>
                  {r.apprisCommentaire && (
                    <span className="text-cyan-300 text-xs italic">
                      « {r.apprisCommentaire} »
                    </span>
                  )}
                </div>
              )}

              {r.commentaire ? (
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  « {r.commentaire} »
                </p>
              ) : (
                <p className="text-slate-600 text-xs italic">Aucun commentaire général textuel laissé.</p>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};
