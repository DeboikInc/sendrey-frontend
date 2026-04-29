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
  updateMemberRole,
  deleteReport,


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
    this.deleteReport = this.deleteReport.bind(this);
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
      // Use the resolved owner ID, not the caller's ID
      const ownerId = req.businessOwner._id;
      const members = await getTeamMembers(ownerId);
      return this.success(res, { members });
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async getSchedules(req, res) {
    try {
      const ownerId = req.businessOwner._id;
      const schedules = await getSchedules(ownerId);
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
      await updateMemberRole(req.businessOwner._id, memberId, role);
      return this.success(res, { memberId, role }, 'Role updated');
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
      const ownerId = req.businessOwner._id;
      const { period } = req.query;
      const reports = await getReports(ownerId, period);
      return this.success(res, { reports });
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async generateExpenseReport(req, res) {
    try {
      const ownerId = req.businessOwner._id;
      const { period } = req.body;
      if (!['weekly', 'monthly'].includes(period)) {
        return this.badRequest(res, 'period must be weekly or monthly');
      }
      const report = await generateExpenseReport(ownerId, period);
      return this.success(res, { report }, 'Report generated successfully');
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  // ── Schedules ───────────────────────────────────────────────────────────────
  async createSchedule(req, res) {
    try {
      const ownerId = req.businessOwner._id;
      const { label, scheduledAt } = req.body;
      if (!label?.trim()) return this.badRequest(res, 'Label is required');
      if (!scheduledAt) return this.badRequest(res, 'scheduledAt is required');
      const schedule = await createSchedule(ownerId, label.trim(), scheduledAt);
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

  async exportReportPDF(req, res) {
    try {
      const PDFDocument = require('pdfkit');
      const report = await exportReportPDF(req.user._id, req.params.reportId);
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.reportId}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Expense Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').text(`Business: ${report.businessName || 'N/A'}`, { align: 'center' });
      doc.moveDown();

      // Summary
      doc.fontSize(13).font('Helvetica-Bold').text('Summary');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Period: ${report.period}`);
      doc.text(`Date Range: ${new Date(report.startDate).toLocaleDateString()} — ${new Date(report.endDate).toLocaleDateString()}`);
      doc.text(`Total Tasks: ${report.totalTasks}`);
      doc.text(`Total Spend: NGN ${report.totalSpend.toLocaleString()}`);
      doc.moveDown();

      // Breakdown
      doc.fontSize(13).font('Helvetica-Bold').text('Task Breakdown');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      report.breakdown.forEach((b, i) => {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('black')
          .text(`${i + 1}. ${b.serviceType || 'Delivery'} — NGN ${(b.amount || 0).toLocaleString()}`);
        doc.fontSize(10).font('Helvetica').fillColor('#555');
        if (b.fleet) doc.text(`   Fleet: ${b.fleet}`);
        if (b.pickupLocation) doc.text(`   Pickup: ${b.pickupLocation}`);
        if (b.deliveryLocation) doc.text(`   Dropoff: ${b.deliveryLocation}`);
        if (b.items) doc.text(`   Items: ${b.items}`);
        if (b.budget) doc.text(`   Budget: ${b.budget}`);
        if (b.requestedBy) doc.text(`   Member/Requested By: ${b.requestedBy}`);
        if (b.createdAt) doc.text(`   Created At: ${new Date(b.createdAt).toLocaleString()}`);
        if (b.completedAt) doc.text(`   Completed At: ${new Date(b.completedAt).toLocaleString()}`);
        if (b.durationMins != null) doc.text(`   Duration: ${b.durationMins} min`);
      });

      doc.end();
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
    }
  }

  async exportReportCSV(req, res) {
    try {
      const report = await exportReportCSV(req.user._id, req.params.reportId);
      // If your service already returns a CSV string, send it.
      // If it returns the report object, build CSV here:
      if (typeof report === 'string') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.reportId}.csv"`);
        return res.send(report);
      }

      const headers = [
        'Task ID', 'Service Type', 'Amount (₦)', 'Pickup Location',
        'Delivery Location', 'Items', 'Runner', 'Requested By',
        'Started At', 'Completed At', 'Duration (min)'
      ];
      const rows = report.breakdown.map(b => {
        const mins = b.startedAt && b.completedAt
          ? Math.round((new Date(b.completedAt) - new Date(b.startedAt)) / 60000)
          : '';
        return [
          b.taskId, b.serviceType || '', b.amount || 0,
          b.pickupLocation || '', b.deliveryLocation || '',
          b.pickupItems || '', b.assignedRunner || '', b.requestedBy || '',
          b.startedAt ? new Date(b.startedAt).toLocaleString() : '',
          b.completedAt ? new Date(b.completedAt).toLocaleString() : '',
          mins
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.reportId}.csv"`);

      return res.send('\uFEFF' + csv);
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

  // delete report
  async deleteReport(req, res) {
    try {
      const ownerId = req.businessOwner._id;
      const requesterId = req.user._id;
      const requesterRole = req.businessRole; // set by requireBusiness middleware
      const result = await deleteReport(ownerId, req.params.reportId, requesterId, requesterRole);
      return this.success(res, result, result.message);
    } catch (err) {
      return this.error(res, err.message, err.statusCode || 500);
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