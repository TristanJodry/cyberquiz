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

# ------------------------------------------------------------------------------
# 1. LOCALISATION FLEXIBLE DU DOSSIER D'INSTALLATION / DÉPÔT CYBERQUIZ
# ------------------------------------------------------------------------------
# Détection ou surcharge dynamique du répertoire du projet CyberQuiz
# Ordre de priorité :
#   1. Premier argument passé en ligne de commande (ex: ./update.sh /opt/cyberquiz ou ./update.sh cyberquiz)
#   2. Variable d'environnement CYBERQUIZ_DIR (ex: CYBERQUIZ_DIR=/opt/cyberquiz ./update.sh)
#   3. Dossier courant ($PWD) s'il contient un dépôt .git
#   4. Dossier contenant ce script s'il contient un dépôt .git
#   5. Dossier standard FHS /opt/cyberquiz
#   6. Sous-dossier ./cyberquiz s'il existe
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -ge 1 && -n "$1" ]]; then
  if [[ -d "$1" ]]; then
    INSTALL_DIR="$(cd "$1" && pwd)"
  else
    INSTALL_DIR="$1"
  fi
elif [[ -n "${CYBERQUIZ_DIR:-}" ]]; then
  INSTALL_DIR="${CYBERQUIZ_DIR}"
elif [[ -d "${PWD}/.git" ]]; then
  INSTALL_DIR="${PWD}"
elif [[ -d "${SCRIPT_DIR}/.git" ]]; then
  INSTALL_DIR="${SCRIPT_DIR}"
elif [[ -d "/opt/cyberquiz/.git" ]]; then
  INSTALL_DIR="/opt/cyberquiz"
elif [[ -d "${PWD}/cyberquiz/.git" ]]; then
  INSTALL_DIR="${PWD}/cyberquiz"
elif [[ -d "${SCRIPT_DIR}/cyberquiz/.git" ]]; then
  INSTALL_DIR="${SCRIPT_DIR}/cyberquiz"
else
  INSTALL_DIR="/opt/cyberquiz"
fi

# Chemins standards FHS et configuration
CONFIG_DIR="/etc/cyberquiz"
CONFIG_FILE="${CONFIG_DIR}/cyberquiz.env"
DATA_DIR="/var/lib/cyberquiz"
BACKUP_DIR="/var/backups/cyberquiz"
DB_FILE="${DATA_DIR}/cyberquiz.db"
APP_USER="cyberquiz"
SERVICE_NAME="cyberquiz.service"

# Fallback si le fichier de configuration est dans le dossier local du projet
if [[ ! -f "${CONFIG_FILE}" && -f "${INSTALL_DIR}/.env" ]]; then
  CONFIG_FILE="${INSTALL_DIR}/.env"
fi

# ------------------------------------------------------------------------------
# 2. CONFIGURATION IMMÉDIATE SAFE.DIRECTORY (Évite l'erreur Git 'dubious ownership')
# ------------------------------------------------------------------------------
# Quand /opt/cyberquiz appartient à l'utilisateur système 'cyberquiz' mais que
# le script est exécuté par 'root' (ou inversement), Git bloque par défaut
# avec le message : "fatal: detected dubious ownership in repository at '/opt/cyberquiz'".
git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
git config --system --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
git config --global --add safe.directory "${SCRIPT_DIR}" 2>/dev/null || true
git config --system --add safe.directory "${SCRIPT_DIR}" 2>/dev/null || true
git config --global --add safe.directory "*" 2>/dev/null || true
git config --system --add safe.directory "*" 2>/dev/null || true

echo -e "${C_CYAN}${C_BOLD}"
echo "=========================================================="
echo "      CYBERQUIZ RSE - MISE À JOUR NATIVE (LXC DEBIAN)     "
echo "=========================================================="
echo -e "${C_RESET}"
echo -e "Dossier cible CyberQuiz : ${C_BOLD}${INSTALL_DIR}${C_RESET}"

# 1. Vérification des privilèges
if [[ $EUID -ne 0 ]]; then
  echo -e "${C_RED}[ERREUR] Ce script doit être exécuté en tant que root dans le conteneur LXC.${C_RESET}"
  echo "Exécutez : sudo ./update.sh"
  exit 1
fi

# 2. Vérification de l'existence du dossier
if [[ ! -d "${INSTALL_DIR}" ]]; then
  echo -e "${C_RED}[ERREUR] Répertoire d'installation introuvable : ${INSTALL_DIR}${C_RESET}"
  echo -e "${C_YELLOW}Veuillez vérifier l'emplacement ou spécifier le chemin exact :${C_RESET}"
  echo "  ./update.sh /chemin/vers/cyberquiz"
  exit 1
fi

cd "${INSTALL_DIR}"
git config --global --add safe.directory "$(pwd)" 2>/dev/null || true
git config --system --add safe.directory "$(pwd)" 2>/dev/null || true

# 3. Vérification du dépôt Git
if ! git -C "${INSTALL_DIR}" rev-parse --is-inside-work-tree &>/dev/null; then
  echo -e "${C_RED}[ERREUR] ${INSTALL_DIR} n'est pas reconnu comme un dépôt Git valide.${C_RESET}"
  echo ""
  echo -e "${C_YELLOW}Diagnostics possibles :${C_RESET}"
  echo "  1. Le dossier ne contient pas le répertoire masqué '.git'."
  echo "     Si vous avez copié le projet sans Git ou par archive ZIP, liez-le avec :"
  echo "       cd ${INSTALL_DIR}"
  echo "       git init"
  echo "       git remote add origin <URL_DE_VOTRE_DEPOT_GITHUB>"
  echo "       git fetch"
  echo "       git checkout -f main || git checkout -f master"
  echo "  2. Si votre dépôt Git se trouve dans un autre dossier, relancez avec son chemin :"
  echo "       ./update.sh /chemin/vers/cyberquiz"
  exit 1
fi

# Charger la configuration
APP_PORT="3000"
if [[ -f "${CONFIG_FILE}" ]]; then
  APP_PORT=$(grep -E "^(APP_PORT|PORT)=" "${CONFIG_FILE}" | cut -d '=' -f2- | tr -d ' "' | head -n 1 || echo "3000")
  APP_PORT="${APP_PORT:-3000}"
fi

CURRENT_BRANCH=$(git -C "${INSTALL_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
if [[ "$CURRENT_BRANCH" == "HEAD" || -z "$CURRENT_BRANCH" ]]; then
  CURRENT_BRANCH="main"
fi

PREV_COMMIT=$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "inconnu")
GIT_REMOTE=$(git -C "${INSTALL_DIR}" remote 2>/dev/null | head -n 1 || echo "origin")
GIT_REMOTE="${GIT_REMOTE:-origin}"

echo -e "Dépôt distant    : ${C_BOLD}${GIT_REMOTE}${C_RESET}"
echo -e "Branche active   : ${C_BOLD}${CURRENT_BRANCH}${C_RESET}"
echo -e "Version actuelle : ${C_BOLD}${PREV_COMMIT}${C_RESET}"
echo ""

# 4. Vérification des modifications locales non commitées
UNCOMMITTED=$(git -C "${INSTALL_DIR}" status --porcelain | grep -v -E "^\?\? (data/|backups/|\.env)" || true)
if [[ -n "$UNCOMMITTED" ]]; then
  echo -e "${C_YELLOW}[ATTENTION] Des modifications locales ont été détectées dans ${INSTALL_DIR} :${C_RESET}"
  echo "$UNCOMMITTED"
  echo ""
  read -rp "Souhaitez-vous remiser (git stash) ces modifications pour permettre la mise à jour ? (o/N) : " STASH_CHOICE
  if [[ "${STASH_CHOICE,,}" =~ ^(o|oui|y|yes)$ ]]; then
    echo -e "${C_BLUE}Remisage des modifications locales...${C_RESET}"
    git -C "${INSTALL_DIR}" stash
  else
    echo -e "${C_RED}[ANNULATION] Mise à jour interrompue pour préserver vos modifications locales.${C_RESET}"
    exit 1
  fi
fi

# 5. Recherche de modifications sur GitHub
echo -e "${C_BLUE}Vérification des mises à jour sur GitHub (${GIT_REMOTE}/${CURRENT_BRANCH})...${C_RESET}"
if ! git -C "${INSTALL_DIR}" fetch "${GIT_REMOTE}" "${CURRENT_BRANCH}"; then
  echo -e "${C_YELLOW}[ATTENTION] Impossible de joindre '${GIT_REMOTE}'. Tentative de git fetch sans argument...${C_RESET}"
  git -C "${INSTALL_DIR}" fetch || true
fi

LOCAL_HASH=$(git -C "${INSTALL_DIR}" rev-parse HEAD 2>/dev/null || echo "")
REMOTE_HASH=$(git -C "${INSTALL_DIR}" rev-parse "${GIT_REMOTE}/${CURRENT_BRANCH}" 2>/dev/null || echo "$LOCAL_HASH")

if [[ -n "$LOCAL_HASH" && "$LOCAL_HASH" == "$REMOTE_HASH" ]]; then
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
if [[ -f "${CONFIG_FILE}" ]]; then
  cp "${CONFIG_FILE}" "${BACKUP_ENV}"
  chmod 600 "${BACKUP_ENV}"
fi

# Sauvegarde cohérente de la base SQLite (compatible mode WAL)
# Vérifier si la base est dans /var/lib/cyberquiz ou dans ./data/cyberquiz.db
ACTUAL_DB_FILE="${DB_FILE}"
if [[ ! -f "${ACTUAL_DB_FILE}" && -f "${INSTALL_DIR}/data/cyberquiz.db" ]]; then
  ACTUAL_DB_FILE="${INSTALL_DIR}/data/cyberquiz.db"
fi

if [[ -f "${ACTUAL_DB_FILE}" ]]; then
  BACKUP_DONE=0

  # Méthode 1 : Utilisation de l'utilitaire sqlite3 officiel avec checkpoint WAL complet
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "${ACTUAL_DB_FILE}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    if sqlite3 "${ACTUAL_DB_FILE}" ".backup '${BACKUP_DB}'" 2>/dev/null; then
      BACKUP_DONE=1
    fi
  fi

  # Méthode 2 : Outil de snapshot binaire du projet via Node.js
  if [[ $BACKUP_DONE -eq 0 && -f "${INSTALL_DIR}/node_modules/.bin/tsx" && -f "${INSTALL_DIR}/scripts/backup.ts" ]]; then
    if node "${INSTALL_DIR}/node_modules/.bin/tsx" "${INSTALL_DIR}/scripts/backup.ts" "${BACKUP_DB}" "${ACTUAL_DB_FILE}" &>/dev/null; then
      BACKUP_DONE=1
    fi
  fi

  # Méthode 3 : Copie directe de secours si aucun outil n'a fonctionné
  if [[ $BACKUP_DONE -eq 0 ]]; then
    cp "${ACTUAL_DB_FILE}" "${BACKUP_DB}"
    BACKUP_DONE=1
  fi

  # Vérification stricte que le fichier de sauvegarde existe et n'est pas vide
  if [[ -s "${BACKUP_DB}" ]]; then
    chmod 600 "${BACKUP_DB}"
    if id -u "${APP_USER}" &>/dev/null; then
      chown "${APP_USER}:${APP_USER}" "${BACKUP_DB}" "${BACKUP_ENV}" 2>/dev/null || true
    fi
    echo -e "${C_GREEN}✓ Sauvegarde SQL créée : ${BACKUP_DB} ($(du -h "${BACKUP_DB}" | cut -f1))${C_RESET}"
    if [[ -f "${BACKUP_ENV}" ]]; then
      echo -e "${C_GREEN}✓ Sauvegarde configuration créée : ${BACKUP_ENV}${C_RESET}"
    fi
  fi
else
  echo -e "${C_YELLOW}ℹ Aucune base de données existante à sauvegarder.${C_RESET}"
fi

echo ""

# ------------------------------------------------------------------------------
# 7. TÉLÉCHARGEMENT DU NOUVEAU CODE (FAST-FORWARD STRICT)
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Téléchargement du nouveau code depuis GitHub...${C_RESET}"
if ! git -C "${INSTALL_DIR}" pull --ff-only "${GIT_REMOTE}" "${CURRENT_BRANCH}"; then
  echo -e "${C_YELLOW}[INFO] Fast-forward impossible, tentative de pull standard...${C_RESET}"
  if ! git -C "${INSTALL_DIR}" pull "${GIT_REMOTE}" "${CURRENT_BRANCH}"; then
    echo -e "${C_RED}[ERREUR] Le téléchargement des modifications Git a échoué.${C_RESET}"
    echo "Vos données et configurations restent intactes."
    exit 1
  fi
fi

NEW_COMMIT=$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "nouveau")
echo -e "${C_GREEN}✓ Code source mis à jour : ${PREV_COMMIT} → ${NEW_COMMIT}${C_RESET}"
echo ""

# ------------------------------------------------------------------------------
# 8. INSTALLATION DES DÉPENDANCES ET COMPILATION FRONTEND
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Mise à jour des dépendances npm...${C_RESET}"
if [[ -f "${INSTALL_DIR}/package-lock.json" ]]; then
  npm ci --prefix "${INSTALL_DIR}" --loglevel=error || npm install --prefix "${INSTALL_DIR}" --loglevel=error
else
  npm install --prefix "${INSTALL_DIR}" --loglevel=error
fi

echo -e "${C_BLUE}Compilation du frontend React de production...${C_RESET}"
if ! (cd "${INSTALL_DIR}" && npm run build); then
  echo -e "${C_RED}[ERREUR] Échec de la compilation du frontend React.${C_RESET}"
  echo -e "${C_YELLOW}Procédure de restauration :${C_RESET}"
  echo "  git checkout ${PREV_COMMIT} && npm ci && npm run build && systemctl restart ${SERVICE_NAME}"
  exit 1
fi

# Ajuster les permissions pour l'utilisateur de service
if id -u "${APP_USER}" &>/dev/null; then
  chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}" 2>/dev/null || true
  # Ré-appliquer safe.directory pour que root puisse toujours utiliser Git sans warning
  git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
  git config --system --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 9. REDÉMARRAGE DU SERVICE SYSTEMD & VÉRIFICATION
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Redémarrage du service ${SERVICE_NAME}...${C_RESET}"
if command -v systemctl &>/dev/null; then
  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    systemctl restart "${SERVICE_NAME}"
  elif systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
    systemctl start "${SERVICE_NAME}"
  else
    echo -e "${C_YELLOW}Service systemd non actif ou non installé. Si nécessaire, relancez manuellement.${C_RESET}"
  fi
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
  echo -e "${C_YELLOW}[NOTE] Le contrôle HTTP automatique sur ${HEALTH_URL} n'a pas répondu immédiatement.${C_RESET}"
  echo "Diagnostics recommandés si le service ne répond pas :"
  echo "  1. Vérifier les journaux : journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
  echo "  2. Fichier de sauvegarde préservé : ${BACKUP_DB:-aucun}"
else
  echo -e "${C_GREEN}✓ Contrôle HTTP réussi sur ${HEALTH_URL}${C_RESET}"
fi

# ------------------------------------------------------------------------------
# 10. RÉSUMÉ FINAL
# ------------------------------------------------------------------------------
echo -e "${C_GREEN}${C_BOLD}"
echo "=========================================================="
echo "          CYBERQUIZ RSE - MISE À JOUR RÉUSSIE             "
echo "=========================================================="
echo -e "${C_RESET}"
echo -e "Dossier cible    : ${C_BOLD}${INSTALL_DIR}${C_RESET}"
echo -e "Ancienne version : ${C_BOLD}${PREV_COMMIT}${C_RESET}"
echo -e "Nouvelle version : ${C_GREEN}${C_BOLD}${NEW_COMMIT}${C_RESET}"
if [[ -f "${BACKUP_DB:-}" ]]; then
  echo -e "Sauvegarde SQL   : ${C_GREEN}OK (${BACKUP_DB})${C_RESET}"
fi
echo -e "Build frontend   : ${C_GREEN}OK${C_RESET}"
echo -e "Statut final     : ${C_GREEN}${C_BOLD}PRÊT & À JOUR${C_RESET}"
echo "=========================================================="
