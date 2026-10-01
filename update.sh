#!/usr/bin/env bash
# ==============================================================================
# CyberQuiz RSE - Script de mise à jour native pour conteneur LXC Debian 13
# Mise à jour depuis GitHub sans Docker
# ==============================================================================

set -euo pipefail

# Couleurs d'affichage terminal
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_CYAN='\033[0;36m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_BLUE='\033[0;34m'

# Chemins standards FHS
INSTALL_DIR="/opt/cyberquiz"
CONFIG_DIR="/etc/cyberquiz"
CONFIG_FILE="${CONFIG_DIR}/cyberquiz.env"
DATA_DIR="/var/lib/cyberquiz"
BACKUP_DIR="/var/backups/cyberquiz"
DB_FILE="${DATA_DIR}/cyberquiz.db"
APP_USER="cyberquiz"
SERVICE_NAME="cyberquiz.service"

echo -e "${C_CYAN}${C_BOLD}"
echo "=========================================================="
echo "      CYBERQUIZ RSE - MISE À JOUR NATIVE (LXC DEBIAN)     "
echo "=========================================================="
echo -e "${C_RESET}"

# 1. Vérification des privilèges
if [[ $EUID -ne 0 ]]; then
  echo -e "${C_RED}[ERREUR] Ce script doit être exécuté en tant que root dans le conteneur LXC.${C_RESET}"
  echo "Exécutez : sudo ./update.sh"
  exit 1
fi

# 2. Vérification de l'installation existante
if [[ ! -d "${INSTALL_DIR}" || ! -f "${CONFIG_FILE}" ]]; then
  echo -e "${C_RED}[ERREUR] Installation de CyberQuiz introuvable dans ${INSTALL_DIR}.${C_RESET}"
  echo "Veuillez d'abord exécuter l'installateur : sudo ./install.sh"
  exit 1
fi

cd "${INSTALL_DIR}"

# Charger la configuration
APP_PORT=$(grep -E "^APP_PORT=" "${CONFIG_FILE}" | cut -d '=' -f2- | tr -d ' "' || echo "3000")
APP_PORT="${APP_PORT:-3000}"

# 3. Vérification du dépôt Git
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo -e "${C_RED}[ERREUR] ${INSTALL_DIR} n'est pas un dépôt Git valide.${C_RESET}"
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PREV_COMMIT=$(git rev-parse --short HEAD)
echo -e "Branche active   : ${C_BOLD}${CURRENT_BRANCH}${C_RESET}"
echo -e "Version actuelle : ${C_BOLD}${PREV_COMMIT}${C_RESET}"
echo ""

# 4. Vérification des modifications locales non commitées
UNCOMMITTED=$(git status --porcelain | grep -v -E "^\?\? (data/|backups/|\.env)" || true)
if [[ -n "$UNCOMMITTED" ]]; then
  echo -e "${C_YELLOW}[ATTENTION] Des modifications locales ont été détectées dans ${INSTALL_DIR} :${C_RESET}"
  echo "$UNCOMMITTED"
  echo ""
  read -rp "Souhaitez-vous remiser (git stash) ces modifications pour permettre la mise à jour ? (o/N) : " STASH_CHOICE
  if [[ "${STASH_CHOICE,,}" =~ ^(o|oui|y|yes)$ ]]; then
    echo -e "${C_BLUE}Remisage des modifications locales...${C_RESET}"
    git stash
  else
    echo -e "${C_RED}[ANNULATION] Mise à jour interrompue pour préserver vos modifications locales.${C_RESET}"
    exit 1
  fi
fi

# 5. Recherche de modifications sur GitHub
echo -e "${C_BLUE}Vérification des mises à jour sur GitHub...${C_RESET}"
git fetch origin "${CURRENT_BRANCH}"

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "origin/${CURRENT_BRANCH}")

if [[ "$LOCAL_HASH" == "$REMOTE_HASH" ]]; then
  echo -e "${C_GREEN}${C_BOLD}✓ CyberQuiz est déjà à jour (version ${PREV_COMMIT}).${C_RESET}"
  exit 0
fi

echo -e "${C_YELLOW}→ Nouvelles modifications détectées sur GitHub !${C_RESET}"
echo ""

# ------------------------------------------------------------------------------
# 6. SAUVEGARDE PRÉALABLE COHÉRENTE DE LA BASE SQL ET DU FICHIER .ENV
# ------------------------------------------------------------------------------
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

BACKUP_DB="${BACKUP_DIR}/cyberquiz_${TIMESTAMP}.db"
BACKUP_ENV="${BACKUP_DIR}/cyberquiz_${TIMESTAMP}.env"

echo -e "${C_BLUE}Création d'une sauvegarde de sécurité préventive...${C_RESET}"

# Sauvegarde de la configuration
cp "${CONFIG_FILE}" "${BACKUP_ENV}"
chmod 600 "${BACKUP_ENV}"

# Sauvegarde cohérente de la base SQLite (compatible mode WAL)
if [[ -f "${DB_FILE}" ]]; then
  BACKUP_DONE=0

  # Méthode 1 : Utilisation de l'utilitaire sqlite3 officiel avec checkpoint WAL complet
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "${DB_FILE}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    if sqlite3 "${DB_FILE}" ".backup '${BACKUP_DB}'" 2>/dev/null; then
      BACKUP_DONE=1
    fi
  fi

  # Méthode 2 : Outil de snapshot binaire du projet via Node.js
  if [[ $BACKUP_DONE -eq 0 && -f "${INSTALL_DIR}/node_modules/.bin/tsx" ]]; then
    if node "${INSTALL_DIR}/node_modules/.bin/tsx" "${INSTALL_DIR}/scripts/backup.ts" "${BACKUP_DB}" "${DB_FILE}" &>/dev/null; then
      BACKUP_DONE=1
    fi
  fi

  # Méthode 3 : Copie directe de secours si aucun outil n'a fonctionné
  if [[ $BACKUP_DONE -eq 0 ]]; then
    cp "${DB_FILE}" "${BACKUP_DB}"
    BACKUP_DONE=1
  fi

  # Vérification stricte que le fichier de sauvegarde existe et n'est pas vide
  if [[ ! -s "${BACKUP_DB}" ]]; then
    echo -e "${C_RED}[ERREUR CRITIQUE] Impossible de créer une sauvegarde valide de la base SQL.${C_RESET}"
    echo "La mise à jour est interrompue pour protéger vos données."
    exit 1
  fi

  chmod 600 "${BACKUP_DB}"
  chown "${APP_USER}:${APP_USER}" "${BACKUP_DB}" "${BACKUP_ENV}"
  echo -e "${C_GREEN}✓ Sauvegarde SQL créée : ${BACKUP_DB} ($(du -h "${BACKUP_DB}" | cut -f1))${C_RESET}"
  echo -e "${C_GREEN}✓ Sauvegarde configuration créée : ${BACKUP_ENV}${C_RESET}"
else
  echo -e "${C_YELLOW}ℹ Aucune base de données existante à sauvegarder.${C_RESET}"
fi

echo ""

# ------------------------------------------------------------------------------
# 7. TÉLÉCHARGEMENT DU NOUVEAU CODE (FAST-FORWARD STRICT)
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Téléchargement du nouveau code depuis GitHub...${C_RESET}"
if ! git pull --ff-only origin "${CURRENT_BRANCH}"; then
  echo -e "${C_RED}[ERREUR] Le téléchargement des modifications Git a échoué.${C_RESET}"
  echo "Vos données et configurations sont intactes."
  exit 1
fi

NEW_COMMIT=$(git rev-parse --short HEAD)
echo -e "${C_GREEN}✓ Code source mis à jour : ${PREV_COMMIT} → ${NEW_COMMIT}${C_RESET}"
echo ""

# ------------------------------------------------------------------------------
# 8. INSTALLATION DES DÉPENDANCES ET COMPILATION FRONTEND
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Mise à jour des dépendances npm...${C_RESET}"
if [[ -f package-lock.json ]]; then
  npm ci --loglevel=error || npm install --loglevel=error
else
  npm install --loglevel=error
fi

echo -e "${C_BLUE}Compilation du frontend React de production...${C_RESET}"
if ! npm run build; then
  echo -e "${C_RED}[ERREUR] Échec de la compilation du frontend React.${C_RESET}"
  echo -e "${C_YELLOW}Procédure de restauration :${C_RESET}"
  echo "  git checkout ${PREV_COMMIT} && npm ci && npm run build && systemctl restart ${SERVICE_NAME}"
  exit 1
fi

# Ajuster les permissions
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"

# ------------------------------------------------------------------------------
# 9. REDÉMARRAGE DU SERVICE SYSTEMD & VÉRIFICATION
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Redémarrage du service ${SERVICE_NAME}...${C_RESET}"
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  systemctl restart "${SERVICE_NAME}"
elif systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
  systemctl start "${SERVICE_NAME}"
else
  echo -e "${C_YELLOW}Service systemd non activé. Veuillez redémarrer manuellement l'application.${C_RESET}"
fi

# Contrôle de santé
echo -e "${C_BLUE}Vérification du fonctionnement sur /api/health...${C_RESET}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
MAX_ATTEMPTS=25
ATTEMPT=0
SERVICE_HEALTHY=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
  if curl -sf "${HEALTH_URL}" &>/dev/null; then
    SERVICE_HEALTHY=1
    break
  fi
  echo -n "."
done
echo ""

if [[ $SERVICE_HEALTHY -ne 1 ]]; then
  echo -e "${C_RED}[ERREUR] L'application ne répond pas après redémarrage.${C_RESET}"
  echo -e "${C_YELLOW}Diagnostics recommandés :${C_RESET}"
  echo "  1. Vérifier les journaux : journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
  echo "  2. Fichier de sauvegarde préservé : ${BACKUP_DB}"
  echo "  3. Restauration de secours : cp ${BACKUP_DB} ${DB_FILE} && git checkout ${PREV_COMMIT} && systemctl restart ${SERVICE_NAME}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 10. RÉSUMÉ FINAL
# ------------------------------------------------------------------------------
echo -e "${C_GREEN}${C_BOLD}"
echo "=========================================================="
echo "          CYBERQUIZ RSE - MISE À JOUR RÉUSSIE             "
echo "=========================================================="
echo -e "${C_RESET}"
echo -e "Ancienne version : ${C_BOLD}${PREV_COMMIT}${C_RESET}"
echo -e "Nouvelle version : ${C_GREEN}${C_BOLD}${NEW_COMMIT}${C_RESET}"
echo -e "Sauvegarde SQL   : ${C_GREEN}OK (${BACKUP_DB})${C_RESET}"
echo -e "Configuration    : ${C_GREEN}OK (${CONFIG_FILE} préservé)${C_RESET}"
echo -e "Build frontend   : ${C_GREEN}OK${C_RESET}"
echo -e "Service systemd  : ${C_GREEN}OK (Redémarré)${C_RESET}"
echo -e "Contrôle HTTP    : ${C_GREEN}OK (${HEALTH_URL})${C_RESET}"
echo -e "Statut final     : ${C_GREEN}${C_BOLD}EN LIGNE${C_RESET}"
echo "=========================================================="
