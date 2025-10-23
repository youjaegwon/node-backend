import { err, ok } from '../error-util.js'
import bcrypt from 'bcrypt'

export default function registerRegisterRoute(app, prisma) {
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body || {}
      if (!email || !password) {
        return err(res, 400, 'VALIDATION_REQUIRED', '이메일과 비밀번호를 입력해주세요.')
      }
      if (password.length < 8) {
        return err(res, 400, 'PASSWORD_TOO_SHORT', '비밀번호는 8자 이상이어야 합니다.')
      }

      const exist = await prisma.user.findUnique({ where: { email } })
      if (exist) {
        return err(res, 409, 'EMAIL_TAKEN', '이미 가입된 이메일입니다.')
      }

      const hash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { email, passwordHash: hash, name: name || null },
        select: { id: true, email: true, name: true }
      })
      return ok(res, { user })
    } catch (e) {
      console.error(e)
      return err(res, 500, 'SERVER_ERROR', '서버 오류가 발생했습니다.')
    }
  })
}
