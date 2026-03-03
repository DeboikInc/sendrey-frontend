// services/businessService.js
const User = require('../models/User');
const Task = require('../models/Task');
const ExpenseReport = require('../models/ExpenseReport');
const BusinessSuggestion = require('../models/BusinessSuggestion');
const { sendPushNotification } = require('./notificationService');

// ── Config ────────────────────────────────────────────────────────────────────
const MONTHLY_TASK_THRESHOLD        = 5;
const SUGGESTION_COOLDOWN_DAYS      = 14;
const OPT_OUT_THRESHOLD             = 3;
const MIN_DAYS_BETWEEN_SUGGESTIONS  = 7;

const daysSince = (date) =>
  date ? (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24) : Infinity;

const startOfCurrentMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// ── Conversion ────────────────────────────────────────────────────────────────
const convertToBusiness = async (userId, businessName) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.accountType === 'business') throw new Error('Already a business account');

  user.accountType = 'business';
  user.businessProfile = {
    businessName,
    convertedAt: new Date(),
    members: [{ userId: user._id, role: 'admin', joinedAt: new Date() }],
    scheduledConversations: [],
  };

  await user.save();
  return user;
};

// ── Team Management ───────────────────────────────────────────────────────────
const inviteMember = async (businessOwnerId, identifier, role = 'staff') => {
  const [owner, invitee] = await Promise.all([
    User.findById(businessOwnerId),
    User.findOne({ $or: [{ email: identifier }, { phone: identifier }] }),
  ]);

  if (!invitee) throw new Error('No Sendrey account found for that contact');

  const alreadyMember = owner.businessProfile.members.some(
    (m) => m.userId.toString() === invitee._id.toString()
  );
  if (alreadyMember) throw new Error('This person is already on your team');

  owner.businessProfile.members.push({ userId: invitee._id, role, joinedAt: new Date() });
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
  return ExpenseReport.find(query).sort({ createdAt: -1 }).limit(12);
};

// ── Scheduled Conversations ───────────────────────────────────────────────────
const createSchedule = async (businessOwnerId, label, scheduledAt) => {
  const user = await User.findById(businessOwnerId);

  const alreadyExists = user.businessProfile.scheduledConversations.some(
    (s) => s.label === label
  );
  if (alreadyExists) throw new Error('A schedule with that name already exists');

  user.businessProfile.scheduledConversations.push({
    label,
    scheduledAt,
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

// ── Business Suggestions ──────────────────────────────────────────────────────
const checkAndSuggestBusiness = async (userId) => {
  try {
    const user = await User.findById(userId).select('accountType');
    if (!user || user.accountType === 'business') return null;

    const monthlyTaskCount = await Task.countDocuments({
      userId,
      status: 'completed',
      completedAt: { $gte: startOfCurrentMonth() },
    });

    if (monthlyTaskCount < MONTHLY_TASK_THRESHOLD) return null;

    let suggestion = await BusinessSuggestion.findOne({ userId });
    if (!suggestion) suggestion = await BusinessSuggestion.create({ userId });

    if (suggestion.optedOut) return null;

    if (suggestion.dismissedAt && daysSince(suggestion.dismissedAt) < SUGGESTION_COOLDOWN_DAYS) return null;

    if (suggestion.lastSuggestedAt && daysSince(suggestion.lastSuggestedAt) < MIN_DAYS_BETWEEN_SUGGESTIONS) return null;

    suggestion.suggestionCount  += 1;
    suggestion.lastSuggestedAt  = new Date();
    await suggestion.save();

    await sendPushNotification({
      recipientId: userId,
      recipientType: 'user',
      title: '🚀 Upgrade to Business',
      body: `You've used Sendrey ${monthlyTaskCount} times this month. Unlock team access, expense reports & scheduled deliveries.`,
      data: { type: 'business_suggestion', monthlyTaskCount: String(monthlyTaskCount) },
    });

    return { shouldSuggest: true, monthlyTaskCount, suggestionCount: suggestion.suggestionCount };
  } catch (err) {
    console.error('checkAndSuggestBusiness error:', err.message);
    return null;
  }
};

const getSuggestionStatus = async (userId) => {
  const user = await User.findById(userId).select('accountType');
  if (!user || user.accountType === 'business') {
    return { shouldSuggest: false, reason: 'already_business' };
  }

  const monthlyTaskCount = await Task.countDocuments({
    userId,
    status: 'completed',
    completedAt: { $gte: startOfCurrentMonth() },
  });

  if (monthlyTaskCount < MONTHLY_TASK_THRESHOLD) {
    return { shouldSuggest: false, monthlyTaskCount };
  }

  const suggestion = await BusinessSuggestion.findOne({ userId });

  if (suggestion?.optedOut) return { shouldSuggest: false, reason: 'opted_out' };

  if (suggestion?.dismissedAt && daysSince(suggestion.dismissedAt) < SUGGESTION_COOLDOWN_DAYS) {
    return { shouldSuggest: false, reason: 'dismissed_recently' };
  }

  return { shouldSuggest: true, monthlyTaskCount, suggestionCount: suggestion?.suggestionCount || 0 };
};

const dismissSuggestion = async (userId) => {
  let suggestion = await BusinessSuggestion.findOne({ userId });
  if (!suggestion) return;

  suggestion.dismissedAt = new Date();
  if (suggestion.suggestionCount >= OPT_OUT_THRESHOLD) suggestion.optedOut = true;

  await suggestion.save();
  return { optedOut: suggestion.optedOut };
};

const acknowledgeSuggestion = async (userId) => {
  let suggestion = await BusinessSuggestion.findOne({ userId });
  if (!suggestion) return;
  suggestion.convertedAt = new Date();
  await suggestion.save();
};

// ── Admin: Suggestions ────────────────────────────────────────────────────────
const adminGetAllSuggestions = async ({ page = 1, limit = 20, filter } = {}) => {
  const skip  = (page - 1) * limit;
  const query = {};

  if (filter === 'opted_out')  query.optedOut = true;
  if (filter === 'converted')  query.convertedAt = { $ne: null };
  if (filter === 'pending')    { query.convertedAt = null; query.optedOut = false; }

  const [records, total] = await Promise.all([
    BusinessSuggestion.find(query)
      .populate('userId', 'firstName lastName email phone accountType')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    BusinessSuggestion.countDocuments(query),
  ]);

  return { records, total, page, limit };
};

const adminGetSuggestionStats = async () => {
  const [total, optedOut, converted, dismissed] = await Promise.all([
    BusinessSuggestion.countDocuments(),
    BusinessSuggestion.countDocuments({ optedOut: true }),
    BusinessSuggestion.countDocuments({ convertedAt: { $ne: null } }),
    BusinessSuggestion.countDocuments({ dismissedAt: { $ne: null }, convertedAt: null }),
  ]);

  return {
    total,
    optedOut,
    converted,
    pending: total - converted - optedOut,
    dismissed,
    conversionRate: total ? ((converted / total) * 100).toFixed(1) + '%' : '0%',
  };
};

const adminResetOptOut = async (userId) => {
  const suggestion = await BusinessSuggestion.findOne({ userId });
  if (!suggestion) throw Object.assign(new Error('No suggestion record found'), { statusCode: 404 });

  suggestion.optedOut        = false;
  suggestion.dismissedAt     = null;
  suggestion.suggestionCount = 0;
  await suggestion.save();

  return { message: 'Opt-out reset successfully' };
};

const adminForceSuggest = async (userId) => {
  const user = await User.findById(userId).select('accountType');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (user.accountType === 'business') throw Object.assign(new Error('User is already a business'), { statusCode: 400 });

  let suggestion = await BusinessSuggestion.findOne({ userId });
  if (!suggestion) suggestion = await BusinessSuggestion.create({ userId });

  suggestion.optedOut         = false;
  suggestion.dismissedAt      = null;
  suggestion.lastSuggestedAt  = new Date();
  suggestion.suggestionCount  += 1;
  await suggestion.save();

  await sendPushNotification({
    recipientId: userId,
    recipientType: 'user',
    title: '🚀 Upgrade to Business',
    body: 'Unlock team access, expense reports & scheduled deliveries with a business account.',
    data: { type: 'business_suggestion' },
  });

  return { message: 'Suggestion pushed successfully' };
};

// ── Admin: Business Accounts ──────────────────────────────────────────────────
const adminGetAllBusinesses = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const [accounts, total] = await Promise.all([
    User.find({ accountType: 'business' })
      .select('firstName lastName email phone businessProfile createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments({ accountType: 'business' }),
  ]);

  return { accounts, total, page, limit };
};

const adminGetBusiness = async (userId) => {
  const user = await User.findById(userId)
    .populate('businessProfile.members.userId', 'firstName lastName email phone avatar')
    .lean();

  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (user.accountType !== 'business') throw Object.assign(new Error('Not a business account'), { statusCode: 400 });

  return user;
};

const adminConvertToBusiness = async (userId, businessName) => {
  return convertToBusiness(userId, businessName);
};

const adminRevokeBusiness = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (user.accountType !== 'business') throw Object.assign(new Error('Not a business account'), { statusCode: 400 });

  user.accountType     = 'personal';
  user.businessProfile = undefined;
  await user.save();

  return { message: 'Business account revoked' };
};

module.exports = {
  // conversion
  convertToBusiness,
  // team
  inviteMember,
  removeMember,
  getTeamMembers,
  // reports
  generateExpenseReport,
  getReports,
  // schedules
  createSchedule,
  deleteSchedule,
  // suggestions
  checkAndSuggestBusiness,
  getSuggestionStatus,
  dismissSuggestion,
  acknowledgeSuggestion,
  // admin — suggestions
  adminGetAllSuggestions,
  adminGetSuggestionStats,
  adminResetOptOut,
  adminForceSuggest,
  // admin — accounts
  adminGetAllBusinesses,
  adminGetBusiness,
  adminConvertToBusiness,
  adminRevokeBusiness,
};