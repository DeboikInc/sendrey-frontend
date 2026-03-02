// jobs/expenseReports.js
const cron = require('node-cron');
const User = require('../models/User');
const Task = require('../models/Task');
const ExpenseReport = require('../models/ExpenseReport');

// ── report generator ──────────────────────────────────────────────────────────

const generateReportForBusiness = async (businessOwnerId, period) => {
  const now = new Date();

  let startDate;
  if (period === 'weekly') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else {
    // monthly — from the 1st of this month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const tasks = await Task.find({
    businessAccount: businessOwnerId,
    status: 'completed',
    completedAt: { $gte: startDate, $lte: now },
  });

  // don't create empty reports
  if (tasks.length === 0) {
    console.log(`No tasks found for business ${businessOwnerId} — skipping ${period} report`);
    return null;
  }

  const totalSpend = tasks.reduce((sum, t) => sum + (t.amount || 0), 0);

  const report = await ExpenseReport.create({
    businessAccount: businessOwnerId,
    period,
    startDate,
    endDate: now,
    totalSpend,
    totalTasks: tasks.length,
    breakdown: tasks.map((t) => ({
      taskId: t._id,
      amount: t.amount,
      createdBy: t.createdByMember,
      completedAt: t.completedAt,
    })),
  });

  console.log(`${period} report created for business ${businessOwnerId}: ${tasks.length} tasks, ₦${totalSpend}`);
  return report;
};

// ── notify admin via pending prompt ──────────────────────────────────────────
// uses the same pendingPrompts pattern as scheduledConversations so the
// frontend can pick it up via the same polling/socket mechanism

const notifyAdmin = async (businessOwnerId, report) => {
  const periodLabel = report.period === 'weekly' ? 'Weekly' : 'Monthly';
  const message =
    `📊 Your ${periodLabel} Expense Report is ready.\n` +
    `Period: ${new Date(report.startDate).toLocaleDateString()} – ${new Date(report.endDate).toLocaleDateString()}\n` +
    `Tasks completed: ${report.totalTasks}\n` +
    `Total spend: ₦${report.totalSpend.toLocaleString()}\n` +
    `View full report in Business Settings → Reports.`;

  await User.findByIdAndUpdate(businessOwnerId, {
    $push: {
      pendingPrompts: {
        message,
        type: 'expense_report',
        reportId: report._id,
        createdAt: new Date(),
      },
    },
  });

  console.log(`Admin notified for business ${businessOwnerId}`);
};

// ── run reports for all business accounts ────────────────────────────────────

const runReportsForAllBusinesses = async (period) => {
  try {
    const businesses = await User.find({ accountType: 'business' }).select('_id');

    console.log(`Running ${period} expense reports for ${businesses.length} businesses...`);

    for (const business of businesses) {
      try {
        const report = await generateReportForBusiness(business._id, period);
        if (report) {
          await notifyAdmin(business._id, report);
        }
      } catch (err) {
        // log individual failures but don't stop the loop for other businesses
        console.error(`Failed to generate ${period} report for ${business._id}:`, err.message);
      }
    }

    console.log(`${period} expense report run complete`);
  } catch (err) {
    console.error(`Failed to run ${period} expense reports:`, err.message);
  }
};

// ── cron schedules ────────────────────────────────────────────────────────────

const startExpenseReportJobs = () => {
  // weekly — every Monday at 8am
  cron.schedule('0 8 * * 1', () => {
    console.log('Running weekly expense reports...');
    runReportsForAllBusinesses('weekly');
  });

  // monthly — 1st of every month at 8am
  cron.schedule('0 8 1 * *', () => {
    console.log('Running monthly expense reports...');
    runReportsForAllBusinesses('monthly');
  });

  console.log('Expense report cron jobs registered (weekly: Mon 8am, monthly: 1st 8am)');
};

module.exports = { startExpenseReportJobs, generateReportForBusiness };