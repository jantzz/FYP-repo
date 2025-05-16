const nodemailer = require('nodemailer');
// npm install nodemailer
const user = 'employeesmartroster@gmail.com';
const pass = 'xuny louc xvzq kvue';
// Create an SMTP Transport (Gmail)
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    pool: true,  // 启用连接池
    maxConnections: 3,  // 限制并发连接数
    auth: {
        user: user, // Your Gmail address
        pass: pass // Your Gmail application specific password
    },
});
/**
 * send mail
 * @param {string} to Recipient email
 * @param {string} text Email body (plain text)
 */
async function sendEmail(to, text) {
    const mailOptions = {
        from: user, // Sender Information
        to, // Recipient Address
        subject:'notice',
        text // Plain text content
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('Email sending failed:', error);
    }
}

module.exports = { sendEmail };

// sendEmail('454112944@qq.com','Scheduling reminder');
