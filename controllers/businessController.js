const BaseController = require('./baseController');
const {
  getSuggestionStatus,
  dismissSuggestion,
  acknowledgeSuggestion,
  adminGetAllSuggestions,
  adminGetSuggestionStats
} = require('../services/businessService');

class BusinessSuggestionController extends BaseController {
  constructor() {
    super(null);
    this.getStatus = this.getStatus.bind(this);
    this.dismiss = this.dismiss.bind(this);
    this.acknowledge = this.acknowledge.bind(this);
    this.adminGetAll = this.adminGetAll.bind(this);
    this.adminGetStats = this.adminGetStats.bind(this);
  }

  // GET /business-suggestion/status
  // Frontend calls this on app load / when entering pickup or errand screen
  async getStatus(req, res) {
    try {
      const result = await getSuggestionStatus(req.user._id);
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // POST /business-suggestion/dismiss
  // User tapped "Not interested"
  async dismiss(req, res) {
    try {
      const result = await dismissSuggestion(req.user._id);
      return this.success(res, result, 'Suggestion dismissed');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // POST /business-suggestion/acknowledge
  // User tapped "Continue" — they're heading into conversion flow
  async acknowledge(req, res) {
    try {
      await acknowledgeSuggestion(req.user._id);
      return this.success(res, null, 'Acknowledged');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }


  // ADMIN ACTIONS
  async adminGetAll(req, res) {
    try {
      const { page, limit, filter } = req.query;
      const result = await adminGetAllSuggestions({ page, limit, filter });
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async adminGetStats(req, res) {
    try {
      const result = await adminGetSuggestionStats();
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

}

module.exports = new BusinessSuggestionController();