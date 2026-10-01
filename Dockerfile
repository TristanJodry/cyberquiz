# ==============================================================================
# Dockerfile - CyberQuiz RSE (Production Debian / Nginx Proxy Manager)
# ==============================================================================

# Étape 1 : Construction des artefacts statiques frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Copie des descripteurs de paquets
COPY package.json ./

# Installation des dépendances complètes
RUN npm install

# Copie du code source
COPY . .

# Compilation Vite pour production dans /app/dist
RUN npm run build

# Étape 2 : Image d'exécution légère et sécurisée
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Outil d'exécution TypeScript pour le backend Express
RUN npm install -g tsx

# Copie et installation des modules de production
COPY package.json ./
RUN npm install --omit=dev

# Copie du bundle de production frontend et du backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/schema.sql ./schema.sql

# Dossier persistant pour la base de données SQL
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

# Port d'écoute configurable (par défaut 3000)
EXPOSE 3000

# Volume de persistance pour les données
VOLUME ["/app/data"]

# Commande de lancement
CMD ["tsx", "server.ts"]
