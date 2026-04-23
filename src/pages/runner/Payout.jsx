import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ShoppingBag, CheckCircle, Receipt, RefreshCw,
  ArrowRight, Building2, Hash, AlertCircle,
  Send, X, Banknote, User, ArrowUpRight
} from 'lucide-react';

import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import {
  getCurrentPayout, transferToVendor, getPayoutBanks,
  verifyVendorAccount, clearTransferStatus, getRunnerReceipts,
} from '../../Redux/payoutSlice';
import { PinPad } from '../../components/common/PinPad';
import { getWalletBalance } from '../../Redux/paymentSlice';

// ─── Receipt Modal ────────────────────────────────────────────────────────────
const ReceiptModal = ({ receipt, payout, dark, onClose }) => {
  if (!receipt) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div className={`w-full max-w-md rounded-3xl overflow-hidden ${dark ? 'bg-black-200' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-black-100' : 'border-gray-100'}`}>
          <p className={`font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer Receipt</p>
          <button onClick={onClose} className={`p-1.5 rounded-full ${dark ? 'hover:bg-black-100' : 'hover:bg-gray-100'}`}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Amount hero */}
          <div className="bg-primary rounded-2xl px-5 py-6 text-white text-center">
            <p className="text-xs opacity-70 uppercase tracking-widest mb-1">Amount Transferred</p>
            <p className="text-3xl font-bold">₦{(receipt.amountSpent || 0).toLocaleString()}</p>
            <p className="text-xs opacity-60 mt-1">
              {new Date(receipt.submittedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          {/* Details */}
          <div className={`rounded-2xl border divide-y ${dark ? 'border-black-100 divide-black-100' : 'border-gray-100 divide-gray-100'}`}>
            <ReceiptRow label="Transaction Id" value={receipt._id?.toString() || '—'} dark={dark} bold />
            <ReceiptRow label="To" value={receipt.vendorName || payout?.vendorName || '—'} dark={dark} bold />
            <ReceiptRow label="Bank" value={receipt.bankDetails?.bankName || '—'} dark={dark} />
            <ReceiptRow label="Account" value={receipt.bankDetails?.accountNumber || '—'} dark={dark} />
            <ReceiptRow label="Account Name" value={receipt.bankDetails?.accountName || '—'} dark={dark} />
            <ReceiptRow label="Budget" value={`₦${(payout?.itemBudget || 0).toLocaleString()}`} dark={dark} />
            <ReceiptRow label="Spent" value={`₦${(receipt.amountSpent || 0).toLocaleString()}`} dark={dark} />
            {(receipt.changeAmount || 0) > 0 && (
              <ReceiptRow label="Change to Return" value={`₦${receipt.changeAmount.toLocaleString()}`} dark={dark} color="text-green-500" />
            )}
            {(receipt.changeAmount || 0) < 0 && (
              <ReceiptRow label="Over Budget" value={`₦${Math.abs(receipt.changeAmount).toLocaleString()}`} dark={dark} color="text-red-500" />
            )}
          </div>

          {receipt.rejectionReason && (
            <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-xs">
              Rejection reason: {receipt.rejectionReason}
            </div>
          )}
        </div>

        <div className={`px-5 py-4 border-t ${dark ? 'border-black-100' : 'border-gray-100'}`}>
          <button onClick={onClose}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${dark ? 'bg-black-100 text-white' : 'bg-gray-100 text-black-200'}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ReceiptRow = ({ label, value, bold, color, dark }) => (
  <div className="flex justify-between items-center gap-2 px-4 py-3">
    <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
    <span className={`text-xs font-${bold ? 'semibold' : 'medium'} text-right ${color || (dark ? 'text-white' : 'text-black-200')}`}>{value}</span>
  </div>
);

// ─── Confirm Transfer Modal ───────────────────────────────────────────────────
const ConfirmModal = ({ dark, vendorName, accountName, accountNumber, bankName, amountSpent, changeAmount, itemBudget, onConfirm, onCancel, submitting }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
    <div className={`w-full max-w-md rounded-3xl overflow-hidden ${dark ? 'bg-black-200' : 'bg-white'}`}>
      <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-black-100' : 'border-gray-100'}`}>
        <p className={`font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Confirm Transfer</p>
        <button onClick={onCancel} className={`p-1.5 rounded-full ${dark ? 'hover:bg-black-100' : 'hover:bg-gray-100'}`}>
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Once confirmed, the transfer will be sent immediately to the vendor.
        </p>

        {/* Summary */}
        <div className={`rounded-2xl border divide-y ${dark ? 'border-black-100 divide-black-100' : 'border-gray-100 divide-gray-100'}`}>
          <ReceiptRow label="To" value={vendorName} dark={dark} bold />
          <ReceiptRow label="Bank" value={bankName} dark={dark} />
          <ReceiptRow label="Account" value={accountNumber} dark={dark} />
          <ReceiptRow label="Account Name" value={accountName} dark={dark} />
          <ReceiptRow label="Budget" value={`₦${parseFloat(itemBudget || 0).toLocaleString()}`} dark={dark} />
          <ReceiptRow label="Sending" value={`₦${parseFloat(amountSpent || 0).toLocaleString()}`} dark={dark} />
          {parseFloat(changeAmount) > 0 && (
            <ReceiptRow label="Change to Return" value={`₦${parseFloat(changeAmount).toLocaleString()}`} dark={dark} color="text-green-500" />
          )}
          {parseFloat(changeAmount) < 0 && (
            <ReceiptRow label="Over Budget" value={`₦${Math.abs(parseFloat(changeAmount)).toLocaleString()}`} dark={dark} color="text-red-500" />
          )}
        </div>
      </div>

      <div className={`px-5 py-4 border-t flex gap-3 ${dark ? 'border-black-100' : 'border-gray-100'}`}>
        <button onClick={onCancel} disabled={submitting}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${dark ? 'border-black-100 text-gray-400 hover:bg-black-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Edit
        </button>
        <button onClick={onConfirm} disabled={submitting}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-primary transition-all ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95'}`}>
          {submitting ? 'Sending...' : 'Confirm & Send'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const Payout = ({ darkMode, onBack, socket, runnerId, chatId, currentOrder }) => {
  const dark = darkMode;
  const dispatch = useDispatch();

  const currentPayout = useSelector(s => s.payout.currentPayout);
  const receipts = useSelector(s => s.payout.receipts, shallowEqual);
  const transferStatus = useSelector(s => s.payout.transferStatus);
  const sliceError = useSelector(s => s.payout.error);
  const loading = useSelector(s => s.payout.loading);
  const banks = useSelector(s => s.payout.banks, shallowEqual);
  const isPinSet = useSelector(s => s.pin.isPinSet);

  const [payout, setPayout] = useState(null);
  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer' | 'transactions'
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [vendorName, setVendorName] = useState('');
  const [amountSpent, setAmountSpent] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [authorisedPin, setAuthorisedPin] = useState(null);
  const [payoutResolved, setPayoutResolved] = useState(false);
  const [payoutLocked, setPayoutLocked] = useState(false);
  const [lockReason, setLockReason] = useState(null);

  const isSubmittingRef = useRef(false);
  const payoutFetchedRef = useRef(null); // stores the orderId it fetched for, not just a bool
  const mountedAtRef = useRef(Date.now());


  useEffect(() => {
    // If currentOrder changed (new order), wipe stale payout immediately
    if (!currentOrder?.orderId) return;
    if (payout && payout.orderId !== currentOrder.orderId) {
      setPayout(null);
      setPayoutResolved(false);
      setActiveTab('transfer');
      payoutFetchedRef.current = null; 
    }
  }, [currentOrder?.orderId]);


  // ─── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const orderId = currentOrder?.orderId;

    console.log('[Payout] socket effect triggered', {
      socket: !!socket,
      orderId,
      alreadyFetched: payoutFetchedRef.current,
      orderId: currentOrder?.orderId
    });

    if (!socket || !chatId || orderId) {
      console.log('[Payout] early return — reason:', !socket ? 'no socket' : !orderId ? 'no orderId' : 'already fetched for this orderId');
      return;
    }
    payoutFetchedRef.current = orderId;
    setPayout(null);
    setPayoutResolved(false);
    setActiveTab('transfer');
    socket.emit('getRunnerPayout', { chatId, runnerId, orderId });
    console.log('[Payout] emitted getRunnerPayout', { chatId, runnerId, orderId: currentOrder?.orderId });


    const onPayoutData = ({ payout: data }) => {
      console.log('[Payout] runnerPayoutData received:', data);
      if (data?.orderId && data.orderId !== orderId) return;
      setPayout(data);
      if (data?.status === 'locked') {
        setPayoutLocked(true);
        setLockReason('Payout is locked pending admin review of a dispute.');
      } else {
        setPayoutLocked(false);
        setLockReason(null);
      }
      setPayoutResolved(true);
      if (data?.orderId) dispatch(getRunnerReceipts({ orderId: data.orderId }));
    };

    const onReceiptSuccess = ({ status, usedPayoutSystem }) => {
      setPayout(prev => prev ? { ...prev, status, usedPayoutSystem } : prev);
      setActiveTab('transactions');
      setSubmitting(false);
      setShowConfirm(false);
      resetForm();
      if (payout?.orderId) dispatch(getRunnerReceipts({ orderId: payout.orderId }));
    };

    const onPaymentSuccess = () => {
      if (!payout) socket.emit('getRunnerPayout', { chatId, runnerId });
    };

    const onItemSubmissionUpdated = ({ status }) => {
      if (status === 'approved') {
        payoutFetchedRef.current = null;
        socket.emit('getRunnerPayout', {
          chatId,
          runnerId,
          orderId: currentOrder?.orderId
        });
      }
    };

    const onPayoutStatusUpdated = ({ status, orderId }) => {
      setPayout(prev => prev ? { ...prev, status } : prev);
      if (orderId) {
        dispatch(getCurrentPayout({ orderId }));
        dispatch(getRunnerReceipts({ orderId }));
      }
    };

    const onPayoutLocked = ({ reason }) => {
      setPayoutLocked(true);
      setLockReason(reason || 'Payout locked pending admin review.');
    };

    const onPayoutUnlocked = () => {
      setPayoutLocked(false);
      setLockReason(null);
    };

    socket.on('runnerPayoutData', onPayoutData);
    socket.on('payoutReceiptSuccess', onReceiptSuccess);
    socket.on('paymentSuccess', onPaymentSuccess);
    socket.on('itemSubmissionUpdated', onItemSubmissionUpdated);
    socket.on('payoutStatusUpdated', onPayoutStatusUpdated);
    socket.on('payoutLocked', onPayoutLocked);
    socket.on('payoutUnlocked', onPayoutUnlocked);

    return () => {
      socket.off('runnerPayoutData', onPayoutData);
      socket.off('payoutReceiptSuccess', onReceiptSuccess);
      socket.off('paymentSuccess', onPaymentSuccess);
      socket.off('itemSubmissionUpdated', onItemSubmissionUpdated);
      socket.off('payoutStatusUpdated', onPayoutStatusUpdated);
      socket.off('payoutLocked', onPayoutLocked);
      socket.off('payoutUnlocked', onPayoutUnlocked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chatId, runnerId, currentOrder?.orderId, mountedAtRef.current]);

  useEffect(() => {
    if (!socket || !chatId || !currentOrder?.orderId) return;
    // orderId changed on same chatId — new order started
    setPayout(null);
    setPayoutResolved(false);
    setActiveTab('transfer');
    payoutFetchedRef.current = chatId; // keep chatId guard intact
    socket.emit('getRunnerPayout', { chatId, runnerId, orderId: currentOrder.orderId });
  }, [currentOrder?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!banks || banks.length === 0) dispatch(getPayoutBanks());
  }, [dispatch, banks]);

  useEffect(() => {
    if (!currentPayout) return;
    setPayout(prev => prev ? { ...prev, ...currentPayout } : currentPayout);
  }, [currentPayout]);

  useEffect(() => {
    if (transferStatus === 'success') {
      setActiveTab('transactions');
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
  }, [transferStatus, sliceError, dispatch, payout?.orderId]);

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
        const name = result?.accountName || result?.data?.accountName
          || result?.account_name || result?.data?.account_name;
        if (name) setAccountName(name);
        else setError('Could not verify account. Please check details.');
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

  const handleTransferClick = () => {
    setError(null);
    if (!vendorName.trim()) return setError('Please enter vendor / market name');
    if (!amountSpent || parseFloat(amountSpent) <= 0) return setError('Please enter amount spent');
    if (parseFloat(amountSpent) > payout.itemBudget) return setError(`Amount exceeds budget of ₦${payout.itemBudget.toLocaleString()}`);
    if (!bankName.trim()) return setError('Please select a bank');
    if (!accountNumber.trim() || accountNumber.length !== 10) return setError('Please enter a valid 10-digit account number');
    if (!accountName.trim()) return setError('Account name is required. Enter manually or verify automatically');
    if (!isPinSet) {
      setError('You need to set a transaction PIN before making transfers. Go to Profile → Security.');
      return;
    }
    setShowPinPad(true);
  };

  const handlePinVerified = (pin) => {
    setAuthorisedPin(pin);
    setShowPinPad(false);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    const spent = parseFloat(amountSpent);
    const change = Math.round((payout.itemBudget - spent) * 100) / 100;

    try {
      await dispatch(transferToVendor({
        orderId: payout.orderId,
        vendorName: vendorName.trim(),
        amountSpent: spent,
        changeAmount: change,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        pin: authorisedPin,
      })).unwrap();

      socket?.emit('payoutReceiptSubmitted', { orderId: payout.orderId, usedPayoutSystem: true });

      setAuthorisedPin(null);
      setPayout(prev => prev ? {
        ...prev, status: 'submitted', usedPayoutSystem: true,
        vendorName: vendorName.trim(), amountSpent: spent, changeAmount: change,
      } : prev);

      dispatch(getWalletBalance());

      isSubmittingRef.current = false;
    } catch (err) {
      setAuthorisedPin(null);
      setError(typeof err === 'string' ? err : 'Transfer failed. Please try again.');
      setSubmitting(false);
      setShowConfirm(false);
      isSubmittingRef.current = false;
    }
  };

  // ─── Guard ────────────────────────────────────────────────────────────────
  if (!runnerId) {
    return (
      <div className={`h-full flex flex-col ${dark ? 'bg-black-100' : 'bg-white'}`}>
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${dark ? 'border-black-200' : 'border-gray-100'}`}>
          <button onClick={onBack} className="p-2 rounded-full">
            <ChevronLeft className={`w-5 h-5 ${dark ? 'text-white' : 'text-black-200'}`} />
          </button>
          <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-black-200'}`}>Shopping Budget</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <ShoppingBag className={`w-12 h-12 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
          <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>Pick a service to view this page</p>
        </div>
      </div>
    );
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  // Only treat as submitted if the payout doc is for THIS chat — not a stale one from a previous order
  const isSubmitted = payout?.chatId === chatId &&
    (payout?.status === 'submitted' || payout?.status === 'approved');
  const isApproved = payout?.chatId === chatId && payout?.status === 'approved';
  const changeAmount = payout
    ? Math.round((payout.itemBudget - parseFloat(amountSpent || 0)) * 100) / 100
    : 0;
  const receiptHistory = receipts || payout?.receiptHistory || [];

  return (
    <>
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

      {showPinPad && (
        <PinPad
          dark={dark}
          title="Authorise Transfer"
          subtitle={`Confirm ₦${parseFloat(amountSpent || 0).toLocaleString()} to ${vendorName || 'vendor'}`}
          onVerified={handlePinVerified}
          onCancel={() => setShowPinPad(false)}
        />
      )}

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          payout={payout}
          dark={dark}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      <div className={`h-screen flex flex-col ${dark ? 'bg-black-100' : 'bg-white'}`}>
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

        <div className="flex-1 overflow-y-auto pb-16 marketSelection">

          {/* Loading — waiting for first socket response */}
          {!payoutResolved && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 text-center py-20">
              <RefreshCw className={`w-6 h-6 animate-spin ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
          )}

          {/* Resolved but no payout doc — user hasn't paid yet */}
          {payoutResolved && !payout && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 text-center py-20">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${dark ? 'bg-black-200' : 'bg-gray-100'}`}>
                <ShoppingBag className={`w-8 h-8 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>
              <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>No active shopping budget</p>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Budget appears here once the user approves items</p>
            </div>
          )}

          {payout && (
            <>
              {/* Budget Card */}
              <div className="px-4 pt-6 pb-5">
                <div className="bg-primary rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-5 h-5 opacity-80" />
                    <p className="text-sm opacity-80">Shopping Budget</p>
                  </div>
                  <p className="text-4xl font-bold">&#8358;{payout.itemBudget?.toLocaleString()}</p>
                  <p className="text-xs opacity-60 mt-2">Use this to purchase items, then transfer to the vendor</p>

                  {payout.amountSpent > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-sm font-semibold">
                      <span className="opacity-70">Spent: ₦{payout.amountSpent.toLocaleString()}</span>
                      <span className="opacity-70">
                        Remaining: ₦{(payout.itemBudget - payout.amountSpent).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status banners */}
              {!payout.usedPayoutSystem && !isApproved && (
                <div className="mx-4 mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    You must complete a transfer here to receive your delivery earnings. Skipping will forfeit your runner fee.
                  </p>
                </div>
              )}

              {isApproved && (
                <div className="mx-4 mb-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-500">Transfer Approved</p>
                    <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                      ₦{payout.amountSpent?.toLocaleString()} sent to {payout.vendorName}
                      {payout.changeAmount > 0 && ` · ₦${payout.changeAmount?.toLocaleString()} change`}
                    </p>
                  </div>
                </div>
              )}

              {isSubmitted && !isApproved && (
                <div className={`mx-4 mb-4 p-4 rounded-2xl border flex items-center gap-3 ${dark ? 'bg-black-200 border-primary/20' : 'bg-primary/5 border-primary/20'}`}>
                  <Receipt className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer Sent</p>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className={`mx-4 mb-4 flex rounded-xl p-1 ${dark ? 'bg-black-200' : 'bg-gray-100'}`}>
                {['transfer', 'transactions'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab
                      ? dark
                        ? 'bg-black-100 text-white shadow'
                        : 'bg-white text-black-200 shadow'
                      : dark
                        ? 'text-gray-500'
                        : 'text-gray-400'
                      }`}
                  >
                    {tab}
                    {tab === 'transactions' && receiptHistory.length > 0 && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab
                        ? 'bg-primary/20 text-primary'
                        : dark ? 'bg-black-100 text-gray-500' : 'bg-gray-200 text-gray-400'
                        }`}>
                        {receiptHistory.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Transfer Tab ────────────────────────────────────────────── */}
              {activeTab === 'transfer' && (
                <div className="px-4 space-y-4">
                  {payoutLocked ? (
                    <div className={`p-6 rounded-2xl border flex flex-col items-center gap-3 text-center ${dark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                      }`}>
                      <AlertCircle className="w-8 h-8 text-primary" />
                      <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-black-200'}`}>
                        Payout Locked
                      </p>
                      <p className="text-xs text-red-400 leading-relaxed">{lockReason}</p>
                    </div>
                  ) : isSubmitted ? (
                    <div className={`p-5 rounded-2xl text-center ${dark ? 'bg-black-200' : 'bg-gray-50'}`}>
                      <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer already sent</p>
                      <p className={`text-xs mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Check the Transactions tab for details</p>
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className="mt-3 text-xs text-primary font-semibold flex items-center gap-1 mx-auto"
                      >
                        View transactions <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* How it works */}
                      <div className={`p-4 rounded-2xl ${dark ? 'bg-black-200' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black-200'}`}>How it works</p>
                        <p className={`text-xs leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Use the budget to buy the items. Enter the vendor's bank details and the amount spent — we'll transfer the money directly to the vendor.
                        </p>
                      </div>

                      {/* Form */}
                      <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-black-200 border-black-100' : 'bg-white border-gray-200'}`}>
                        <div className={`flex items-center gap-2 px-4 py-3 border-b ${dark ? 'border-black-100' : 'border-gray-100'}`}>
                          <Banknote className="w-4 h-4 text-primary" />
                          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>Transfer to Vendor</span>
                        </div>

                        <div className="p-4 space-y-4">
                          <FormField label="Vendor / Market Name" dark={dark}>
                            <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)}
                              placeholder="e.g. Balogun Market, Mama Ngozi Store"
                              className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                          </FormField>

                          <FormField label="Amount Spent (₦)" dark={dark}>
                            <input
                              type="text" inputMode="numeric" value={amountSpent}
                              onChange={e => setAmountSpent(e.target.value.replace(/[^0-9.]/g, ''))}
                              placeholder="0"
                              className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                            {amountSpent && parseFloat(amountSpent) > 0 && (
                              <p className={`text-xs mt-1.5 ${changeAmount >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                {changeAmount >= 0
                                  ? `₦${changeAmount.toLocaleString()} change to return to user`
                                  : `₦${Math.abs(changeAmount).toLocaleString()} over budget`}
                              </p>
                            )}
                          </FormField>

                          <div className="flex items-center gap-2">
                            <div className={`flex-1 h-px ${dark ? 'bg-black-100' : 'bg-gray-200'}`} />
                            <span className={`text-xs font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Vendor Bank Details</span>
                            <div className={`flex-1 h-px ${dark ? 'bg-black-100' : 'bg-gray-200'}`} />
                          </div>

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

                          <FormField label="Account Number" icon={Hash} dark={dark}>
                            <input type="number" value={accountNumber} onChange={e => handleAccountNumberChange(e.target.value)}
                              placeholder="10-digit account number"
                              className={`w-full p-3 rounded-xl text-sm border outline-none ${dark ? 'bg-black-100 border-black-100 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black-200 placeholder-gray-400'}`} />
                          </FormField>

                          <FormField label="Account Name" icon={User} dark={dark}>
                            <div className={`w-full p-3 rounded-xl text-sm border ${accountName
                              ? dark ? 'bg-black-100 border-green-500/40 text-white' : 'bg-gray-50 border-green-500/40 text-black-200'
                              : dark ? 'bg-black-100 border-black-100 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'
                              }`}>
                              {accountName
                                ? <span className="flex items-center gap-2">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                  {accountName}
                                </span>
                                : accountNumber.length === 10 && bankCode
                                  ? <span className="text-xs animate-pulse">Verifying account...</span>
                                  : <span className="text-xs">Enter account number to auto-verify</span>
                              }
                            </div>
                          </FormField>

                          {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10">
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                              <p className="text-xs text-red-500">{error}</p>
                            </div>
                          )}

                          <button onClick={handleTransferClick}
                            className="w-full py-4 rounded-xl text-sm font-semibold text-white bg-primary flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                            <Send className="w-4 h-4" />
                            Transfer
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Transactions Tab ─────────────────────────────────────────── */}
              {activeTab === 'transactions' && (
                <div className="px-4 space-y-3">
                  {receiptHistory.length === 0 ? (
                    <div className={`p-10 text-center rounded-2xl ${dark ? 'bg-black-200' : 'bg-gray-50'}`}>
                      <Receipt className={`w-8 h-8 mx-auto mb-2 ${dark ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>No transfers yet</p>
                    </div>
                  ) : receiptHistory.map((r, i) => (
                    <button
                      key={r._id || i}
                      onClick={() => setSelectedReceipt(r)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-colors text-left ${dark
                        ? 'bg-black-200 border-black-100 hover:border-primary/30'
                        : 'bg-white border-gray-100 hover:border-primary/30'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dark ? 'bg-black-100' : 'bg-gray-100'}`}>
                          <Banknote className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>
                            {r.vendorName || payout.vendorName || 'Transfer'}
                          </p>
                          <p className={`text-xs mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {new Date(r.submittedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}
                            {new Date(r.submittedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-black-200'}`}>
                          ₦{(r.amountSpent || 0).toLocaleString()}
                        </p>
                        <ArrowUpRight className="w-4 h-4 text-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => dispatch(getWalletBalance())}
              className="mx-4 mb-4 py-2 px-4 rounded-xl text-xs font-mono bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"
            >
              [DEV] Refresh Wallet Balance
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const FormField = ({ label, icon: Icon, children, dark }) => (
  <div>
    <label className={`flex items-center gap-1 text-xs font-medium mb-1.5 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
      {Icon && <Icon className="w-3 h-3" />} {label}
    </label>
    {children}
  </div>
);