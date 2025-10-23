import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import auth from './routes/auth.js';
import { notFound, errorHandler } from './middlewares/error.js';

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', auth);

app.use(notFound);
app.use(errorHandler);

export default app;
