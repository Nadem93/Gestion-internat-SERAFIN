import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { authRouter } from './routes/auth';
import { residentsRouter } from './routes/residents';
import { journalRouter } from './routes/journal';
import { planningRouter } from './routes/planning';
import { presencesRouter } from './routes/presences';
import { adminRouter } from './routes/admin';
import { establishmentsRouter } from './routes/establishments';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(config.uploadDir)));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/establishments', establishmentsRouter);
app.use('/api/residents', residentsRouter);
app.use('/api/journal', journalRouter);
app.use('/api/planning', planningRouter);
app.use('/api/presences', presencesRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`🚀 Gestio-ESMS API running on http://localhost:${config.port}`);
  console.log(`📦 Database: ${process.env.DATABASE_URL || 'sqlite'}`);
});
