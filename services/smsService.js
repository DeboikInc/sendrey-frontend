const twilio = require('twilio');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.isConfigured = false;
    this.provider = config.sms?.provider;

    if (this.provider === 'twilio') {
      const twilioConfig = config.sms?.twilio;

      if (twilioConfig?.accountSid && twilioConfig?.authToken && twilioConfig?.fromNumber) {
        this.client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
        this.fromNumber = twilioConfig.fromNumber;
        this.isConfigured = true;
        logger.info('Twilio SMS service initialized successfully');
      } else {
        logger.error('Twilio configuration incomplete:', {
          hasAccountSid: !!twilioConfig?.accountSid,
          hasAuthToken: !!twilioConfig?.authToken,
          hasFromNumber: !!twilioConfig?.fromNumber
        });
      }
    }
  }

  /**
   * Format phone number to E.164 format for Twilio
   * Converts local Nigerian numbers to international format
   */
  formatPhoneNumber(phoneNumber) {
    let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // If it starts with 0 (like 09025127581), convert to +234
    if (cleaned.startsWith('0')) {
      return '+234' + cleaned.substring(1);
    }

    // If it starts with 234 without +, add +
    if (cleaned.startsWith('234') && !cleaned.startsWith('+234')) {
      return '+' + cleaned;
    }

    // If it already has +, return as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    return '+234' + cleaned;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber) {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Basic E.164 validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(formatted);
  }

  async compileSMSTemplate(templateName, data) {
    try {
      const templatePath = path.join(__dirname, '../templates/sms', `${templateName}.txt`);
      let templateContent = await fs.readFile(templatePath, 'utf-8');

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
      if (!this.isConfigured) {
        return { development: true, message: 'SMS not configured' };
      }

      const formattedTo = this.formatPhoneNumber(to);
      console.log('Sending SMS - To:', formattedTo, 'From:', this.fromNumber);

      if (!this.validatePhoneNumber(formattedTo)) {
        throw new Error(`Invalid phone number: ${formattedTo}`);
      }

      const message = await this.compileSMSTemplate(templateName, data);

      const result = await this.client.messages.create({
        to: formattedTo,
        from: this.fromNumber,
        body: message,
      });

      logger.info(`SMS sent: ${result.sid}`);
      return result;

    } catch (error) {
      // Twilio-specific error
      if (error.code) {
        logger.error('Twilio SMS error:', {
          code: error.code,
          message: error.message,
          moreInfo: error.moreInfo,
          status: error.status,
        });

        // Common Twilio error codes
        const twilioErrors = {
          21211: 'Invalid phone number',
          21214: 'Phone number not verified (trial account)',
          21408: 'SMS not supported for this region',
          21610: 'Number is blacklisted/unsubscribed',
          21614: 'Not a mobile number',
          30003: 'Unreachable destination handset',
          30004: 'Message blocked',
          30005: 'Unknown destination handset',
          30006: 'Landline or unreachable carrier',
        };

        const friendlyMessage = twilioErrors[error.code] || `Twilio error ${error.code}`;
        logger.error(`Twilio error reason: ${friendlyMessage}`);
        return { error: true, code: error.code, message: friendlyMessage };
      }

      // Generic error
      logger.error('SMS sending error:', { message: error.message, stack: error.stack, code: error.code });
      return { error: true, message: error.message };
    }
  }

  // Specific SMS methods
  async sendOTP(phoneNumber, otpCode) {
    console.log(`Attempting to send OTP to: ${phoneNumber}, Formatted: ${this.formatPhoneNumber(phoneNumber)}`);

    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 DEVELOPMENT MODE: OTP for ${phoneNumber} is ${otpCode}`);
      console.log(`Use this OTP to verify: ${otpCode}`);
      console.log('at sms service line 129, dont forget to change back for prod')
      return {
        development: true,
        otp: otpCode,
        phone: phoneNumber
      };
    }

    if (!this.isConfigured) {
      logger.warn('SMS not configured - would send OTP:', { phoneNumber, otpCode });
      if (process.env.NODE_ENV === 'development') {
        console.log(`📱 DEVELOPMENT: OTP for ${phoneNumber} is ${otpCode}`);
        return { development: true, otp: otpCode };
      }
      throw new Error('SMS provider not configured');
    }

    return this.sendSMS(phoneNumber, 'otp', {
      code: otpCode,
      expiry: '10 minutes'
    });
  }

  async sendPasswordResetSMS(phoneNumber, resetToken) {
    if (!this.isConfigured) {
      logger.warn('SMS not configured - skipping password reset SMS');
      if (process.env.NODE_ENV === 'development') {
        console.log(`📱 DEVELOPMENT: Password reset token for ${phoneNumber} is ${resetToken}`);
        return { development: true, token: resetToken };
      }
      throw new Error('SMS provider not configured');
    }

    return this.sendSMS(phoneNumber, 'passwordReset', {
      code: resetToken,
      expiry: '1 hour'
    });
  }

  async sendAlertSMS(phoneNumber, alertData) {
    if (!this.isConfigured) {
      logger.warn('SMS not configured - skipping alert SMS');
      return;
    }
    return this.sendSMS(phoneNumber, 'alert', alertData);
  }
}

module.exports = new SMSService();