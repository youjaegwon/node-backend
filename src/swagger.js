import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
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
  apis: ['./src/routes/*.js'], // ✅ Swagger JSDoc 읽을 경로
};

export const swaggerSpec = swaggerJSDoc(options);
export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true },
});
