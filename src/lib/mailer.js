import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

const MAIL_HOST = process.env.MAIL_HOST || '';
const MAIL_PORT = Number(process.env.MAIL_PORT || 587);
const MAIL_USER = process.env.MAIL_USER || '';
const MAIL_PASS = process.env.MAIL_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || MAIL_USER || 'no-reply@example.com';

let transporter = null;
if (MAIL_HOST && MAIL_USER && MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_PORT === 465,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
}

// 실제 메일 전송(프로덕션) 또는 파일로 저장(개발)
export async function sendMail({ to, subject, html, text }) {
  if (transporter) {
    const info = await transporter.sendMail({ from: MAIL_FROM, to, subject, html, text });
    return { sent: true, messageId: info.messageId };
  } else {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${ts}-${(to||'unknown').replace(/[^a-zA-Z0-9@._-]/g,'_')}.txt`;
    const outPath = path.join(process.cwd(), 'tmp_mails', name);
    const body = [
      `TO: ${to}`,
      `SUBJECT: ${subject}`,
      '',
      text || '',
      '',
      '--- HTML ---',
      html || ''
    ].join('\n');
    fs.writeFileSync(outPath, body);
    return { sent: false, file: outPath };
  }
}
