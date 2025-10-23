/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: 인증/인가
 *   - name: System
 *     description: 시스템/헬스체크
 */

/**
 * @swagger
 * /api/healthz:
 *   get:
 *     tags: [System]
 *     summary: 헬스 체크
 *     responses:
 *       200:
 *         description: ok (text)
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: 회원가입
 *     security: []        # 공개 엔드포인트
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, password]
 *             properties:
 *               email: { type: string, format: email }
 *               name:  { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: 가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *       400: { description: 잘못된 요청 }
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 로그인 (AT/RT 발급)
 *     security: []        # 공개 엔드포인트
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: 로그인 성공(토큰 발급)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *       401: { description: 인증 실패 }
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: 리프레시 토큰으로 토큰 재발급(회전)
 *     security: []        # 공개 엔드포인트(바디로 RT 제출)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: 재발급 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *       400: { description: 잘못된 토큰 }
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: 현재 리프레시 토큰 무효화
 *     security: []        # 공개 엔드포인트(바디로 RT 제출)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: ok }
 */

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: 모든 기기 로그아웃 (AT 필요)
 *     responses:
 *       200: { description: ok }
 *       401: { description: 인증 필요 }
 */

/**
 * @swagger
 * /api/me:
 *   get:
 *     tags: [Auth]
 *     summary: 내 정보 (AT 필요)
 *     responses:
 *       200:
 *         description: 사용자 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *       401: { description: 인증 필요 }
 */
