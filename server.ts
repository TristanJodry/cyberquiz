import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/api.js';
import { getDatabase } from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.APP_PORT || process.env.PORT || '3000', 10);
  const HOST = process.env.APP_HOST || process.env.HOST || '0.0.0.0';

  // Initialisation de la base de données SQL
  await getDatabase();

  // Middlewares de sécurité et parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes d'API
  app.use('/api', apiRouter);

  // Intégration Vite en développement / Servir le build en production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`[CyberQuiz] Serveur actif sur http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[CyberQuiz] Erreur fatale au démarrage du serveur:', err);
  process.exit(1);
});
