import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import news from './routes/news.js';
import auth from './routes/auth.js';
import markets from './routes/markets.js';
import { notFound, errorHandler } from './middlewares/error.js';

// Swagger
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JCoin API Docs',
      version: '1.0.0',
      description: 'JCoin 백엔드 API 명세서',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'], // <-- Swagger 주석 읽는 위치
});

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', auth);
app.use('/api/markets', markets);
app.use('/api/news', news);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

export default app;
