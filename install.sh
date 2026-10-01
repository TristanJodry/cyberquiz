#!/usr/bin/env bash
# ==============================================================================
# CyberQuiz RSE - Script d'installation native pour conteneur LXC Debian 13
# Déploiement sans Docker (Node.js, Express, SQLite, systemd)
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
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${C_CYAN}${C_BOLD}"
echo "=========================================================="
echo "    CYBERQUIZ RSE - INSTALLATION NATIVE DANS LXC DEBIAN   "
echo "=========================================================="
echo -e "${C_RESET}"

# ------------------------------------------------------------------------------
# 1. VÉRIFICATIONS SYSTÈME & DROITS
# ------------------------------------------------------------------------------

# Vérification root
if [[ $EUID -ne 0 ]]; then
  echo -e "${C_RED}[ERREUR] Ce script doit être exécuté avec les privilèges root dans le conteneur LXC.${C_RESET}"
  echo "Exécutez : sudo ./install.sh ou passez root dans le conteneur."
  exit 1
fi

# Vérification Debian
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  echo -e "Système détecté : ${C_GREEN}${PRETTY_NAME:-Debian}${C_RESET}"
  if [[ "${ID:-}" != "debian" && "${ID_LIKE:-}" != *"debian"* && "${ID:-}" != "ubuntu" ]]; then
    echo -e "${C_YELLOW}[ATTENTION] Le script est conçu spécifiquement pour Debian (12/13).${C_RESET}"
  fi
fi

# ------------------------------------------------------------------------------
# 2. INSTALLATION DES PAQUETS ET DE NODE.JS LTS
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Vérification et installation des composants prérequis...${C_RESET}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git sqlite3 ca-certificates gnupg lsb-release build-essential >/dev/null

# Vérification / Installation de Node.js (version 20 ou 22 LTS requise)
NEED_NODE_INSTALL=0
if ! command -v node &>/dev/null; then
  NEED_NODE_INSTALL=1
else
  NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${C_YELLOW}Version de Node.js obsolète détectée (v${NODE_MAJOR}). Mise à niveau vers LTS requise.${C_RESET}"
    NEED_NODE_INSTALL=1
  fi
fi

if [[ $NEED_NODE_INSTALL -eq 1 ]]; then
  echo -e "${C_BLUE}Installation de Node.js 22 LTS depuis le dépôt officiel NodeSource...${C_RESET}"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi

NODE_BIN=$(command -v node)
NPM_BIN=$(command -v npm)

echo -e "${C_GREEN}✓ Node.js : $($NODE_BIN -v) ($NODE_BIN)${C_RESET}"
echo -e "${C_GREEN}✓ npm     : $($NPM_BIN -v)${C_RESET}"
echo -e "${C_GREEN}✓ Git     : $(git --version)${C_RESET}"
echo ""

# ------------------------------------------------------------------------------
# 3. CONFIGURATION INTERACTIVE
# ------------------------------------------------------------------------------

# [1/4] Réseau & Port
echo -e "${C_CYAN}${C_BOLD}[1/4] Configuration réseau${C_RESET}"
DEFAULT_PORT="3000"

while true; do
  read -rp "Port d'écoute pour CyberQuiz [${DEFAULT_PORT}] : " INPUT_PORT
  CHOSEN_PORT="${INPUT_PORT:-$DEFAULT_PORT}"

  if ! [[ "$CHOSEN_PORT" =~ ^[0-9]+$ ]] || [ "$CHOSEN_PORT" -lt 1 ] || [ "$CHOSEN_PORT" -gt 65535 ]; then
    echo -e "${C_RED}Veuillez saisir un port valide entre 1 et 65535.${C_RESET}"
    continue
  fi

  # Vérification disponibilité port
  PORT_BUSY=0
  if command -v ss &>/dev/null; then
    if ss -tuln | grep -q ":${CHOSEN_PORT} "; then PORT_BUSY=1; fi
  elif command -v lsof &>/dev/null; then
    if lsof -i ":${CHOSEN_PORT}" &>/dev/null; then PORT_BUSY=1; fi
  fi

  if [[ $PORT_BUSY -eq 1 ]]; then
    echo -e "${C_RED}[!] Le port ${CHOSEN_PORT} est déjà utilisé sur ce conteneur.${C_RESET}"
  else
    echo -e "${C_GREEN}✓ Port ${CHOSEN_PORT} disponible.${C_RESET}"
    break
  fi
done

echo ""
echo "Adresse d'écoute pour Nginx Proxy Manager (hébergé sur une autre machine) :"
echo "1) Toutes les interfaces (0.0.0.0 - Recommandé pour Nginx Proxy Manager distant)"
echo "2) Localhost uniquement (127.0.0.1 - Si reverse proxy sur le même conteneur)"
read -rp "Votre choix [1] : " BIND_CHOICE
BIND_CHOICE="${BIND_CHOICE:-1}"

if [[ "$BIND_CHOICE" == "2" ]]; then
  CHOSEN_HOST="127.0.0.1"
  echo -e "${C_GREEN}✓ Écoute fixée sur 127.0.0.1 (local)${C_RESET}"
else
  CHOSEN_HOST="0.0.0.0"
  echo -e "${C_GREEN}✓ Écoute fixée sur 0.0.0.0 (accessible depuis le réseau local)${C_RESET}"
fi

echo ""

# [2/4] Configuration Administrateur
echo -e "${C_CYAN}${C_BOLD}[2/4] Configuration administrateur${C_RESET}"
ALREADY_INSTALLED=0

if [[ -f "$DB_FILE" ]]; then
  ALREADY_INSTALLED=1
  echo -e "${C_YELLOW}[INFO] Une base SQLite existante a été détectée dans ${DB_FILE}.${C_RESET}"
  echo "Le compte administrateur existant, les questions et les statistiques seront strictement conservés."
  ADMIN_USERNAME=""
  ADMIN_PASSWORD=""
else
  DEFAULT_ADMIN="admin"
  read -rp "Identifiant administrateur [${DEFAULT_ADMIN}] : " INPUT_ADMIN
  ADMIN_USERNAME="${INPUT_ADMIN:-$DEFAULT_ADMIN}"

  while true; do
    read -rsp "Nouveau mot de passe administrateur (min 8 caractères) : " PWD1
    echo ""
    if [[ ${#PWD1} -lt 8 ]]; then
      echo -e "${C_RED}Le mot de passe doit comporter au moins 8 caractères.${C_RESET}"
      continue
    fi

    read -rsp "Confirmer le mot de passe : " PWD2
    echo ""
    if [[ "$PWD1" != "$PWD2" ]]; then
      echo -e "${C_RED}Les mots de passe ne correspondent pas. Veuillez recommencer.${C_RESET}"
      continue
    fi

    ADMIN_PASSWORD="$PWD1"
    echo -e "${C_GREEN}✓ Mot de passe administrateur validé.${C_RESET}"
    break
  done
fi

echo ""

# [3/4] Service systemd
echo -e "${C_CYAN}${C_BOLD}[3/4] Configuration du service système${C_RESET}"
read -rp "Installer CyberQuiz comme service systemd (démarrage automatique au boot du LXC) ? (O/n) : " INSTALL_SYSTEMD
INSTALL_SYSTEMD="${INSTALL_SYSTEMD:-O}"
SYSTEMD_ENABLED=1
if [[ ! "${INSTALL_SYSTEMD,,}" =~ ^(o|oui|y|yes)$ ]]; then
  SYSTEMD_ENABLED=0
fi

echo ""

# [4/4] Secrets et Cryptographie
echo -e "${C_CYAN}${C_BOLD}[4/4] Configuration de la sécurité${C_RESET}"
echo "Génération des clés et des répertoires sécurisés..."

EXISTING_SECRET=""
if [[ -f "$CONFIG_FILE" ]]; then
  EXISTING_SECRET=$(grep -E "^JWT_SECRET=" "$CONFIG_FILE" | cut -d '=' -f2- | tr -d ' "' || true)
fi

if [[ -n "$EXISTING_SECRET" && "$EXISTING_SECRET" != "remplacez_cette_cle"* ]]; then
  JWT_SECRET="$EXISTING_SECRET"
  echo -e "${C_GREEN}✓ Secret cryptographique JWT existant conservé.${C_RESET}"
else
  JWT_SECRET=$(openssl rand -hex 32)
  echo -e "${C_GREEN}✓ Nouveau secret cryptographique JWT généré (256 bits d'entropie).${C_RESET}"
fi

# ------------------------------------------------------------------------------
# 4. CRÉATION DE L'UTILISATEUR SYSTÈME & DES RÉPERTOIRES FHS
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Configuration des répertoires et de l'utilisateur système...${C_RESET}"

# Création de l'utilisateur sans shell interactif
if ! id -u "${APP_USER}" &>/dev/null; then
  useradd -r -s /usr/sbin/nologin -d "${DATA_DIR}" -c "CyberQuiz Application Service" "${APP_USER}"
  echo -e "${C_GREEN}✓ Utilisateur système dédié créé : ${APP_USER}${C_RESET}"
fi

mkdir -p "${INSTALL_DIR}"
mkdir -p "${CONFIG_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${BACKUP_DIR}"

# ------------------------------------------------------------------------------
# 5. DÉPLOIEMENT DU CODE APPLICATIF DANS /opt/cyberquiz
# ------------------------------------------------------------------------------
if [[ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]]; then
  echo -e "${C_BLUE}Synchronisation du code vers ${INSTALL_DIR}...${C_RESET}"
  # Copier le code source vers /opt/cyberquiz (en excluant data et node_modules)
  cp -a "${SOURCE_DIR}/." "${INSTALL_DIR}/"
fi

cd "${INSTALL_DIR}"

# Écriture du fichier de configuration dans /etc/cyberquiz/cyberquiz.env
cat > "${CONFIG_FILE}" <<EOF
# Configuration CyberQuiz RSE (LXC Debian) - Générée le $(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_ENV=production
APP_HOST=${CHOSEN_HOST}
APP_PORT=${CHOSEN_PORT}
PORT=${CHOSEN_PORT}
JWT_SECRET=${JWT_SECRET}
CYBERQUIZ_DATA_DIR=${DATA_DIR}
CYBERQUIZ_DB_PATH=${DB_FILE}
EOF

chmod 600 "${CONFIG_FILE}"
chown "${APP_USER}:${APP_USER}" "${CONFIG_FILE}"

# Symlink de complaisance .env vers /etc/cyberquiz/cyberquiz.env
ln -sf "${CONFIG_FILE}" "${INSTALL_DIR}/.env"

# Transmission sécurisée du compte administrateur initial (si nouvelle installation)
if [[ $ALREADY_INSTALLED -eq 0 && -n "$ADMIN_USERNAME" && -n "$ADMIN_PASSWORD" ]]; then
  ADMIN_SETUP_FILE="${DATA_DIR}/.admin_setup.json"
  cat > "${ADMIN_SETUP_FILE}" <<EOF
{
  "username": "${ADMIN_USERNAME}",
  "password": "${ADMIN_PASSWORD}"
}
EOF
  chmod 600 "${ADMIN_SETUP_FILE}"
  chown "${APP_USER}:${APP_USER}" "${ADMIN_SETUP_FILE}"
fi

# ------------------------------------------------------------------------------
# 6. INSTALLATION DES DÉPENDANCES ET COMPILATION FRONTEND
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Installation des dépendances npm...${C_RESET}"
if [[ -f package-lock.json ]]; then
  npm ci --loglevel=error || npm install --loglevel=error
else
  npm install --loglevel=error
fi

echo -e "${C_BLUE}Compilation du frontend React pour la production...${C_RESET}"
npm run build

# Ajustement final des droits d'accès
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${DATA_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${BACKUP_DIR}"
chmod 750 "${INSTALL_DIR}"
chmod 700 "${DATA_DIR}"
chmod 700 "${BACKUP_DIR}"

# Configuration safe.directory pour éviter l'erreur Git 'dubious ownership' lors de futurs git pull ou ./update.sh
git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
git config --system --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
git config --global --add safe.directory "*" 2>/dev/null || true
git config --system --add safe.directory "*" 2>/dev/null || true

# Rendre les scripts install et update exécutables
chmod +x "${INSTALL_DIR}/install.sh" "${INSTALL_DIR}/update.sh" 2>/dev/null || true

# ------------------------------------------------------------------------------
# 7. CONFIGURATION DU SERVICE SYSTEMD & DÉMARRAGE
# ------------------------------------------------------------------------------
if [[ $SYSTEMD_ENABLED -eq 1 ]]; then
  echo -e "${C_BLUE}Configuration de l'unité systemd ${SERVICE_FILE}...${C_RESET}"

  cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=CyberQuiz RSE - Application de sensibilisation a la cybersecurite
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${CONFIG_FILE}
Environment=NODE_ENV=production
ExecStart=${NODE_BIN} ${INSTALL_DIR}/node_modules/.bin/tsx ${INSTALL_DIR}/server.ts
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cyberquiz

# Mesures de sécurité systemd adaptées au LXC
ProtectSystem=full
ProtectHome=yes
ReadWritePaths=${DATA_DIR}
PrivateTmp=yes
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  echo -e "${C_BLUE}Démarrage du service CyberQuiz...${C_RESET}"
  systemctl restart "${SERVICE_NAME}"
else
  echo -e "${C_YELLOW}systemd désactivé. Lancement manuel de CyberQuiz en tâche de fond...${C_RESET}"
  su -s /bin/bash "${APP_USER}" -c "cd ${INSTALL_DIR} && nohup ${NODE_BIN} ${INSTALL_DIR}/node_modules/.bin/tsx ${INSTALL_DIR}/server.ts > /var/log/cyberquiz.log 2>&1 &"
fi

# ------------------------------------------------------------------------------
# 8. CONTRÔLE DE SANTÉ DU SERVICE (HEALTH CHECK)
# ------------------------------------------------------------------------------
echo -e "${C_BLUE}Vérification du démarrage du service sur /api/health...${C_RESET}"
HEALTH_URL="http://127.0.0.1:${CHOSEN_PORT}/api/health"
MAX_ATTEMPTS=30
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
  echo -e "${C_RED}[ERREUR] Le service ne répond pas sur ${HEALTH_URL} après ${MAX_ATTEMPTS} secondes.${C_RESET}"
  echo "Consultez les journaux du service avec :"
  echo "journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
  exit 1
fi

# Adresse IP locale du conteneur LXC
LXC_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "IP_DU_LXC")

# ------------------------------------------------------------------------------
# 9. RÉSUMÉ DE FIN D'INSTALLATION
# ------------------------------------------------------------------------------
echo -e "${C_GREEN}${C_BOLD}"
echo "=========================================================="
echo "          CYBERQUIZ RSE - INSTALLATION TERMINÉE           "
echo "=========================================================="
echo -e "${C_RESET}"
echo -e "Statut             : ${C_GREEN}${C_BOLD}En ligne (Opérationnel)${C_RESET}"
echo -e "Adresse locale     : ${C_CYAN}http://${CHOSEN_HOST}:${CHOSEN_PORT}${C_RESET}"
echo -e "Adresse dans LXC   : ${C_CYAN}http://${LXC_IP}:${CHOSEN_PORT}${C_RESET}"
if [[ $ALREADY_INSTALLED -eq 1 ]]; then
  echo -e "Compte admin       : ${C_BOLD}Compte existant préservé${C_RESET}"
else
  echo -e "Identifiant admin  : ${C_BOLD}${ADMIN_USERNAME}${C_RESET}"
fi
echo -e "Utilisateur Linux  : ${C_BOLD}${APP_USER}${C_RESET}"
echo -e "Fichiers code      : ${C_BOLD}${INSTALL_DIR}${C_RESET}"
echo -e "Configuration      : ${C_BOLD}${CONFIG_FILE} (chmod 600)${C_RESET}"
echo -e "Base de données    : ${C_BOLD}${DB_FILE}${C_RESET}"
echo -e "Dossier backups    : ${C_BOLD}${BACKUP_DIR}${C_RESET}"
echo -e "Service systemd    : $([[ $SYSTEMD_ENABLED -eq 1 ]] && echo -e "${C_GREEN}Activé (démarrage auto au boot)${C_RESET}" || echo -e "${C_YELLOW}Désactivé${C_RESET}")"
echo ""
echo -e "${C_BOLD}Commandes d'administration :${C_RESET}"
if [[ $SYSTEMD_ENABLED -eq 1 ]]; then
  echo "  Statut du service : systemctl status ${SERVICE_NAME}"
  echo "  Redémarrer        : systemctl restart ${SERVICE_NAME}"
  echo "  Arrêter           : systemctl stop ${SERVICE_NAME}"
  echo "  Démarrer          : systemctl start ${SERVICE_NAME}"
  echo "  Journaux en direct: journalctl -u ${SERVICE_NAME} -f"
fi
echo "  Mettre à jour     : sudo ${INSTALL_DIR}/update.sh"
echo ""
echo -e "${C_CYAN}Configuration Nginx Proxy Manager (sur votre autre hôte) :${C_RESET}"
echo "  Forward Hostname / IP : ${LXC_IP}"
echo "  Forward Port          : ${CHOSEN_PORT}"
echo "  Options recommandées  : Websockets Support, Block Common Exploits, Force SSL"
echo "=========================================================="
