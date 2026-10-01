import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet, 
  Calendar, 
  Star,
  Users,
  EyeOff
} from 'lucide-react';

interface ParticipationRow {
  id: string;
  nom: string;
  prenom: string;
  entreprise: string;
  anonyme: boolean;
  dateDebut: string;
  dateFin: string | null;
  statut: string;
  scoreFinal: number;
  nombreQuestions: number;
  pourcentageReussite: number;
  questionsResult: Record<string, string>; // Q1: 'Vrai' | 'Faux' | '-'
  rex: { note: number; commentaire: string } | null;
}

interface AdminParticipationsProps {
  token: string;
}

export const AdminParticipations: React.FC<AdminParticipationsProps> = ({ token }) => {
  const [columns, setColumns] = useState<Array<{ key: string; label: string; id: string }>>([]);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntreprise, setFilterEntreprise] = useState('');
  const [filterAnonyme, setFilterAnonyme] = useState('');
  const [filterStatut, setFilterStatut] = useState('');

  // Modal détail & suppression
  const [selectedPart, setSelectedPart] = useState<ParticipationRow | null>(null);
  const [partToDelete, setPartToDelete] = useState<ParticipationRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchParticipations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterEntreprise) params.append('entreprise', filterEntreprise);
      if (filterAnonyme) params.append('anonyme', filterAnonyme);
      if (filterStatut) params.append('statut', filterStatut);

      const res = await fetch(`/api/admin/participations?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setColumns(data.columns);
        setParticipations(data.participations);
      }
    } catch (e) {
      console.error('Erreur chargement participations:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipations();
  }, [filterAnonyme, filterStatut]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParticipations();
  };

  const handleConfirmDelete = async () => {
    if (!partToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/participations/${partToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPartToDelete(null);
        fetchParticipations();
      }
    } catch (e) {
      console.error('Erreur suppression:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCsv = () => {
    window.location.href = `/api/admin/export/participations.csv`;
  };

  const handleExportXlsx = () => {
    window.location.href = `/api/admin/export/participations.xlsx`;
  };

  return (
    <div className="space-y-6">
      
      {/* Barre supérieure : Titre et Exports */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c142b] p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white">
            Tableau dynamique des participations ({participations.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Matrice relationnelle des réponses et suivi individualisé en conformité avec la politique de conservation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportXlsx}
            className="px-3.5 py-2 rounded-xl border border-emerald-800/60 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Barre des filtres */}
      <div className="bg-[#0c142b] p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom ou prénom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </form>

        <select
          value={filterAnonyme}
          onChange={(e) => setFilterAnonyme(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
        >
          <option value="">Tous modes (Anonymes & Identifiés)</option>
          <option value="1">Participations anonymes uniquement</option>
          <option value="0">Participations identifiées uniquement</option>
        </select>

        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
        >
          <option value="">Tous statuts</option>
          <option value="termine">Finalisé avec REX</option>
          <option value="quiz_termine">Quiz terminé (REX en attente)</option>
          <option value="en_cours">En cours</option>
        </select>

        <button
          onClick={fetchParticipations}
          className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 rounded-xl text-xs font-semibold transition"
        >
          Appliquer
        </button>
      </div>

      {/* Tableau matriciel dynamique */}
      <div className="bg-[#0c142b] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Chargement des participations...</div>
        ) : participations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">Aucune participation ne correspond aux filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Nom</th>
                  <th className="py-3 px-3">Prénom</th>
                  <th className="py-3 px-3">Entreprise</th>
                  <th className="py-3 px-2 text-center">Anonyme</th>

                  {/* Colonnes dynamiques Q1, Q2, Q3... */}
                  {columns.map((c) => (
                    <th key={c.key} className="py-3 px-2 text-center font-mono">
                      {c.label}
                    </th>
                  ))}

                  <th className="py-3 px-3 text-center">Résultat</th>
                  <th className="py-3 px-2 text-center">REX</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {participations.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                    
                    {/* Date */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {p.dateDebut ? p.dateDebut.substring(0, 10) : '-'}
                    </td>

                    {/* Nom */}
                    <td className="py-3 px-3 font-medium text-white whitespace-nowrap">
                      {p.nom}
                    </td>

                    {/* Prénom */}
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {p.prenom}
                    </td>

                    {/* Entreprise */}
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {p.entreprise}
                    </td>

                    {/* Anonyme */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      {p.anonyme ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400">
                          <EyeOff className="w-3 h-3" /> Oui
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-semibold">Non</span>
                      )}
                    </td>

                    {/* Colonnes dynamiques Q1, Q2, Q3... */}
                    {columns.map((c) => {
                      const resVal = p.questionsResult[c.key] || '-';
                      return (
                        <td key={c.key} className="py-3 px-2 text-center whitespace-nowrap">
                          {resVal === 'Vrai' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                              Vrai
                            </span>
                          ) : resVal === 'Faux' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
                              Faux
                            </span>
                          ) : (
                            <span className="text-slate-600 font-bold">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Résultat */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-white">
                        {p.scoreFinal}/{p.nombreQuestions}
                      </span>
                      <span className="text-[10px] text-cyan-400 ml-1">
                        ({p.pourcentageReussite}%)
                      </span>
                    </td>

                    {/* REX */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      {p.rex ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold text-xs">
                          {p.rex.note} <Star className="w-3 h-3 fill-amber-400" />
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">En attente</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedPart(p)}
                          title="Détails de la participation"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPartToDelete(p)}
                          title="Supprimer définitivement"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL DÉTAILS PARTICIPATION */}
      {selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-cyan-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSelectedPart(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
              Fiche détaillée de participation
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block font-semibold mb-1">Participant</span>
                <p className="text-white font-bold">{selectedPart.nom} {selectedPart.prenom}</p>
                <p className="text-cyan-400 mt-0.5">{selectedPart.entreprise}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block font-semibold mb-1">Résultat Quiz</span>
                <p className="text-emerald-400 font-extrabold text-base">
                  {selectedPart.scoreFinal} / {selectedPart.nombreQuestions} pts
                </p>
                <p className="text-slate-300 mt-0.5">{selectedPart.pourcentageReussite}% de réussite</p>
              </div>
            </div>

            {/* REX */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Retour d'expérience (REX)</span>
                {selectedPart.rex ? (
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    {selectedPart.rex.note} / 5 <Star className="w-3.5 h-3.5 fill-amber-400" />
                  </span>
                ) : (
                  <span className="text-slate-500">Non renseigné</span>
                )}
              </div>
              {selectedPart.rex?.commentaire && (
                <p className="text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 italic leading-relaxed">
                  « {selectedPart.rex.commentaire} »
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPart(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMATION DE SUPPRESSION PARTICIPATION */}
      {partToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0c142b] border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Supprimer la participation</h3>
                <p className="text-xs text-rose-300">Action irréversible (droit à l’oubli RGPD)</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement cette participation de la base de données ?
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Participant :</span>
                <span className="text-white font-semibold">
                  {partToDelete.anonyme ? 'Anonyme' : `${partToDelete.prenom} ${partToDelete.nom}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entreprise :</span>
                <span className="text-slate-200">{partToDelete.entreprise}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date :</span>
                <span className="text-slate-200">{partToDelete.dateDebut?.substring(0, 10)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPartToDelete(null)}
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
                {isDeleting ? <span>Suppression...</span> : (
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
