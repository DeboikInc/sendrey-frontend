const twilio = require('twilio');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    if (config.sms.provider === 'twilio') {
      this.client = twilio(config.sms.twilio.accountSid, config.sms.twilio.authToken);
    }
  }

  async compileSMSTemplate(templateName, data) {
    try {

      const templatePath = path.join(__dirname, '../templates/sms', `${templateName}.txt`);
      let templateContent = await fs.readFile(templatePath, 'utf-8');

      // Simple template replacement
      Object.keys(data).forEach(key => {
        templateContent = templateContent.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
      });

      return templateContent;
    } catch (error) {
      logger.error('SMS template compilation error:', error);
      throw new Error(`Failed to compile SMS template: ${templateName}`);
    }
  }

  async sendSMS(to, templateName, data = {}) {
    try {
      const message = await this.compileSMSTemplate(templateName, data);

      if (config.sms.provider === 'twilio') {
        
        const result = await this.client.messages.create({
          to,
          from: config.sms.twilio.fromNumber,
          body: message,
        });
        
        logger.info(`SMS sent to ${to}: ${result.sid}`);
        return result;
      }

      // Add other SMS providers here
      throw new Error('SMS provider not configured');
    } catch (error) {
      logger.error('SMS sending error:', error);
      throw new Error('Failed to send SMS', error);
    }
  }

  // Specific SMS methods
  async sendWelcomeSMS(phoneNumber, userName) {
    return this.sendSMS(phoneNumber, 'welcome', {
      name: userName,
      supportPhone: process.env.SUPPORT_PHONE
    });
  }


  async sendPasswordResetSMS(phoneNumber, resetToken) {
    return this.sendSMS(
      phoneNumber,
      'Password Reset Request',
      {
        code: resetToken,
        expiry: '1 hour'
      }
    );
  }

  async sendOTP(phoneNumber, otpCode) {
    return this.sendSMS(phoneNumber, 'otp', {
      code: otpCode,
      expiry: '10 minutes'
    });
  }

  async sendAlertSMS(phoneNumber, alertData) {
    return this.sendSMS(phoneNumber, 'alert', alertData);
  }
}

module.exports = new SMSService();