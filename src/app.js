import express from 'express';
import auth from './routes/auth.js';
import errorHandler from './middlewares/error.js';

const app = express();
app.use(express.json());

// 헬스체크
app.get('/api/healthz', (req, res) => res.type('text').send('ok'));

// API
app.use('/api/auth', auth);

// 404
app.use((req, res) => res.status(404).json({ ok:false, code:'E_NOT_FOUND' }));

// 공통 에러 처리
app.use(errorHandler);

export default app;
