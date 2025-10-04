const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: config.email.service,
      host: config.email.host,
      port: config.email.port,
      secure: false,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }

  async compileTemplate(templateName, data) {
    try {
      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);
      return template(data);
    } catch (error) {
      logger.error('Template compilation error:', error);
      throw new Error(`Failed to compile template: ${templateName}`);
    }
  }

  async sendEmail(to, subject, templateName, data = {}) {
    try {
      const html = await this.compileTemplate(templateName, data);

      const mailOptions = {
        from: config.email.from,
        to,
        subject,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${result.messageId}`);
      return result;
    } catch (error) {
      logger.error('Email sending error:', error);
      throw new Error('Failed to send email');
    }
  }

  // Specific email methods
  async sendWelcomeEmail(user) {
    return this.sendEmail(
      user.email,
      'Welcome to Our Platform',
      'welcome',
      {
        name: user.name,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    );
  }

  async sendPasswordResetEmail(user, resetToken) {
    return this.sendEmail(
      user.email,
      'Password Reset Request',
      'passwordReset',
      {
        name: user.name,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    );
  }
}

module.exports = new EmailService();