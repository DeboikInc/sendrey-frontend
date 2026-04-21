const axios = require('axios');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { subtle } = require('crypto');


class EmailService {
  constructor() {
    this.apiKey = config.email.elastic.apiKey;
    this.fromEmail = config.email.elastic.from;
    this.fromName = config.email.elastic.fromName;
    this.baseUrl = 'https://api.elasticemail.com/v4';
  }


  /**
 * Compile Handlebars template
 */
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

  /**
   * Send email with attachment
   */
  async sendEmailWithAttachment(to, subject, templateName, data = {}, attachments = []) {
    try {
      const html = await this.compileTemplate(templateName, data);

      // Attachments must be base64 encoded
      const formattedAttachments = attachments.map(att => ({
        Name: att.filename,
        ContentType: att.contentType || 'application/octet-stream',
        Content: att.base64, // Make sure caller provides base64
      }));

      const payload = {
        Recipients: [{ Email: to }],
        Content: {
          From: `${this.fromName} <${this.fromEmail}>`,
          Subject: subject,
          Body: [
            {
              ContentType: 'HTML',
              Charset: 'utf-8',
              Content: html,
            },
          ],
          Options: {
            TrackClicks: false,
          },
          Attachments: formattedAttachments,
        },
      };

      const res = await axios.post(`${this.baseUrl}/emails/transactional`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-ElasticEmail-ApiKey': this.apiKey,
        },
      });

      logger.info(`Email with attachment sent via Elastic Email API to ${to}`, res.data);
      return res.data;
    } catch (error) {
      logger.error('Email with attachment error:', error.response?.data || error.message);
      throw error;
    }
  }


  async sendEmail(to, subject, templateName, data = {}) {
    try {

      const html = await this.compileTemplate(templateName, data);
      console.log('Template compiled successfully');

      const payload = {
        Recipients: { To: [to] },
        Content: {
          From: `${this.fromName} <${this.fromEmail}>`,
          Subject: subject,
          Body: [
            {
              ContentType: 'HTML',
              Charset: 'utf-8',
              Content: html,
            },
          ],
          Options: {
            TrackClicks: false,
          }
        },
      };

      // console.log('Payload:', JSON.stringify(payload, null, 2));
      console.log('Making API request to:', `${this.baseUrl}/emails/transactional`);

      const res = await axios.post(`${this.baseUrl}/emails/transactional`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-ElasticEmail-ApiKey': this.apiKey,
        },
      });

      logger.info(`Email sent via Elastic Email API to ${to}`, res.data);
      return res.data;
    } catch (error) {
      console.error('=== EMAIL ERROR ===');
      console.error('Error response:', error.response?.data);
      console.error('Error message:', error.message);
      console.error('Error status:', error.response?.status);
      console.error('=== EMAIL ERROR END ===');

      logger.error('Email sending error:', error.response?.data || error.message);
      throw new Error('Failed to send email');
    }
  }

  async sendWelcomeEmail(user, token) {
    return this.sendEmail(
      user.email,
      'Welcome to Sendrey',
      'welcome',
      {
        name: user.firstName || user.name,
        loginUrl: `${process.env.FRONTEND_URL}/?token=${token}`,
        supportEmail: process.env.SUPPORT_EMAIL
      }
    );
  }

  async sendTeamInviteEmail(invitee, businessName, role, token) {
    return this.sendEmail(
      invitee.email,
      `You've been invited to join ${businessName} on Sendrey`,
      'teamInvite',
      {
        name: invitee.firstName || invitee.name,
        businessName,
        role,
        year: new Date().getFullYear(),
        loginUrl: `${process.env.FRONTEND_URL}/?invite=${token}`,
        supportEmail: process.env.SUPPORT_EMAIL,
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
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        expiryTime: '1 hour'
      }
    );
  }

  async sendEmailVerification(user, verificationToken) {
    return this.sendEmail(
      user.email,
      'Verify Your Email Address',
      'emailVerification',
      {
        name: user.name,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
        expiryTime: '24 hours'
      }
    );
  }

  async sendPasswordChangedConfirmation(user) {
    return this.sendEmail(
      user.email,
      'Password Changed Successfully',
      'passwordChanged',
      {
        name: user.name,
        timestamp: new Date().toLocaleString(),
        supportUrl: `${process.env.FRONTEND_URL}/support`
      }
    );
  }

  async sendOTPEmail(user, otp,) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`DEV DEBUG: OTP for ${user.email} is ${otp}`);
    }
    const result = this.sendEmail(
      user.email,
      'Your Verification Code',
      'otpEmail',
      {
        name: user.name,
        email:user.email,
        otp: otp,
        expiryTime: '10 minutes'
      }
    );

    return result;
  }

  // Additional email methods
  async sendAdminNotification(subject, message) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      logger.warn('Admin email not configured');
      return;
    }

    return this.sendEmail(
      adminEmail,
      subject,
      'adminNotification',
      { message, timestamp: new Date().toISOString() }
    );
  }

  async sendRefundNotification(user,order){
    return this.sendEmail(
      user.email,
      'Refund Processed — Your funds are back in your wallet',
      'refundNotification',
      {
       name:        user.firstName || user.name,
            amount:      escrow.totalAmount?.toLocaleString(),
            orderId:     escrow.orderId?.orderId || escrow.taskId,
            reason:      escrow.metadata?.refundReason || 'Order cancelled',
            walletBalance: escrow.metadata?.walletBalanceAfter?.toLocaleString(),
            supportEmail: process.env.SUPPORT_EMAIL,
            year:        new Date().getFullYear(),
      }
    ) 
  }
}

module.exports = new EmailService();