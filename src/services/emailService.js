const nodemailer = require('nodemailer');

// Create reusable transporter object
let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  };

  // Only create transporter if SMTP credentials are configured
  if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.warn('SMTP credentials not configured. Email functionality will be disabled.');
    return null;
  }

  transporter = nodemailer.createTransport(smtpConfig);
  return transporter;
};

const sendPasswordResetEmail = async (email, resetUrl) => {
  const transport = getTransporter();

  if (!transport) {
    console.error('Email transporter not available. Cannot send password reset email.');
    throw new Error('이메일 서비스가 설정되지 않았습니다');
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'VCC Manager';

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: '[VCC Manager] 비밀번호 재설정',
    html: `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>비밀번호 재설정</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background-color: #1976d2;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">VCC Manager</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 20px;">비밀번호 재설정</h2>
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                안녕하세요,
              </p>
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                비밀번호 재설정을 요청하셨습니다.<br>
                아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 20px 0; text-align: center;">
                    <a href="${resetUrl}"
                       style="display: inline-block; padding: 14px 30px; background-color: #1976d2; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">
                      비밀번호 재설정하기
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                이 링크는 <strong>1시간 후</strong>에 만료됩니다.
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0;">
                비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해주세요.<br>
                계정은 안전하게 보호됩니다.
              </p>
              <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
              <p style="color: #999999; font-size: 11px; line-height: 1.6; margin: 0;">
                버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
                <a href="${resetUrl}" style="color: #1976d2; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #f5f5f5; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                감사합니다.<br>
                VCC Manager 팀
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
비밀번호 재설정

안녕하세요,

비밀번호 재설정을 요청하셨습니다.
아래 링크를 클릭하여 새 비밀번호를 설정해주세요.

${resetUrl}

이 링크는 1시간 후에 만료됩니다.

비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해주세요.
계정은 안전하게 보호됩니다.

감사합니다.
VCC Manager 팀
    `
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('이메일 발송에 실패했습니다');
  }
};

module.exports = {
  sendPasswordResetEmail
};
