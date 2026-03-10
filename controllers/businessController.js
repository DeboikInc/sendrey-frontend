const BaseController = require('./baseController');
const {
  convertToBusiness,
  inviteMember,
  removeMember,
  getTeamMembers,
  generateExpenseReport,
  getReports,
  exportReportCSV,
  exportReportPDF,

  createSchedule,
  getSchedules,
  deleteSchedule,
  updateScheduleStatus,
  respondToInvite,
  getSuggestionStatus,
  dismissSuggestion,
  acknowledgeSuggestion,


  adminGetAllSuggestions,
  adminGetSuggestionStats,
  adminResetOptOut,
  adminForceSuggest,
  adminGetAllBusinesses,
  adminGetBusiness,
  adminConvertToBusiness,
  adminRevokeBusiness,
} = require('../services/businessService');

class BusinessController extends BaseController {
  constructor() {
    super(null);
    this.convertToBusiness = this.convertToBusiness.bind(this);
    this.getTeamMembers = this.getTeamMembers.bind(this);
    this.inviteMember = this.inviteMember.bind(this);
    this.removeMember = this.removeMember.bind(this);
    this.getReports = this.getReports.bind(this);
    this.generateExpenseReport = this.generateExpenseReport.bind(this);
    this.createSchedule = this.createSchedule.bind(this);
    this.updateScheduleStatus = this.updateScheduleStatus.bind(this);
    this.respondToInvite = this.respondToInvite.bind(this);
    this.getSchedules = this.getSchedules.bind(this);
    this.deleteSchedule = this.deleteSchedule.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.dismiss = this.dismiss.bind(this);
    this.acknowledge = this.acknowledge.bind(this);
    this.updateMemberRole = this.updateMemberRole.bind(this);

    this.adminGetAllBusinesses = this.adminGetAllBusinesses.bind(this);
    this.adminGetAll = this.adminGetAll.bind(this);
    this.adminGetStats = this.adminGetStats.bind(this);
    this.adminResetOptOut = this.adminResetOptOut.bind(this);
    this.adminForceSuggest = this.adminForceSuggest.bind(this);
    this.adminGetBusiness = this.adminGetBusiness.bind(this);
    this.adminConvertToBusiness = this.adminConvertToBusiness.bind(this);
    this.adminRevokeBusiness = this.adminRevokeBusiness.bind(this);
    this.exportReportCSV = this.exportReportCSV.bind(this);
    this.exportReportPDF = this.exportReportPDF.bind(this);
  }

  // ── Conversion ──────────────────────────────────────────────────────────────
  async convertToBusiness(req, res) {
    try {
      const { businessName } = req.body;
      if (!businessName?.trim()) return this.badRequest(res, 'Business name is required');
      const user = await convertToBusiness(req.user._id, businessName.trim());
      return this.success(res, { user }, 'Account converted to business successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // ── Team ────────────────────────────────────────────────────────────────────
  async getTeamMembers(req, res) {
    try {
      const members = await getTeamMembers(req.user._id);
      return this.success(res, { members });
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async getSchedules(req, res) {
    try {
      const schedules = await getSchedules(req.user._id);
      return this.success(res, { schedules });
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async inviteMember(req, res) {
    try {
      const { identifier, role } = req.body;
      if (!identifier?.trim()) return this.badRequest(res, 'Email or phone is required');
      const invitee = await inviteMember(req.user._id, identifier.trim(), role);
      return this.success(res, { invitee }, 'Member invited successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async respondToInvite(req, res) {
    try {
      const { response } = req.body; // 'accepted' | 'declined'
      if (!['accepted', 'declined'].includes(response)) {
        return this.badRequest(res, 'Invalid response');
      }
      const result = await respondToInvite(req.user._id, response);
      return this.success(res, result, `Invite ${response}`);
    } catch (err) {
      return this.error(res, err.message);
    }
  }

  async updateMemberRole(req, res) {
    try {
      const { memberId } = req.params;
      const { role } = req.body;
      if (!['staff', 'manager', 'admin'].includes(role))
        return this.badRequest(res, 'Invalid role');
      const members = await updateMemberRole(req.user._id, memberId, role);
      return this.success(res, { members }, 'Role updated');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async removeMember(req, res) {
    try {
      const { memberId } = req.params;
      await removeMember(req.user._id, memberId);
      return this.success(res, null, 'Member removed successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // ── Reports ─────────────────────────────────────────────────────────────────
  async getReports(req, res) {
    try {
      const { period } = req.query;
      const reports = await getReports(req.user._id, period);
      return this.success(res, { reports });
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async generateExpenseReport(req, res) {
    try {
      const { period } = req.body;
      if (!['weekly', 'monthly'].includes(period)) {
        return this.badRequest(res, 'period must be weekly or monthly');
      }
      const report = await generateExpenseReport(req.user._id, period);
      return this.success(res, { report }, 'Report generated successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // ── Schedules ───────────────────────────────────────────────────────────────
  async createSchedule(req, res) {
    try {
      const { label, scheduledAt } = req.body;
      if (!label?.trim()) return this.badRequest(res, 'Label is required');
      if (!scheduledAt) return this.badRequest(res, 'scheduledAt is required');
      const schedule = await createSchedule(req.user._id, label.trim(), scheduledAt);
      return this.success(res, { schedule }, 'Schedule created successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async deleteSchedule(req, res) {
    try {
      const { scheduleId } = req.params;
      await deleteSchedule(req.user._id, scheduleId);
      return this.success(res, null, 'Schedule deleted successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // ── Suggestions ─────────────────────────────────────────────────────────────
  async getStatus(req, res) {
    try {
      const result = await getSuggestionStatus(req.user._id);
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async dismiss(req, res) {
    try {
      const result = await dismissSuggestion(req.user._id);
      return this.success(res, result, 'Suggestion dismissed');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async acknowledge(req, res) {
    try {
      await acknowledgeSuggestion(req.user._id);
      return this.success(res, null, 'Acknowledged');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async notifyTeamMember(req, res) {
    try {
      const { recipientId, title, body, data } = req.body;
      const { sendPushNotification } = require('../services/notificationService');
      await sendPushNotification({ recipientId, recipientType: 'user', title, body, data });
      return this.success(res, {}, 'Notified');
    } catch (err) {
      return this.error(res, err.message);
    }
  }

  async exportReportCSV(req, res) {
    try {
      const csv = await exportReportCSV(req.user._id, req.params.reportId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.reportId}.csv"`);
      return res.send(csv);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async exportReportPDF(req, res) {
    try {
      const report = await exportReportPDF(req.user._id, req.params.reportId);
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.reportId}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).text('Expense Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${report.period}`);
      doc.text(`Date Range: ${new Date(report.startDate).toLocaleDateString()} — ${new Date(report.endDate).toLocaleDateString()}`);
      doc.text(`Total Tasks: ${report.totalTasks}`);
      doc.text(`Total Spend: ₦${report.totalSpend.toLocaleString()}`);
      doc.moveDown();
      doc.fontSize(10).text('Breakdown:', { underline: true });
      doc.moveDown(0.5);

      report.breakdown.forEach((b, i) => {
        doc.text(`${i + 1}. Task ${b.taskId} — ₦${b.amount} — ${b.completedAt ? new Date(b.completedAt).toLocaleDateString() : 'N/A'}`);
      });

      doc.end();
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async updateScheduleStatus(req, res) {
    try {
      const { status } = req.body;
      const schedule = await updateScheduleStatus(
        req.user._id,
        req.params.scheduleId,
        status
      );
      return this.success(res, { schedule }, 'Status updated');
    } catch (err) {
      return this.error(res, err.message);
    }
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
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

  async adminResetOptOut(req, res) {
    try {
      const result = await adminResetOptOut(req.params.userId);
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async adminForceSuggest(req, res) {
    try {
      const result = await adminForceSuggest(req.params.userId);
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async adminGetAllBusinesses(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await adminGetAllBusinesses({ page, limit });
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async adminGetBusiness(req, res) {
    try {
      const result = await adminGetBusiness(req.params.userId);
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async adminConvertToBusiness(req, res) {
    try {
      const { businessName } = req.body;
      if (!businessName?.trim()) return this.badRequest(res, 'Business name is required');
      const user = await adminConvertToBusiness(req.params.userId, businessName.trim());
      return this.success(res, { user }, 'Account converted to business successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async adminRevokeBusiness(req, res) {
    try {
      const result = await adminRevokeBusiness(req.params.userId);
      return this.success(res, result);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }
}

module.exports = new BusinessController();