const { Chat } = require("../models/Chat");
const Order = require("../models/Order");
const User = require('../models/User');

const paymentService = require("../services/paymentServices");
const orderStateMachine = require("../services/orderStateMachine");
const cloudinary = require("../config/cloudinary");

const {
  notifyItemApprovalRequest,
  notifyItemApproved,
  notifyItemRejected
} = require('../services/notificationService');

const cleanForEmit = (data) => {
  if (data && typeof data === "object") {
    if (data.toObject && typeof data.toObject === "function") return data.toObject();
    if (Array.isArray(data)) return data.map((item) => cleanForEmit(item));
    const result = {};
    for (const key in data) result[key] = cleanForEmit(data[key]);
    return result;
  }
  return data;
};

const uploadToCloudinary = (base64String, folder = 'item-receipts') =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      { 
        folder, 
        resource_type: 'image',
        timeout: 60000, // 60s timeout
        transformation: [{ quality: 'auto:low', fetch_format: 'auto' }], // compress
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

const handleSubmitItems = async (socket, io, data) => {
  const {
    chatId, runnerId, userId, submissionId,
    escrowId, items, receiptBase64, receiptUrl, totalAmount,
  } = data;

  try {
    let finalReceiptUrl = receiptUrl || null;
    if (receiptBase64) {
      const uploaded = await uploadToCloudinary(receiptBase64, "item-receipts");
      finalReceiptUrl = uploaded.secure_url;
    }

    const finalItems = await Promise.all(
      items.map(async (item) => {
        const { photoBase64, ...rest } = item;
        if (!photoBase64) return rest;
        const uploaded = await uploadToCloudinary(photoBase64, "item-photos");
        return { ...rest, photoUrl: uploaded.secure_url };
      })
    );

    const message = {
      id: submissionId,
      type: "item_submission",
      messageType: "item_submission",
      senderId: runnerId,
      senderType: "runner",
      chatId,
      submissionId,
      escrowId: escrowId || null,
      items: finalItems,
      receiptUrl: finalReceiptUrl,
      totalAmount,
      status: "pending",
      rejectionReason: null,
      time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      }),
      createdAt: new Date(),
    };

    const chat = await Chat.findOne({ chatId });
    if (chat) {
      chat.messages.push(message);
      await chat.save();
    }

    // Transition order state
    const order = await Order.findOne({ chatId });
    if (order) {
      await orderStateMachine.transition(order.orderId, 'items_submitted', {
        triggeredBy: 'runner',
        triggeredById: runnerId,
        note: `Items submitted, total: ₦${totalAmount}`
      });
    }

    io.to(chatId).emit("message", cleanForEmit(message));

    // push notification to user about item approval
    await notifyItemApprovalRequest(userId, {
      orderId: order?.orderId,
      totalAmount
    });

    // console.log(`Item submission ${submissionId} sent to chat ${chatId}`);

  } catch (error) {
    console.error("Error submitting items:", error);
    socket.emit("itemSubmissionError", {
      error: "Failed to submit items. Please try again.",
    });
  }
};

const handleApproveItems = async (socket, io, data) => {
  const { chatId, submissionId, escrowId, userId } = data;

  try {
    const chat = await Chat.findOne({ chatId });
    if (chat) {
      const idx = chat.messages.findIndex((m) => m.submissionId === submissionId);
      if (idx !== -1) {
        chat.messages[idx] = {
          ...chat.messages[idx],
          status: "approved",
          rejectionReason: null,
        };
      }
    }

    const order = await Order.findOne({ chatId });
    if (order) {
      await orderStateMachine.transition(order.orderId, 'items_approved', {
        triggeredBy: 'user',
        triggeredById: userId,
        note: 'Items approved by user'
      });
    }

    // Fetch user name
    const user = await User.findById(userId).select('firstName lastName');
    const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

    const userSystemMsg = {
      id: `approval-user-${Date.now()}`,
      type: 'system', messageType: 'system',
      from: 'system', senderId: 'system', senderType: 'system',
      text: `You approved the items. Runner will purchase the items now.`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    const runnerSystemMsg = {
      id: `approval-runner-${Date.now() + 1}`,
      type: 'system', messageType: 'system',
      from: 'system', senderId: 'system', senderType: 'system',
      text: `${userName} approved the items. Proceed with purchase.`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    // Save both to chat
    if (chat) {
      chat.messages.push(userSystemMsg, runnerSystemMsg);
      await chat.save();
    }

    io.to(chatId).emit("itemSubmissionUpdated", {
      submissionId, status: "approved", rejectionReason: null,
    });


    io.to(chatId).emit('message', cleanForEmit(userSystemMsg));
    io.to(chatId).emit('message', cleanForEmit(runnerSystemMsg));
    // Emit to personal rooms
    io.to(`user-${userId.toString()}`).emit('message', cleanForEmit(userSystemMsg));
    // console.log('Emitting approval to runner room:', `user-${order.runnerId}`);
    io.to(`runner-${order.runnerId.toString()}`).emit('message', cleanForEmit(runnerSystemMsg))

    if (escrowId) {
      try {
        const result = await paymentService.releaseItemBudget(escrowId);
        // console.log(`Item budget released for escrow ${escrowId}:`, result);
      } catch (err) {
        console.error("Failed to release item budget:", err.message);
        socket.emit("itemBudgetReleaseError", { escrowId, error: err.message });
      }
    }

    await notifyItemApproved(order.runnerId, { orderId: order.orderId });
    // console.log(`Items approved for submission ${submissionId}`);


  } catch (error) {
    console.error("Error approving items:", error);
    socket.emit("itemApprovalError", { error: "Failed to approve items. Please try again." });
  }
};

const handleRejectItems = async (socket, io, data) => {
  const { chatId, submissionId, reason, userId } = data;

  try {
    const chat = await Chat.findOne({ chatId });
    if (chat) {
      const idx = chat.messages.findIndex((m) => m.submissionId === submissionId);
      if (idx !== -1) {
        chat.messages[idx] = {
          ...chat.messages[idx],
          status: "rejected",
          rejectionReason: reason,
        };
      }
    }

    const order = await Order.findOne({ chatId });
    if (order) {
      await orderStateMachine.transition(order.orderId, 'in_progress', {
        triggeredBy: 'user',
        triggeredById: userId,
        note: `Items rejected: ${reason}`
      });
    }

    // Fetch user name
    const user = await User.findById(userId).select('firstName lastName');
    const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

    const userSystemMsg = {
      id: `rejection-user-${Date.now()}`,
      type: 'system', messageType: 'system',
      from: 'system', senderId: 'system', senderType: 'system',
      text: `You rejected the items. The runner will review and resubmit.`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      style: 'warning',
    };

    const runnerSystemMsg = {
      id: `rejection-runner-${Date.now() + 1}`,
      type: 'system', messageType: 'system',
      from: 'system', senderId: 'system', senderType: 'system',
      text: `${userName} rejected the items. Reason: ${reason}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      style: 'error',
    };

    // Save both to chat
    if (chat) {
      chat.messages.push(userSystemMsg, runnerSystemMsg);
      await chat.save();
    }

    io.to(chatId).emit("itemSubmissionUpdated", {
      submissionId, status: "rejected", rejectionReason: reason,
    });


    io.to(chatId).emit('message', cleanForEmit(userSystemMsg));
    io.to(chatId).emit('message', cleanForEmit(runnerSystemMsg));
    //  Emit to personal rooms
    io.to(`user-${userId.toString()}`).emit('message', cleanForEmit(userSystemMsg));
    io.to(`runner-${order.runnerId.toString()}`).emit('message', cleanForEmit(runnerSystemMsg));

    await notifyItemRejected(order.runnerId, { orderId: order.orderId, reason });
    // console.log(`Items rejected for submission ${submissionId}. Reason: ${reason}`);

  } catch (error) {
    console.error("Error rejecting items:", error);
    socket.emit("itemRejectionError", { error: "Failed to reject items. Please try again." });
  }
};

module.exports = { handleSubmitItems, handleApproveItems, handleRejectItems };