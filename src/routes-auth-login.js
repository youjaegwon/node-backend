import { err, ok } from '../error-util.js'
import bcrypt from 'bcrypt'

export default function registerLoginRoute(app, prisma, signJwt) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {}
      if (!email || !password) {
        return err(res, 400, 'VALIDATION_REQUIRED', '이메일과 비밀번호를 입력해주세요.')
      }

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return err(res, 401, 'AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
      }

      const okPw = await bcrypt.compare(password, user.passwordHash)
      if (!okPw) {
        return err(res, 401, 'AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
      }

      if (user.status === 'blocked') {
        return err(res, 403, 'AUTH_BLOCKED', '차단된 계정입니다. 관리자에게 문의해주세요.')
      }

      const accessToken = signJwt({ uid: user.id })
      return ok(res, { accessToken, user: { id: user.id, email: user.email, name: user.name } })
    } catch (e) {
      console.error(e)
      return err(res, 500, 'SERVER_ERROR', '서버 오류가 발생했습니다.')
    }
  })
}
