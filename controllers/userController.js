const BaseController = require('./baseController');
const userService = require('../services/userService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  async createUser(req, res, next) {
    try {
      const userData = req.body;
      const user = await this.service.createUser(userData);

      // Send welcome communications
      await Promise.all([
        emailService.sendWelcomeEmail(user),
        smsService.sendWelcomeSMS(user.phone, user.name)
      ]);

      this.created(res, user, 'User created successfully');
    } catch (error) {
      next(error);
    }
  }

  async sendOTP(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await this.service.getUserById(userId);
      const otp = await this.service.generateOTP(userId);

      await smsService.sendOTP(user.phone, otp);

      this.success(res, null, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();