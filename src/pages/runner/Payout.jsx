import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, ShoppingBag, CheckCircle, Receipt, RefreshCw,
  ArrowRight, Building2, Hash, AlertCircle, Clock, XCircle,
  ChevronDown, ChevronUp, Send, X, Banknote, User
} from 'lucide-react';

import { useDispatch, useSelector } from 'react-redux';
import {
  getCurrentPayout, transferToVendor, getPayoutBanks,
  verifyVendorAccount, clearTransferStatus, getRunnerReceipts,
} from '../../Redux/payoutSlice';

// ─── Generated Receipt Preview ────────────────────────────────────────────────
const GeneratedReceipt = ({ vendorName, accountName, accountNumber, bankName, amountSpent, changeAmount, itemBudget, dark }) => {
  const now = new Date();
  const ref = `TXN${Date.now().toString().slice(-8)}`;
  return (
    <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-black-100 border-black-100' : 'bg-white border-gray-200'}`}>
      {/* Receipt Header */}
      <div className="bg-primary px-5 py-4 text-white text-center">
        <p className="text-xs opacity-70 uppercase tracking-widest mb-1">Transfer Receipt</p>
        <p className="text-2xl font-bold">&#8358;{parseFloat(amountSpent).toLocaleString()}</p>
        <p className="text-xs opacity-70 mt-1">{now.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div>
      {/* Receipt Body */}
      <div className={`px-5 py-4 space-y-3 text-sm ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
        <Row label="Ref" value={ref} dark={dark} />
        <Sep dark={dark} />
        <Row label="To" value={vendorName} bold dark={dark} />
        <Row label="Bank" value={bankName} dark={dark} />
        <Row label="Account" value={accountNumber} dark={dark} />
        <Row label="Account Name" value={accountName} dark={dark} />
        <Sep dark={dark} />
        <Row label="Budget" value={`₦${parseFloat(itemBudget).toLocaleString()}`} dark={dark} />
        <Row label="Transfer Amount" value={`₦${parseFloat(amountSpent).toLocaleString()}`} dark={dark} />
        {parseFloat(changeAmount) > 0 && (
          <Row label="Change to Return" value={`₦${parseFloat(changeAmount).toLocaleString()}`} color="text-green-500" dark={dark} />
        )}
        {parseFloat(changeAmount) < 0 && (
          <Row label="Over Budget" value={`₦${Math.abs(parseFloat(changeAmount)).toLocaleString()}`} color="text-red-500" dark={dark} />
        )}
      </div>
      {/* Stamp */}
      <div className="flex justify-center pb-4">
        <span className="text-xs border-2 border-green-500 text-green-500 rounded-full px-4 py-1 font-bold tracking-widest uppercase">
          Pending Approval
        </span>
      </div>
    </div>
  );
};

const Row = ({ label, value, bold, color, dark }) => (
  <div className="flex justify-between items-center gap-2">
    <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
    <span className={`text-xs font-${bold ? 'semibold' : 'medium'} text-right ${color || (dark ? 'text-white' : 'text-black-200')}`}>{value}</span>
  </div>
);
const Sep = ({ dark }) => <div className={`h-px ${dark ? 'bg-black-100' : 'bg-gray-100'}`} />;

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmModal = ({ dark, vendorName, accountName, accountNumber, bankName, amountSpent, changeAmount, itemBudget, onConfirm, onCancel, submitting }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
    <div className={`w-full max-w-md rounded-3xl overflow-hidden ${dark ? 'bg-black-200' : 'bg-white'}`}>
      <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-black-100' : 'border-gray-100'}`}>
        <p className={`font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Confirm Transfer</p>
        <button onClick={onCancel} className={`p-1.5 rounded-full ${dark ? 'hover:bg-black-100' : 'hover:bg-gray-100'}`}>
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
        <p className={`text-xs mb-4 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Review the generated receipt below. Once confirmed, the transfer will be submitted for user approval.
        </p>
        <GeneratedReceipt
          vendorName={vendorName} accountName={accountName} accountNumber={accountNumber}
          bankName={bankName} amountSpent={amountSpent} changeAmount={changeAmount}
          itemBudget={itemBudget} dark={dark}
        />
      </div>
      <div className={`px-5 py-4 border-t flex gap-3 ${dark ? 'border-black-100' : 'border-gray-100'}`}>
        <button onClick={onCancel} disabled={submitting}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${dark ? 'border-black-100 text-gray-400 hover:bg-black-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Edit
        </button>
        <button onClick={onConfirm} disabled={submitting}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-primary transition-all ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95'}`}>
          {submitting ? 'Transferring...' : 'Confirm & Transfer'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Receipt Status Badge ─────────────────────────────────────────────────────
const ReceiptStatusBadge = ({ status }) => {
  const map = {
    pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Pending' },
    approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Approved' },
    rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Rejected' },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color} ${s.bg}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const Payout = ({ darkMode, onBack, socket, runnerId, chatId }) => {
  const dark = darkMode;
  const dispatch = useDispatch();

  const { currentPayout, receipts, transferStatus, error: sliceError, loading, banks, verifiedAccount } = useSelector(state => state.payout);

  const [payout, setPayout] = useState(null);
  const [step, setStep] = useState('overview'); // 'overview' | 'form' | 'receipts'
  const [showConfirm, setShowConfirm] = useState(false);

  const [vendorName, setVendorName] = useState('');
  const [amountSpent, setAmountSpent] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [expandedReceipt, setExpandedReceipt] = useState(null);

  // ─── Socket ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chatId) return;
    socket.emit('getRunnerPayout', { chatId, runnerId });

    const onPayoutData = ({ payout: data }) => {
      console.log('Payout: received payout data', data);
      setPayout(data);
    };
    const onReceiptSuccess = ({ status, usedPayoutSystem }) => {
      setPayout(prev => prev ? { ...prev, status, usedPayoutSystem } : prev);
      setStep('overview');
      setSubmitting(false);
      setShowConfirm(false);
      resetForm();
      // Refresh receipt history
      if (payout?.orderId) dispatch(getRunnerReceipts({ orderId: payout.orderId }));
    };
    const onPaymentSuccess = () => {
      setTimeout(() => socket.emit('getRunnerPayout', { chatId, runnerId }), 1000);
    };

    socket.on('runnerPayoutData', onPayoutData);
    socket.on('payoutReceiptSuccess', onReceiptSuccess);
    socket.on('paymentSuccess', onPaymentSuccess);
    return () => {
      socket.off('runnerPayoutData', onPayoutData);
      socket.off('payoutReceiptSuccess', onReceiptSuccess);
      socket.off('paymentSuccess', onPaymentSuccess);
    };
  }, [socket, chatId, runnerId]);

  useEffect(() => {
    if (payout?.orderId) {
      dispatch(getCurrentPayout({ orderId: payout.orderId }));
      dispatch(getRunnerReceipts({ orderId: payout.orderId }));
    }
  }, [payout?.orderId, dispatch]);

  useEffect(() => {
    if (!banks || banks.length === 0) dispatch(getPayoutBanks());
  }, [dispatch, banks]);

  useEffect(() => {
    if (currentPayout && !payout) setPayout(currentPayout);
  }, [currentPayout, payout]);

  useEffect(() => {
    if (transferStatus === 'success') {
      setStep('overview');
      setShowConfirm(false);
      resetForm();
      setSubmitting(false);
      if (payout?.orderId) dispatch(getRunnerReceipts({ orderId: payout.orderId }));
      setTimeout(() => dispatch(clearTransferStatus()), 3000);
    } else if (transferStatus === 'failed') {
      setError(sliceError);
      setSubmitting(false);
      setShowConfirm(false);
    }
  }, [transferStatus, sliceError, dispatch, payout?.orderId ]);

  const resetForm = () => {
    setVendorName(''); setAmountSpent(''); setBankName(''); setBankCode('');
    setAccountNumber(''); setAccountName(''); setError(null);
  };

  const refresh = () => {
    if (socket && chatId) socket.emit('getRunnerPayout', { chatId, runnerId });
    if (payout?.orderId) {
      dispatch(getCurrentPayout({ orderId: payout.orderId }));
      dispatch(getRunnerReceipts({ orderId: payout.orderId }));
    }
  };

  const handleAccountNumberChange = async (value) => {
    setAccountNumber(value);
    setAccountName('');
    if (value.length === 10 && bankCode) {
      try {
        const result = await dispatch(verifyVendorAccount({ accountNumber: value, bankCode })).unwrap();
        if (result.data?.accountName) setAccountName(result.data.accountName);
      } catch {
        setError('Could not verify account. Please check details.');
      }
    }
  };

  const handleBankChange = (val) => {
    setBankName(val);
    const bank = banks?.find(b => b.name === val);
    if (bank) setBankCode(bank.code);
  };

  // Validate and open confirmation modal
  const handleTransferClick = () => {
    setError(null);
    if (!vendorName.trim()) return setError('Please enter vendor / market name');
    if (!amountSpent || parseFloat(amountSpent) <= 0) return setError('Please enter amount spent');
    if (parseFloat(amountSpent) > payout.itemBudget) return setError(`Amount exceeds budget of ₦${payout.itemBudget.toLocaleString()}`);
    if (!bankName.trim()) return setError('Please select a bank');
    if (!accountNumber.trim() || accountNumber.length !== 10) return setError('Please enter a valid 10-digit account number');
    if (!accountName.trim()) return setError('Account name is required. Enter manually or verify automatically');
    setShowConfirm(true);
  };

  // Confirmed — submit
  const handleConfirm = async () => {
    setSubmitting(true);
    const spent = parseFloat(amountSpent);
    const change = payout.itemBudget - spent;

    try {
      await dispatch(transferToVendor({
        orderId: payout.orderId,
        vendorName: vendorName.trim(),
        amountSpent: spent,
        changeAmount: change,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      })).unwrap();

      // Update local state optimistically
      setPayout(prev => prev ? {
        ...prev, status: 'submitted', usedPayoutSystem: true,
        vendorName: vendorName.trim(), amountSpent: spent, changeAmount: change,
      } : prev);

      // Notify via socket (sends item_submission to user's chat)
      if (socket && chatId) {
        socket.emit('submitPayoutReceipt', {
          chatId, runnerId, userId: payout.userId, orderId: payout.orderId,
          vendorName: vendorName.trim(), amountSpent: spent, changeAmount: change,
          bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim(),
        });
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Transfer failed. Please try again.');
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  // ─── Guards ───────────────────────────────────────────────────────────────────
  if (!runnerId) {
    return (
      <div className={`min-h-screen flex flex-col ${dark ? 'bg-black-100' : 'bg-white'}`}>
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${dark ? 'border-black-200' : 'border-gray-100'}`}>
          <button onClick={onBack} className="p-2 rounded-full"><ChevronLeft className={`w-5 h-5 ${dark ? 'text-white' : 'text-black-200'}`} /></button>
          <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-black-200'}`}>Shopping Budget</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <ShoppingBag className={`w-12 h-12 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
          <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>Pick a service to view this page</p>
        </div>
      </div>
    );
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────
  const isSubmitted = payout?.status === 'submitted' || payout?.status === 'approved';
  const isApproved = payout?.status === 'approved';
  const changeAmount = payout ? payout.itemBudget - parseFloat(amountSpent || 0) : 0;
  const receiptHistory = receipts || payout?.receiptHistory || [];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmModal
          dark={dark}
          vendorName={vendorName}
          accountName={accountName}
          accountNumber={accountNumber}
          bankName={bankName}
          amountSpent={amountSpent}
          changeAmount={changeAmount}
          itemBudget={payout?.itemBudget}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}

      <div className={`min-h-screen flex flex-col ${dark ? 'bg-black-100' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${dark ? 'border-black-200' : 'border-gray-100'}`}>
          <button onClick={onBack} className={`p-2 rounded-full ${dark ? 'hover:bg-black-200' : 'hover:bg-gray-100'}`}>
            <ChevronLeft className={`w-5 h-5 ${dark ? 'text-white' : 'text-black-200'}`} />
          </button>
          <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-black-200'}`}>Shopping Budget</h1>
          <button onClick={refresh} className="ml-auto p-2 rounded-full" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${dark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">

          {/* No payout yet */}
          {!payout && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 text-center py-20">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${dark ? 'bg-black-200' : 'bg-gray-100'}`}>
                <ShoppingBag className={`w-8 h-8 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>
              <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>No active shopping budget</p>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Budget appears here once the user pays for a run-errand task</p>
            </div>
          )}

          {payout && (
            <>
              {/* Budget Card */}
              <div className="px-4 pt-6 pb-4">
                <div className="bg-primary rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-5 h-5 opacity-80" />
                    <p className="text-sm opacity-80">Shopping Budget</p>
                  </div>
                  <p className="text-4xl font-bold">&#8358;{payout.itemBudget?.toLocaleString()}</p>
                  <p className="text-xs opacity-60 mt-2">Use this to purchase items, then transfer to the vendor</p>
                  {payout.usedPayoutSystem && (
                    <div className="mt-3 flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5 w-fit">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Runner fee unlocked</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning */}
              {!payout.usedPayoutSystem && !isApproved && (
                <div className="mx-4 mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    You must complete a transfer here to receive your delivery earnings. Skipping will forfeit your runner fee.
                  </p>
                </div>
              )}

              {/* Approved */}
              {isApproved && (
                <div className="mx-4 mb-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-500">Transfer Approved!</p>
                    <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                      &#8358;{payout.amountSpent?.toLocaleString()} sent to {payout.vendorName}
                      {payout.changeAmount > 0 && ` · &#8358;${payout.changeAmount?.toLocaleString()} change`}
                    </p>
                  </div>
                </div>
              )}

              {/* Submitted awaiting approval */}
              {isSubmitted && !isApproved && (
                <div className={`mx-4 mb-4 p-4 rounded-2xl border flex items-center gap-3 ${dark ? 'bg-black-200 border-primary/20' : 'bg-primary/5 border-primary/20'}`}>
                  <Receipt className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer Submitted</p>
                    <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Waiting for user to approve the items</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                </div>
              )}

              {/* Transfer Form */}
              {step === 'form' && !isSubmitted && (
                <div className={`mx-4 mb-4 rounded-2xl border overflow-hidden ${dark ? 'bg-black-200 border-black-100' : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-black-100' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-primary" />
                      <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer to Vendor</span>
                    </div>
                    <button onClick={() => { setStep('overview'); setError(null); }}>
                      <X className={`w-4 h-4 ${dark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Vendor name */}
                    <FormField label="Vendor / Market Name" icon={null} dark={dark}>
                      <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)}
                        placeholder="e.g. Balogun Market, Mama Ngozi Store"
                        className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                    </FormField>

                    {/* Amount */}
                    <FormField label="Amount Spent (&#8358;)" dark={dark}>
                      <input type="number" value={amountSpent} onChange={e => setAmountSpent(e.target.value)}
                        placeholder="0"
                        className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                      {amountSpent && parseFloat(amountSpent) > 0 && (
                        <p className={`text-xs mt-1.5 ${changeAmount >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {changeAmount >= 0
                            ? `&#8358;${changeAmount.toLocaleString()} change to return to user`
                            : `&#8358;${Math.abs(changeAmount).toLocaleString()} over budget`}
                        </p>
                      )}
                    </FormField>

                    {/* Divider */}
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 h-px ${dark ? 'bg-black-100' : 'bg-gray-200'}`} />
                      <span className={`text-xs font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Vendor Bank Details</span>
                      <div className={`flex-1 h-px ${dark ? 'bg-black-100' : 'bg-gray-200'}`} />
                    </div>

                    {/* Bank */}
                    <FormField label="Bank" icon={Building2} dark={dark}>
                      {banks?.length > 0 ? (
                        <select value={bankName} onChange={e => handleBankChange(e.target.value)}
                          className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white' : 'bg-gray-50 border-gray-200 text-black-200'}`}>
                          <option value="">Select Bank</option>
                          {banks.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={bankName} onChange={e => handleBankChange(e.target.value)}
                          placeholder="e.g. First Bank, GTBank"
                          className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                      )}
                    </FormField>

                    {/* Account Number */}
                    <FormField label="Account Number" icon={Hash} dark={dark}>
                      <input type="number" value={accountNumber} onChange={e => handleAccountNumberChange(e.target.value)}
                        placeholder="10-digit account number"
                        className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                    </FormField>

                    {/* Account Name */}
                    <FormField label="Account Name" icon={User} dark={dark}>
                      <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                        placeholder="Auto-filled on verification or enter manually"
                        className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                      {verifiedAccount && <p className="text-xs text-green-500 mt-1">&#10003; Account verified</p>}
                    </FormField>

                    {/* Error */}
                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-500">{error}</p>
                      </div>
                    )}

                    {/* Transfer Button */}
                    <button onClick={handleTransferClick}
                      className="w-full py-4 rounded-xl text-sm font-semibold text-white bg-primary flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                      <Send className="w-4 h-4" />
                      Transfer
                    </button>
                  </div>
                </div>
              )}

              {/* Overview CTA */}
              {step === 'overview' && !isSubmitted && (
                <div className="px-4 space-y-3">
                  <div className={`p-4 rounded-2xl ${dark ? 'bg-black-200' : 'bg-gray-50'}`}>
                    <p className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black-200'}`}>How it works</p>
                    <p className={`text-xs leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Use the budget to buy the items. Then enter the vendor's bank details and the amount spent — we'll generate a receipt and transfer the money to the vendor automatically.
                    </p>
                  </div>
                  <button onClick={() => setStep('form')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${dark ? 'bg-black-200 hover:bg-black-200/80' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Send className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer to Vendor</p>
                        <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Enter vendor details — receipt auto-generated</p>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
                  </button>
                </div>
              )}

              {/* Receipt History — always visible when records exist */}
              <div className="px-4 mt-4">
                <button onClick={() => setStep(step === 'receipts' ? (isSubmitted ? 'overview' : 'overview') : 'receipts')}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl ${dark ? 'bg-black-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>
                      Transfer History {receiptHistory.length > 0 ? `(${receiptHistory.length})` : ''}
                    </span>
                  </div>
                  {step === 'receipts' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {step === 'receipts' && (
                  <div className="mt-3 space-y-3">
                    {receiptHistory.length === 0 ? (
                      <div className={`p-6 text-center rounded-2xl ${dark ? 'bg-black-200' : 'bg-gray-50'}`}>
                        <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>No transfers yet</p>
                      </div>
                    ) : receiptHistory.map((r, i) => (
                      <div key={r._id || i} className={`rounded-2xl border overflow-hidden ${dark ? 'bg-black-200 border-black-100' : 'bg-white border-gray-200'}`}>
                        <button onClick={() => setExpandedReceipt(expandedReceipt === i ? null : i)}
                          className="w-full flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 text-left">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dark ? 'bg-black-100' : 'bg-gray-100'}`}>
                              <Banknote className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>
                                {r.vendorName || payout.vendorName || 'Transfer'}
                              </p>
                              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                                &#8358;{(r.amountSpent || 0).toLocaleString()} · {new Date(r.submittedAt).toLocaleDateString('en-NG')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <ReceiptStatusBadge status={r.status} />
                            {expandedReceipt === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>

                        {expandedReceipt === i && (
                          <div className={`px-4 pb-4 border-t ${dark ? 'border-black-100' : 'border-gray-100'}`}>
                            <div className="mt-3">
                              <GeneratedReceipt
                                vendorName={r.vendorName || payout.vendorName}
                                accountName={r.bankDetails?.accountName || payout.bankDetails?.accountName || '—'}
                                accountNumber={r.bankDetails?.accountNumber || payout.bankDetails?.accountNumber || '—'}
                                bankName={r.bankDetails?.bankName || payout.bankDetails?.bankName || '—'}
                                amountSpent={r.amountSpent || 0}
                                changeAmount={r.changeAmount || 0}
                                itemBudget={payout.itemBudget}
                                dark={dark}
                              />
                            </div>
                            {r.rejectionReason && (
                              <div className="mt-3 p-2 rounded-lg bg-red-500/10 text-red-500 text-xs">
                                Rejection reason: {r.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Tiny helper wrapper ──────────────────────────────────────────────────────
const FormField = ({ label, icon: Icon, children, dark }) => (
  <div>
    <label className={`flex items-center gap-1 text-xs font-medium mb-1.5 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
      {Icon && <Icon className="w-3 h-3" />} {label}
    </label>
    {children}
  </div>
);