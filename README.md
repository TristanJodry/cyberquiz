# CyberQuiz RSE — Sensibilisation à la Cybersécurité & Mesure d'Impact

Application web moderne, sécurisée et ergonomique de quiz interactif pour sensibiliser les collaborateurs à leur rôle individuel dans la sécurité informatique de leur entreprise. Conçue pour une démarche **RSE (Responsabilité Sociétale des Entreprises)** et de **citoyenneté numérique**.

Ce projet est configuré pour un déploiement natif dans un **conteneur LXC non privilégié Debian 13 (Proxmox VE)**, sans Docker, avec un service `systemd` dédié et une base de données persistante SQLite.

---

## 1. Architecture Technique & FHS Linux

- **Frontend :** React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti. Interface réactive et accessible, optimisée ordinateurs, tablettes et smartphones.
- **Backend :** Node.js LTS avec Express, API REST complète, contrôle de santé `/api/health`, authentification JWT, protection anti-bruteforce, hashage bcrypt.
- **Base de Données SQL :** Moteur relationnel SQL persistant SQLite normalisé (`administrateurs`, `participants`, `questions`, `versions_questions`, `propositions`, `participations`, `reponses_utilisateurs`, `rex`, `parametres`, `tentatives_connexion`, `migrations`).
- **Arborescence FHS sur le conteneur LXC :**
  - **Code applicatif :** `/opt/cyberquiz/` (propriétaire `cyberquiz:cyberquiz`, permissions 750)
  - **Données persistantes :** `/var/lib/cyberquiz/cyberquiz.db` (permissions 700)
  - **Configuration sensible :** `/etc/cyberquiz/cyberquiz.env` (permissions 600)
  - **Sauvegardes automatiques :** `/var/backups/cyberquiz/` (permissions 700)
  - **Service systemd :** `/etc/systemd/system/cyberquiz.service` (exécuté sans privilèges sous l'utilisateur `cyberquiz`)
- **Versioning des Questions :** Toute modification d'une question ayant déjà été répondue crée automatiquement une nouvelle version (`v2`, `v3`...) afin de garantir l'immutabilité historique des scores et statistiques.

---

## 2. Déploiement dans un Conteneur LXC Debian 13 (Proxmox VE)

### 2.1. Création du Conteneur LXC sur Proxmox
1. Créez un conteneur LXC avec le template **Debian 12** ou **Debian 13**.
2. Décochez la case "Privileged container" (un conteneur **non privilégié** est plus sécurisé).
3. Allouez au minimum **1 CPU**, **1 Go de RAM** et **8 Go d'espace disque**.
4. Configurez son adresse IP statique ou DHCP (ex: `192.168.1.150`).
5. Démarrez le conteneur et connectez-vous en console root ou via SSH.

---

### 2.2. Installation Initiale Automatique (`install.sh`)

Dans le conteneur LXC, clonez le dépôt et lancez l'installateur interactif :

```bash
apt-get update && apt-get install -y git
git clone https://github.com/VOTRE_COMPTE/VOTRE_DEPOT.git /opt/cyberquiz
cd /opt/cyberquiz
chmod +x install.sh update.sh
sudo ./install.sh
```

L'installateur interactif prend tout en charge automatiquement :
1. **Contrôle et paquets :** Installe Git, Node.js 22 LTS, npm, sqlite3, build-essential si nécessaires.
2. **Réseau :** Demande le port d'écoute (`3000` par défaut) et l'interface (`0.0.0.0` pour être accessible par votre Nginx Proxy Manager hébergé sur une autre machine).
3. **Sécurité :** Crée l'utilisateur système dédié `cyberquiz` (sans accès shell interactif).
4. **Administrateur :** Demande votre identifiant et votre mot de passe administrateur sécurisé (saisie masquée, min 8 caractères).
5. **Secrets cryptographiques :** Génère un `JWT_SECRET` de 256 bits via OpenSSL et protège `/etc/cyberquiz/cyberquiz.env` en `chmod 600`.
6. **Compilation :** Installe les dépendances npm (`npm ci`) et compile le bundle React (`npm run build`).
7. **Service systemd :** Installe et active `cyberquiz.service` pour un démarrage automatique au boot du LXC.
8. **Vérification en direct :** Teste `/api/health` et affiche le résumé avec les accès et commandes utiles.

---

### 2.3. Mises à Jour Automatisées (`update.sh`)

Pour déployer les modifications poussées sur GitHub depuis Google AI Studio :

```bash
cd /opt/cyberquiz
sudo ./update.sh
```

Le script de mise à jour exécute la séquence suivante :
1. Vérifie le dépôt Git et s'assure qu'aucune modification locale non enregistrée ne risque d'être écrasée.
2. Détecte les nouveaux commits sur GitHub (`git fetch`). Si le code est déjà à jour, il quitte sans redémarrage superflu.
3. **Sauvegarde préventivement la base SQLite** (checkpoint WAL inclus) et la configuration dans `/var/backups/cyberquiz/cyberquiz_YYYY-MM-DD_HHMMSS.db`.
4. Récupère le nouveau code avec `git pull --ff-only`.
5. Met à jour les dépendances (`npm ci`) et recompile le frontend (`npm run build`).
6. Redémarre le service `systemctl restart cyberquiz.service`.
7. Vérifie l'état opérationnel via `/api/health`.

---

## 3. Configuration Nginx Proxy Manager (Hôte Externe)

Puisque Nginx Proxy Manager est hébergé sur une autre machine de votre réseau :

1. Ouvrez l'interface web de votre **Nginx Proxy Manager**.
2. Rendez-vous dans **Proxy Hosts** > **Add Proxy Host**.
3. Renseignez les paramètres suivants :
   - **Domain Names :** `quiz.votre-domaine.fr`
   - **Scheme :** `http`
   - **Forward Hostname / IP :** L'adresse IP de votre conteneur LXC (ex: `192.168.1.150`)
   - **Forward Port :** `3000` (ou le port choisi lors de l'installation)
   - Cochez **Websockets Support**
   - Cochez **Block Common Exploits**
4. Dans l'onglet **SSL** :
   - Choisissez ou générez votre certificat Let's Encrypt
   - Cochez **Force SSL**, **HTTP/2 Support**, **HSTS Enabled**.
5. Enregistrez : l'application est immédiatement accessible en HTTPS.

---

## 4. Commandes d'Exploitation du Service

Toutes les opérations d'exploitation se font nativement via `systemctl` :

```bash
# Vérifier le statut en temps réel
sudo systemctl status cyberquiz

# Redémarrer l'application
sudo systemctl restart cyberquiz

# Arrêter l'application
sudo systemctl stop cyberquiz

# Démarrer l'application
sudo systemctl start cyberquiz

# Suivre les journaux d'exécution en continu
sudo journalctl -u cyberquiz -f
```

---

## 5. Sauvegarde & Procédure de Restauration

### Sauvegarde Manuelle
Des sauvegardes automatiques sont créées dans `/var/backups/cyberquiz/` à chaque mise à jour. Pour déclencher une sauvegarde manuelle à chaud :

```bash
sudo sqlite3 /var/lib/cyberquiz/cyberquiz.db "PRAGMA wal_checkpoint(TRUNCATE);"
sudo sqlite3 /var/lib/cyberquiz/cyberquiz.db ".backup '/var/backups/cyberquiz/cyberquiz_manuel_$(date +%Y%m%d_%H%M%S).db'"
```

### Procédure de Restauration (Rollback)
Si une mise à jour doit être annulée :
1. Arrêtez le service :
   ```bash
   sudo systemctl stop cyberquiz
   ```
2. Restaurez la base SQLite sauvegardée :
   ```bash
   sudo cp /var/backups/cyberquiz/cyberquiz_CHOISIE.db /var/lib/cyberquiz/cyberquiz.db
   sudo chown cyberquiz:cyberquiz /var/lib/cyberquiz/cyberquiz.db
   ```
3. Si nécessaire, replacez le code source sur le commit précédent :
   ```bash
   cd /opt/cyberquiz
   sudo git checkout COMMIT_PRECEDENT
   sudo npm ci && sudo npm run build
   ```
4. Redémarrez le service :
   ```bash
   sudo systemctl start cyberquiz
   ```

---

## 6. Sécurité

- Aucun conteneur Docker ni socket Docker exposé dans le LXC.
- Processus Node.js exécuté sous un utilisateur système non privilégié (`cyberquiz`).
- Durcissement systemd actif (`ProtectSystem=full`, `ProtectHome=yes`, `NoNewPrivileges=yes`).
- Hashage des mots de passe administrateurs en **bcrypt** (sel aléatoire 10 tours).
- Protection anti-bruteforce active : 5 échecs consécutifs entraînent un blocage temporaire de l'IP pendant 15 minutes.
- Données nominatives et mode anonyme strictement cloisonnés.
