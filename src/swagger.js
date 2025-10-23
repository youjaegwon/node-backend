import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'MyApp API Docs', version: '1.0.0', description: '백엔드 API 명세서' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    // 전역 기본 보안 (개별 경로에서 해제 가능)
    security: [{ bearerAuth: [] }],
  },
  // 주석만 담긴 paths 파일 및 라우트 폴더 스캔
  apis: ['./src/swagger.paths.js', './src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true }
});
