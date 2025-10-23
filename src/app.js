import express from 'express';
import { swaggerServe, swaggerSetup } from './swagger.js';
import passwordRoutes from './routes/password.js';
import emailRoutes from './routes/email.js';
import morgan from 'morgan';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import versionRoutes from './routes/version.js';

const app = express();

// 미들웨어
app.use(morgan('tiny'));
app.use(express.json());
app.use(cors());

// 라우트
app.use('/api-docs', swaggerServe, swaggerSetup);
app.use('/api', healthRoutes);
app.use('/api', versionRoutes);
app.use('/api/auth', emailRoutes);
app.use('/api/auth', authRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

export default app;
