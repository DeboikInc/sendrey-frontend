// utils/withTransaction.js

const mongoose = require('mongoose');

const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error; // re-throw so the caller (controller/consumer) handles it
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction };