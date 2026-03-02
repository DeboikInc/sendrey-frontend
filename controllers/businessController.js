// controllers/businessController.js
const businessService = require('../services/businessServices');
const { registerScheduledConversation } = require('../jobs/scheduledConversations');

// ── Conversion ─────────────────────────────────────────────────────────────

const convertToBusiness = async (req, res) => {
  try {
    const { businessName } = req.body;

    if (!businessName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business name is required'
      });
    }

    const user = await businessService.convertToBusiness(req.user._id, businessName.trim());

    res.status(200).json({
      success: true,
      message: 'Business account activated',
      data: {
        businessName: user.businessProfile.businessName,
        convertedAt: user.businessProfile.convertedAt,
      }
      
    });
    console.log(`${businessName} converted by ${req.user.name}`)
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
    console.log(error)
  }
};

// ── Team ───────────────────────────────────────────────────────────────────

const inviteMember = async (req, res) => {
  try {
    const { identifier, role } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required'
      });
    }

    const invitee = await businessService.inviteMember(req.user._id, identifier, role);

    res.status(200).json({
      success: true,
      message: `${invitee.firstName} added to your team as ${role || 'staff'}`,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const removeMember = async (req, res) => {
  try {
    await businessService.removeMember(req.user._id, req.params.memberId);
    res.status(200).json({ success: true, message: 'Member removed' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const members = await businessService.getTeamMembers(req.user._id);
    res.status(200).json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Reports ────────────────────────────────────────────────────────────────

const getReports = async (req, res) => {
  try {
    const { period } = req.query; // ?period=weekly or ?period=monthly
    const reports = await businessService.getReports(req.user._id, period);
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportReport = async (req, res) => {
  try {
    const { reportId, format } = req.params;
    const ExpenseReport = require('../models/ExpenseReport');

    const report = await ExpenseReport.findById(reportId)
      .populate('breakdown.taskId')
      .populate('breakdown.createdBy', 'firstName lastName');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (format === 'csv') {
      const rows = report.breakdown.map((item) => ({
        task: item.taskId?.taskId || item.taskId,
        amount: item.amount,
        completedBy: `${item.createdBy?.firstName || ''} ${item.createdBy?.lastName || ''}`.trim(),
        completedAt: item.completedAt?.toISOString(),
      }));

      const header = 'task,amount,completedBy,completedAt\n';
      const csv = header + rows.map((r) =>
        `${r.task},${r.amount},${r.completedBy},${r.completedAt}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report-${reportId}.csv`);
      return res.send(csv);
    }

    res.status(400).json({ success: false, message: 'Supported formats: csv' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Schedules ──────────────────────────────────────────────────────────────

const createSchedule = async (req, res) => {
  try {
    const { label, cronExpression } = req.body;

    if (!label || !cronExpression) {
      return res.status(400).json({
        success: false,
        message: 'Label and cronExpression are required'
      });
    }

    const schedule = await businessService.createSchedule(
      req.user._id, label, cronExpression
    );

    // register it with the cron runner immediately so it starts without a restart
    registerScheduledConversation(req.user._id, label, cronExpression);

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    await businessService.deleteSchedule(req.user._id, req.params.scheduleId);
    res.status(200).json({ success: true, message: 'Schedule removed' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  convertToBusiness,
  inviteMember,
  removeMember,
  getTeamMembers,
  getReports,
  exportReport,
  createSchedule,
  deleteSchedule,
};