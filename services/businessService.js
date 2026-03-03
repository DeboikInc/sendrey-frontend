const Task = require('../models/Task');
const User = require('../models/User');
const Business = require('../models/Business');
const { sendPushNotification } = require('./notificationService');

// ── Config 
const MONTHLY_TASK_THRESHOLD = 5;          // min tasks in current month to qualify
const SUGGESTION_COOLDOWN_DAYS = 14;       // days before re-suggesting after dismiss
const OPT_OUT_THRESHOLD = 3;              // dismiss X times = permanent opt out
const MIN_DAYS_BETWEEN_SUGGESTIONS = 7;   // don't spam — at least 7 days between pushes

// ── Helpers 
const daysSince = (date) =>
    date ? (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24) : Infinity;

const startOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

// ── Core: check if a user qualifies for a business suggestion ─────────────────
const checkAndSuggestBusiness = async (userId) => {
    try {
        const user = await User.findById(userId).select('accountType');
        if (!user || user.accountType === 'business') return null; // already business

        // count completed tasks this calendar month
        const monthlyTaskCount = await Task.countDocuments({
            userId,
            status: 'completed',
            completedAt: { $gte: startOfCurrentMonth() },
        });

        if (monthlyTaskCount < MONTHLY_TASK_THRESHOLD) return null;

        // get or create suggestion record
        let suggestion = await Business.findOne({ userId });
        if (!suggestion) {
            suggestion = await Business.create({ userId });
        }

        // permanently opted out — never suggest again
        if (suggestion.optedOut) return null;

        // dismissed recently — respect cooldown
        if (
            suggestion.dismissedAt &&
            daysSince(suggestion.dismissedAt) < SUGGESTION_COOLDOWN_DAYS
        ) return null;

        // already suggested recently — don't spam
        if (
            suggestion.lastSuggestedAt &&
            daysSince(suggestion.lastSuggestedAt) < MIN_DAYS_BETWEEN_SUGGESTIONS
        ) return null;

        // ── All checks passed — fire suggestion 
        suggestion.suggestionCount += 1;
        suggestion.lastSuggestedAt = new Date();
        await suggestion.save();

        // send push notification
        await sendPushNotification({
            recipientId: userId,
            recipientType: 'user',
            title: '🚀 Upgrade to Business',
            body: `You've used Sendrey ${monthlyTaskCount} times this month. Unlock team access, expense reports & scheduled deliveries.`,
            data: {
                type: 'business_suggestion',
                monthlyTaskCount: String(monthlyTaskCount),
            },
        });

        return {
            shouldSuggest: true,
            monthlyTaskCount,
            suggestionCount: suggestion.suggestionCount,
        };
    } catch (err) {
        console.error('checkAndSuggestBusiness error:', err.message);
        return null;
    }
};

// ── user not interested
const dismissSuggestion = async (userId) => {
    let suggestion = await Business.findOne({ userId });
    if (!suggestion) return;

    suggestion.dismissedAt = new Date();

    // if they've dismissed enough times, opt them out permanently
    if (suggestion.suggestionCount >= OPT_OUT_THRESHOLD) {
        suggestion.optedOut = true;
    }

    await suggestion.save();
    return { optedOut: suggestion.optedOut };
};

// ── user continues
const acknowledgeSuggestion = async (userId) => {
    let suggestion = await Business.findOne({ userId });
    if (!suggestion) return;

    suggestion.convertedAt = new Date();
    await suggestion.save();
};

// ── Get suggestion status for a user (used by frontend on app load) ───────────
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

    const suggestion = await Business.findOne({ userId });

    if (suggestion?.optedOut) {
        return { shouldSuggest: false, reason: 'opted_out' };
    }

    if (
        suggestion?.dismissedAt &&
        daysSince(suggestion.dismissedAt) < SUGGESTION_COOLDOWN_DAYS
    ) {
        return { shouldSuggest: false, reason: 'dismissed_recently' };
    }

    return {
        shouldSuggest: true,
        monthlyTaskCount,
        suggestionCount: suggestion?.suggestionCount || 0,
    };

    // ADMIN ACTIONS

};
// ADMIN ENDPOINTS
const adminGetAllSuggestions = async ({ page = 1, limit = 20, filter } = {}) => {
    const skip = (page - 1) * limit;
    const query = {};

    if (filter === 'opted_out') query.optedOut = true;
    if (filter === 'converted') query.convertedAt = { $ne: null };
    if (filter === 'pending') query.convertedAt = null, query.optedOut = false;

    const [records, total] = await Promise.all([
        Business.find(query)
            .populate('userId', 'firstName lastName email phone accountType')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Business.countDocuments(query),
    ]);

    return { records, total, page, limit };
};

const adminGetSuggestionStats = async () => {
    const [total, optedOut, converted, dismissed] = await Promise.all([
        Business.countDocuments(),
        Business.countDocuments({ optedOut: true }),
        Business.countDocuments({ convertedAt: { $ne: null } }),
        Business.countDocuments({ dismissedAt: { $ne: null }, convertedAt: null }),
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

module.exports = {
    checkAndSuggestBusiness,
    dismissSuggestion,
    acknowledgeSuggestion,
    getSuggestionStatus,
    adminGetAllSuggestions,
    adminGetSuggestionStats
};