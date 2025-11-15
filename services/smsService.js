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
      if (config.sms.twilio?.accountSid && config.sms.twilio?.authToken) {
        this.client = twilio(config.sms.twilio.accountSid, config.sms.twilio.authToken);
        this.isConfigured = true;
        logger.info('Twilio SMS service initialized successfully');
      } else {
        logger.error('Twilio configuration incomplete - missing accountSid or authToken');
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
        throw new Error('SMS provider not configured properly');
      }

      const formattedTo = this.formatPhoneNumber(to);
      
      // Validate the formatted number
      if (!this.validatePhoneNumber(to)) {
        throw new Error(`Invalid phone number format: ${to} (formatted as: ${formattedTo})`);
      }

      const message = await this.compileSMSTemplate(templateName, data);

      console.log(`Sending SMS to: ${formattedTo} (original: ${to})`);

      if (this.provider === 'twilio' && this.client) {
        const result = await this.client.messages.create({
          to: formattedTo,
          from: config.sms.twilio.fromNumber,
          body: message,
        });
        
        logger.info(`SMS sent to ${formattedTo}: ${result.sid}`);
        return result;
      }

      throw new Error(`SMS provider '${this.provider}' not supported`);
    } catch (error) {
      logger.error('SMS sending error:', {
        errorMessage: error.message,
        errorCode: error.code,
        phoneNumber: to
      });
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  // Specific SMS methods
  async sendOTP(phoneNumber, otpCode) {
    console.log(`Attempting to send OTP to: ${phoneNumber}, Formatted: ${this.formatPhoneNumber(phoneNumber)}`);
    
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