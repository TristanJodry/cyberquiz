import { PublicConfig, RestrictionMode } from '../types.ts';

const COMPLETION_KEY = 'cyberquiz_completion';

export interface RestrictionStatus {
  isRestricted: boolean;
  mode?: RestrictionMode;
  remainingDays?: number;
  untilDate?: string;
  completedAtDate?: string;
}

/**
 * Enregistre la complétion définitive du quiz et du REX dans le localStorage du navigateur
 */
export function recordParticipationCompletion(): void {
  try {
    localStorage.setItem(COMPLETION_KEY, JSON.stringify({
      completedAt: Date.now()
    }));
  } catch (e) {
    console.error('Erreur enregistrement temporisation localStorage:', e);
  }
}

/**
 * Réinitialise manuellement la restriction du navigateur (utile pour les tests admin)
 */
export function clearParticipationRestriction(): void {
  try {
    localStorage.removeItem(COMPLETION_KEY);
  } catch (e) {
    console.error('Erreur réinitialisation restriction localStorage:', e);
  }
}

/**
 * Évalue si le navigateur courant fait l'objet d'une restriction de participation active
 */
export function checkParticipationRestriction(config: PublicConfig | null): RestrictionStatus {
  if (!config) {
    return { isRestricted: false };
  }

  const mode = config.restriction_mode || 'delay';
  if (mode === 'none') {
    return { isRestricted: false };
  }

  try {
    const raw = localStorage.getItem(COMPLETION_KEY);
    if (!raw) {
      return { isRestricted: false };
    }

    const parsed = JSON.parse(raw);
    const completedAt = typeof parsed?.completedAt === 'number' ? parsed.completedAt : null;
    if (!completedAt) {
      return { isRestricted: false };
    }

    const completedAtDate = new Date(completedAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Mode 3 : Une seule participation par navigateur
    if (mode === 'unique') {
      return {
        isRestricted: true,
        mode: 'unique',
        completedAtDate
      };
    }

    // Mode 2 : Temporisation en jours (30 jours par défaut)
    if (mode === 'delay') {
      const days = typeof config.restriction_jours === 'number' && config.restriction_jours > 0 
        ? config.restriction_jours 
        : 30;
      
      const durationMs = days * 24 * 60 * 60 * 1000;
      const expiryTimestamp = completedAt + durationMs;
      const now = Date.now();

      if (now < expiryTimestamp) {
        const remainingMs = expiryTimestamp - now;
        const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
        const untilDate = new Date(expiryTimestamp).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        return {
          isRestricted: true,
          mode: 'delay',
          remainingDays,
          untilDate,
          completedAtDate
        };
      } else {
        // La durée de restriction est écoulée : le participant peut refaire le quiz
        return { isRestricted: false };
      }
    }
  } catch (e) {
    console.error('Erreur lecture restriction localStorage:', e);
  }

  return { isRestricted: false };
}
