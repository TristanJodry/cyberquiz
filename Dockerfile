# ==============================================================================
# Dockerfile - CyberQuiz RSE
# Image multi-étape légère, sécurisée et optimisée pour la production
# ==============================================================================

# ------------------------------------------------------------------------------
# Étape 1 : Construction du Frontend (React 19 + Tailwind CSS + Vite)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances complètes (dont Vite et le compilateur TypeScript)
RUN npm install

# Copie de l'intégralité du code source
COPY . .

# Construction du bundle statique optimisé dans /app/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Étape 2 : Image d'Exécution Minimale (Production Runner)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Définition des variables d'environnement
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CYBERQUIZ_DATA_DIR=/app/data

# Outil d'exécution TypeScript direct pour le backend Express
RUN npm install -g tsx

# Copie et installation stricte des dépendances de production uniquement
COPY package*.json ./
RUN npm install --omit=dev

# Copie du bundle frontend compilé
COPY --from=builder /app/dist ./dist

# Copie des sources du backend Express & de la base de données SQLite
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/schema.sql ./schema.sql
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Création du répertoire de données persistantes avec permissions pour l'utilisateur node
RUN mkdir -p /app/data && chown -R node:node /app

# Exécution sous utilisateur non-root pour la sécurité
USER node

# Port d'écoute du serveur applicatif
EXPOSE 3000

# Volume de persistance pour la base SQLite et ses sauvegardes
VOLUME ["/app/data"]

# Contrôle de santé interne du conteneur
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Démarrage du serveur CyberQuiz
CMD ["tsx", "server.ts"]
