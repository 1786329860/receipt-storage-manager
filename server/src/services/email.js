import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 验证码存储：内存 Map，key=email, value={code, expiresAt}
const codeStore = new Map();
const CODE_TTL = 5 * 60 * 1000; // 5分钟有效
const CODE_INTERVAL = 60 * 1000; // 60秒发送间隔

// 生成6位数字验证码
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 发送邮件验证码
export async function sendVerificationCode(email) {
  // 检查发送频率
  const existing = codeStore.get(email);
  if (existing && Date.now() - existing.createdAt < CODE_INTERVAL) {
    const wait = Math.ceil((CODE_INTERVAL - (Date.now() - existing.createdAt)) / 1000);
    throw { status: 429, message: `发送太频繁，请 ${wait} 秒后重试` };
  }

  const code = generateCode();

  // 存储验证码
  codeStore.set(email, {
    code,
    expiresAt: Date.now() + CODE_TTL,
    createdAt: Date.now(),
  });

  // 发送邮件
  try {
    await transporter.sendMail({
      from: `"小票收纳小管家" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '邮箱验证码 - 小票收纳小管家',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <h2 style="color:#4f46e5;margin-bottom:8px;">小票收纳小管家</h2>
          <p style="color:#64748b;font-size:14px;">你正在注册账号，验证码为：</p>
          <div style="background:#f8fafc;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e293b;">${code}</span>
          </div>
          <p style="color:#94a3b8;font-size:12px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
        </div>
      `,
    });
    console.log(`[Email] 验证码已发送至 ${email}`);
  } catch (err) {
    console.error('[Email] 发送失败:', err.message);
    codeStore.delete(email);
    throw { status: 500, message: '邮件发送失败，请稍后重试' };
  }
}

// 验证验证码
export function verifyCode(email, code) {
  const stored = codeStore.get(email);
  if (!stored) {
    return false;
  }
  if (Date.now() > stored.expiresAt) {
    codeStore.delete(email);
    return false;
  }
  if (stored.code !== code) {
    return false;
  }
  // 验证成功后删除
  codeStore.delete(email);
  return true;
}
