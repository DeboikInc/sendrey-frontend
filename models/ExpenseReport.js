// models/ExpenseReport.js
const mongoose = require('mongoose');

const expenseReportSchema = new mongoose.Schema(
  {
    businessAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    period: {
      type: String,
      enum: ['weekly', 'monthly'],
    },
    startDate: Date,
    endDate: Date,
    totalSpend: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    breakdown: [
      {
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
        amount: Number,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        completedAt: Date,
      },
    ],
    exportedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

expenseReportSchema.index({ businessAccount: 1, createdAt: -1 });

module.exports = mongoose.model('ExpenseReport', expenseReportSchema);