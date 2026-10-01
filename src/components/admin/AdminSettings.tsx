import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Lock, 
  ShieldCheck,
  Power,
  Clock,
  ShieldOff,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import { RestrictionMode } from '../../types.ts';
import { clearParticipationRestriction } from '../../utils/restriction.ts';

interface AdminSettingsProps {
  token: string;
  onSettingsUpdated?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ token, onSettingsUpdated }) => {
  // Paramètres globaux
  const [titre, setTitre] = useState('');
  const [sousTitre, setSousTitre] = useState('');
  const [quizActif, setQuizActif] = useState(true);
  const [ordreQuestions, setOrdreQuestions] = useState<'fixe' | 'aleatoire'>('fixe');
  const [politique, setPolitique] = useState('');
  const [dureeConservation, setDureeConservation] = useState('');
  const [contactDpo, setContactDpo] = useState('');
  const [tempsEstime, setTempsEstime] = useState('5 minutes');
  const [restrictionMode, setRestrictionMode] = useState<RestrictionMode>('delay');
  const [restrictionJours, setRestrictionJours] = useState<number>(30);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Mot de passe
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmationMdp, setConfirmationMdp] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTitre(data.quiz_titre || 'Tous acteurs de notre cybersécurité');
        setSousTitre(data.quiz_sous_titre || 'Testez vos connaissances et contribuez à une culture numérique plus responsable.');
        setQuizActif(data.quiz_actif === '1');
        setOrdreQuestions(data.ordre_questions === 'aleatoire' ? 'aleatoire' : 'fixe');
        setPolitique(data.politique_confidentialite || '');
        setDureeConservation(data.duree_conservation || '12 mois');
        setContactDpo(data.contact_dpo || '');
        setTempsEstime(data.temps_estime || '5 minutes');
        setRestrictionMode((data.restriction_mode as RestrictionMode) || 'delay');
        setRestrictionJours(parseInt(data.restriction_jours, 10) || 30);
      }
    } catch (e) {
      console.error('Erreur chargement paramètres:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quiz_titre: titre,
          quiz_sous_titre: sousTitre,
          quiz_actif: quizActif,
          ordre_questions: ordreQuestions,
          politique_confidentialite: politique,
          duree_conservation: dureeConservation,
          contact_dpo: contactDpo,
          temps_estime: tempsEstime,
          restriction_mode: restrictionMode,
          restriction_jours: restrictionJours
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde.');

      setStatusMessage({ type: 'success', text: 'Paramètres enregistrés avec succès.' });
      onSettingsUpdated?.();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);

    try {
      if (nouveauMdp !== confirmationMdp) {
        throw new Error('La confirmation ne correspond pas au nouveau mot de passe.');
      }
      if (nouveauMdp.length < 8) {
        throw new Error('Le mot de passe doit comporter au moins 8 caractères.');
      }

      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ancien_mot_de_passe: ancienMdp,
          nouveau_mot_de_passe: nouveauMdp,
          confirmation: confirmationMdp
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du changement de mot de passe.');

      setPwdMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' });
      setAncienMdp('');
      setNouveauMdp('');
      setConfirmationMdp('');
      setTimeout(() => setPwdMessage(null), 4000);
    } catch (err: any) {
      setPwdMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* SECTION 1 : PARAMÈTRES DU QUIZ */}
      <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Paramètres généraux du quiz</h2>
            <p className="text-xs text-slate-400">Configuration de l'accès public, diffusion et conformité RGPD</p>
          </div>
        </div>

        {statusMessage && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-5">
          
          {/* Activation du quiz */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Disponibilité publique du quiz
              </span>
              <p className="text-xs text-slate-400">
                Si désactivé, la page publique affiche : « Le quiz est actuellement indisponible. Merci de revenir ultérieurement. »
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={quizActif}
                onChange={(e) => setQuizActif(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* Ordre des questions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Mode de diffusion des questions
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrdreQuestions('fixe')}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                  ordreQuestions === 'fixe'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Mode 1 : Ordre défini</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Les questions apparaissent selon l'ordre strict configuré dans l'administration.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOrdreQuestions('aleatoire')}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                  ordreQuestions === 'aleatoire'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Mode 2 : Ordre aléatoire</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mélange automatique pour chaque nouvelle participation, stable pendant toute la session.
                </p>
              </button>
            </div>
          </div>

          {/* Titre et Sous-titre */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Titre de la page d'accueil
              </label>
              <input
                type="text"
                required
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Sous-titre d'accueil
              </label>
              <input
                type="text"
                required
                value={sousTitre}
                onChange={(e) => setSousTitre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Temps estimé du quiz (affiché à l'accueil)
              </label>
              <input
                type="text"
                required
                value={tempsEstime}
                onChange={(e) => setTempsEstime(e.target.value)}
                placeholder="Ex: 5 minutes"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Temporisation & Restriction des participations */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Temporisation & Restriction des participations (Navigateur)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Configurez la règle de participation basée sur le <span className="text-slate-300 font-mono">localStorage</span>. Le blocage s'active <strong className="text-cyan-300">uniquement</strong> lorsque le participant a terminé le quiz et envoyé son REX.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1 : Aucune restriction */}
              <button
                type="button"
                onClick={() => setRestrictionMode('none')}
                className={`p-4 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                  restrictionMode === 'none'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldOff className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-bold text-xs text-white">Mode 1 : Aucune restriction</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Les participants peuvent recommencer le quiz immédiatement et librement autant de fois qu'ils le souhaitent.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Accès illimité
                </div>
              </button>

              {/* Option 2 : Temporisation configurable en jours */}
              <button
                type="button"
                onClick={() => setRestrictionMode('delay')}
                className={`p-4 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                  restrictionMode === 'delay'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-bold text-xs text-white">Mode 2 : Temporisation en jours</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Bloque l'accès pendant une durée configurable (30 jours par défaut) après finalisation complète (Quiz + REX).
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">
                  Délai : {restrictionJours} jour{restrictionJours > 1 ? 's' : ''}
                </div>
              </button>

              {/* Option 3 : Une seule participation définitive */}
              <button
                type="button"
                onClick={() => setRestrictionMode('unique')}
                className={`p-4 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                  restrictionMode === 'unique'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-bold text-xs text-white">Mode 3 : Participation unique</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Une seule participation définitive par navigateur. Remplacement permanent du formulaire d'accueil par l'écran de remerciement.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  1 seule fois par navigateur
                </div>
              </button>
            </div>

            {/* Réglage du nombre de jours si temporisation activée */}
            {restrictionMode === 'delay' && (
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-200">
                    Durée de la temporisation (en jours)
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Délai d'attente imposé avant de pouvoir recommencer le quiz (valeur standard : 30 jours).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={restrictionJours}
                    onChange={(e) => setRestrictionJours(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm text-center font-bold focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-xs text-slate-300 font-medium">jours</span>
                </div>
              </div>
            )}

            {/* Note RGPD et bouton de réinitialisation locale pour test */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-start sm:items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  Respect de la vie privée : aucun compte requis, aucun fingerprinting intrusif, 100% compatible avec le mode anonyme. N'empêche jamais la reprise d'une session non terminée.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearParticipationRestriction();
                  setResetSuccess(true);
                  setTimeout(() => setResetSuccess(false), 3000);
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 self-end sm:self-auto"
                title="Supprime la temporisation active sur votre navigateur pour vous permettre de retester le quiz immédiatement"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>{resetSuccess ? '✓ Réinitialisé !' : 'Tester : réinitialiser ce navigateur'}</span>
              </button>
            </div>
          </div>

          {/* Paramètres de conformité & RGPD */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Conformité & Protection des données
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Texte d'information de confidentialité
              </label>
              <textarea
                rows={3}
                value={politique}
                onChange={(e) => setPolitique(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs leading-relaxed focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Durée de conservation des données
                </label>
                <input
                  type="text"
                  value={dureeConservation}
                  onChange={(e) => setDureeConservation(e.target.value)}
                  placeholder="Ex: 12 mois"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Contact Responsable / DPO
                </label>
                <input
                  type="text"
                  value={contactDpo}
                  onChange={(e) => setContactDpo(e.target.value)}
                  placeholder="Ex: dpo@entreprise.fr"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition text-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer les paramètres</span>
            </button>
          </div>

        </form>
      </div>

      {/* SECTION 2 : MODIFIER MON MOT DE PASSE ADMINISTRATEUR */}
      <div className="bg-[#0c142b] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Modifier mon mot de passe administrateur</h2>
            <p className="text-xs text-slate-400">Renouvellement sécurisé des identifiants d'accès</p>
          </div>
        </div>

        {pwdMessage && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            pwdMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}>
            {pwdMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{pwdMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Mot de passe actuel
            </label>
            <input
              type="password"
              required
              value={ancienMdp}
              onChange={(e) => setAncienMdp(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nouveau mot de passe (min 8 caractères)
              </label>
              <input
                type="password"
                required
                value={nouveauMdp}
                onChange={(e) => setNouveauMdp(e.target.value)}
                placeholder="Au moins 8 caractères"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Confirmation du nouveau mot de passe
              </label>
              <input
                type="password"
                required
                value={confirmationMdp}
                onChange={(e) => setConfirmationMdp(e.target.value)}
                placeholder="Confirmation"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)] transition text-xs flex items-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Mettre à jour le mot de passe</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
