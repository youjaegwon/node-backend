import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import auth from './routes/auth.js';
import markets from './routes/markets.js';
import news from './routes/news.js';
import coins from './routes/coins.js';
import signals from './routes/signals.js';

import { notFound, errorHandler } from './middlewares/error.js';

// Swagger
import { swaggerServe, swaggerSetup } from './swagger.js';

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// APIs
app.use('/api/auth', auth);
app.use('/api/markets', markets);
app.use('/api/news', news);
app.use('/api/coins', coins);
app.use('/api/signals', signals);

// Swagger UI
app.use('/api-docs', swaggerServe, swaggerSetup);

// 404 / error
app.use(notFound);
app.use(errorHandler);

export default app;
