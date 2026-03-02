// services/businessService.js
const User = require('../models/User');
const Task = require('../models/Task');
const ExpenseReport = require('../models/ExpenseReport');

// ── Conversion ────────────────────────────────────────────────────────────────

const convertToBusiness = async (userId, businessName) => {
  const user = await User.findById(userId);

  if (!user) throw new Error('User not found');
  if (user.accountType === 'business') throw new Error('Already a business account');

  user.accountType = 'business';
  user.businessProfile = {
    businessName,
    convertedAt: new Date(),
    members: [
      {
        userId: user._id,
        role: 'admin',
        joinedAt: new Date(),
      },
    ],
    scheduledConversations: [],
  };

  await user.save();
  return user;
};

// ── Team Management ───────────────────────────────────────────────────────────

const inviteMember = async (businessOwnerId, identifier, role = 'staff') => {
  const [owner, invitee] = await Promise.all([
    User.findById(businessOwnerId),
    User.findOne({ $or: [{ email: identifier }, { phone: identifier }] })
  ]);

  if (!invitee) throw new Error('No Sendrey account found for that contact');

  const alreadyMember = owner.businessProfile.members.some(
    (m) => m.userId.toString() === invitee._id.toString()
  );
  if (alreadyMember) throw new Error('This person is already on your team');

  owner.businessProfile.members.push({
    userId: invitee._id,
    role,
    joinedAt: new Date(),
  });

  await owner.save();
  return invitee;
};

const removeMember = async (businessOwnerId, memberId) => {
  const owner = await User.findById(businessOwnerId);

  if (memberId === businessOwnerId.toString()) {
    throw new Error("You can't remove yourself as admin");
  }

  owner.businessProfile.members = owner.businessProfile.members.filter(
    (m) => m.userId.toString() !== memberId
  );

  await owner.save();
};

const getTeamMembers = async (businessOwnerId) => {
  const owner = await User.findById(businessOwnerId)
    .populate('businessProfile.members.userId', 'firstName lastName email phone avatar');

  return owner.businessProfile.members;
};

// ── Expense Reports ───────────────────────────────────────────────────────────

const generateExpenseReport = async (businessOwnerId, period) => {
  const now = new Date();

  // work out the start of this period
  let startDate;
  if (period === 'weekly') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const tasks = await Task.find({
    businessAccount: businessOwnerId,
    status: 'completed',
    completedAt: { $gte: startDate, $lte: now },
  });

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

  return report;
};

const getReports = async (businessOwnerId, period) => {
  const query = { businessAccount: businessOwnerId };
  if (period) query.period = period;

  return ExpenseReport.find(query)
    .sort({ createdAt: -1 })
    .limit(12); // last 12 reports
};

// ── Scheduled Conversations ───────────────────────────────────────────────────

const createSchedule = async (businessOwnerId, label, cronExpression) => {
  const user = await User.findById(businessOwnerId);

  const alreadyExists = user.businessProfile.scheduledConversations.some(
    (s) => s.label === label
  );
  if (alreadyExists) throw new Error('A schedule with that name already exists');

  user.businessProfile.scheduledConversations.push({
    label,
    cronExpression,
    isActive: true,
  });

  await user.save();
  return user.businessProfile.scheduledConversations.at(-1);
};

const deleteSchedule = async (businessOwnerId, scheduleId) => {
  const user = await User.findById(businessOwnerId);

  user.businessProfile.scheduledConversations =
    user.businessProfile.scheduledConversations.filter(
      (s) => s._id.toString() !== scheduleId
    );

  await user.save();
};

module.exports = {
  convertToBusiness,
  inviteMember,
  removeMember,
  getTeamMembers,
  generateExpenseReport,
  getReports,
  createSchedule,
  deleteSchedule,
};