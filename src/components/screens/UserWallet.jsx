import React, { useEffect, useState } from 'react';
import { ChevronLeft, Wallet, ArrowDownLeft, ArrowUpRight, Copy, RefreshCw, Plus } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getWalletBalance,
  getTransactionHistory,
  createVirtualAccount,
  fundWallet, verifyWalletFunding
} from '../../Redux/paymentSlice';
import PaystackPaymentModal from '../common/PaystackPaymentModal';

export default function UserWallet({ darkMode, onBack, userData }) {
  const dispatch = useDispatch();
  const wallet = useSelector(s => s.payment.wallet)
  const loading = useSelector(s => s.payment.loading);

  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);
  const [page, setPage] = useState(1);
  const [paystackModal, setPaystackModal] = useState(null);

  useEffect(() => {
    dispatch(getWalletBalance());
    dispatch(getTransactionHistory({ page: 1, limit: 20 }));
  }, [dispatch]);

  useEffect(() => {
    if (userData?._id && !wallet.virtualAccount) {
      dispatch(createVirtualAccount());
    }
  }, [userData?._id, wallet.virtualAccount, dispatch]);

  const handleCopyAccount = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFundWallet = async () => {
    if (!fundAmount || parseFloat(fundAmount) < 100) {
      alert('Minimum funding amount is ₦100');
      return;
    }

    setIsFunding(true);
    try {
      const result = await dispatch(
        fundWallet({ amount: parseFloat(fundAmount) })
      ).unwrap();

      console.log("fund result:", JSON.stringify(result));

      setPaystackModal({
        reference: result?.reference,
        amount: parseFloat(fundAmount),
        email: userData?.email,
      });

      setFundAmount('');
    } catch (error) {
      alert(error || 'Failed to initiate funding');
    } finally {
      setIsFunding(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    dispatch(getTransactionHistory({ page: nextPage, limit: 20 }));
  };

  const getTransactionIcon = (txn) => {
    if (txn.type === 'credit') {
      return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
    }
    return <ArrowUpRight className="w-4 h-4 text-red-500" />;
  };

  const getTransactionLabel = (txn) => {
    const labels = {
      'wallet_funding': 'Wallet Top-up',
      'payment': 'Order Payment',
      'refund': 'Refund',
      'withdrawal': 'Withdrawal',
    };
    return labels[txn.transactionType] || txn.description || 'Transaction';
  };

  return (
    <div
      className={`flex flex-col ${darkMode ? 'bg-black-100' : 'bg-white'}`}
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-4 border-b ${darkMode ? 'border-black-200' : 'border-gray-1001'}`}>
        <button
          onClick={onBack}
          className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-black-200' : 'hover:bg-gray-1001'}`}
        >
          <ChevronLeft className={`w-5 h-5 ${darkMode ? 'text-white' : 'text-black-200'}`} />
        </button>
        <h1 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
          My Wallet
        </h1>
        <button
          onClick={() => {
            dispatch(getWalletBalance());
            dispatch(getTransactionHistory({ page: 1, limit: 20 }));
          }}
          className="ml-auto p-2 rounded-full"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
        </button>
      </div>

      {/* Balance Card */}
      <div className="flex-shrink-0 px-4 py-6">
        <div className="bg-primary rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 opacity-80" />
            <p className="text-sm opacity-80">Available Balance</p>
          </div>
          {loading ? (
            <div className="h-10 w-32 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-4xl font-bold">
              ₦{wallet.balance?.toLocaleString() || '0'}
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-white/20 space-y-1">
            <p className="text-md text-gray-200">
              Hi, {userData?.firstName} {userData?.lastName}
            </p>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-md font-semibold opacity-90">
                  {wallet.virtualAccount?.accountNumber}
                </p>
              </div>
              {wallet.virtualAccount?.accountNumber && (
                <button
                  onClick={() => handleCopyAccount(wallet.virtualAccount.accountNumber)}
                  className="p-1 rounded-lg bg-white/20"
                >
                  <Copy className="w-3 h-3 text-white" />
                </button>
              )}
              {copied && <span className="text-xs opacity-80">✓ Copied!</span>}
            </div>
            <p className="text-xs opacity-60">
              {wallet.virtualAccount?.bankName || ''}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex-shrink-0 flex border-b px-4 ${darkMode ? 'border-black-200' : 'border-gray-1001'}`}>
        {['overview', 'fund', 'transactions'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${activeTab === tab
              ? 'text-primary border-b-2 border-primary'
              : darkMode ? 'text-gray-1002' : 'text-gray-600'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 marketSelection">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="px-4 py-4 pb-8 space-y-4">
            {/* <div className={`rounded-2xl p-4 border ${darkMode ? 'bg-black-200 border-black-200' : 'bg-gray-1001 border-gray-1001'}`}>
              <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Fund via Bank Transfer
              </p>

              {wallet.virtualAccount ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>Bank Name</span>
                    <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                      {wallet.virtualAccount.bankName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>Account Name</span>
                    <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                      {wallet.virtualAccount.accountName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                        {wallet.virtualAccount.accountNumber}
                      </span>
                      <button
                        onClick={() => handleCopyAccount(wallet.virtualAccount.accountNumber)}
                        className="p-1 rounded-lg bg-primary/20"
                      >
                        <Copy className="w-3 h-3 text-primary" />
                      </button>
                    </div>
                  </div>
                  {copied && (
                    <p className="text-xs text-primary text-center">✓ Copied!</p>
                  )}
                  <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                    Transfer any amount to this account to fund your wallet instantly.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className={`ml-2 text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                    Setting up your account...
                  </span>
                </div>
              )}
            </div> */}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('fund')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/10"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  Fund Wallet
                </span>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-black-100' : 'bg-white'}`}>
                  <ArrowDownLeft className="w-5 h-5 text-secondary" />
                </div>
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  History
                </span>
              </button>
            </div>

            {wallet.transactions?.length > 0 && (
              <div>
                <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  Recent Transactions
                </p>
                <div className="space-y-2">
                  {wallet.transactions.slice(0, 3).map((txn, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${txn.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {getTransactionIcon(txn)}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                          {getTransactionLabel(txn)}
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                          {new Date(txn.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                        {txn.type === 'credit' ? '+' : '-'}₦{txn.amount?.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FUND TAB */}
        {activeTab === 'fund' && (
          <div className="flex flex-col px-4 py-4 gap-4" style={{ minHeight: '100%' }}>
            <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
              Fund your wallet using your card via Paystack.
            </p>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-1002' : 'text-black-200'}`}>
                Amount (₦)
              </label>
              <input
                type="number"
                min="100"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="Enter amount e.g. 5000"
                className={`w-full p-4 rounded-xl border outline-none text-lg font-medium ${darkMode
                  ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                  : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                  }`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1000, 2000, 5000, 10000, 20000, 50000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setFundAmount(amount.toString())}
                  className={`py-2 rounded-xl text-sm font-medium transition-colors ${fundAmount === amount.toString()
                    ? 'bg-primary text-white'
                    : darkMode
                      ? 'bg-black-200 text-gray-1002 hover:bg-primary/20'
                      : 'bg-gray-1001 text-black-200 hover:bg-primary/10'
                    }`}
                >
                  ₦{amount.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Sticky fund button */}
            <div className={`sticky bottom-0 pt-3 pb-4 -mx-4 px-4 mt-auto ${darkMode ? 'bg-black-100' : 'bg-white'}`}>
              <button
                onClick={handleFundWallet}
                disabled={isFunding || !fundAmount || parseFloat(fundAmount) < 100}
                className={`w-full py-4 rounded-xl font-semibold text-white bg-primary transition-all ${isFunding || !fundAmount || parseFloat(fundAmount) < 100
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:opacity-90'
                  }`}
              >
                {isFunding ? 'Processing...' : `Fund ₦${parseFloat(fundAmount || 0).toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div className="px-4 py-4 pb-8 space-y-2">
            {loading && wallet.transactions?.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : wallet.transactions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Wallet className={`w-12 h-12 mb-3 ${darkMode ? 'text-gray-1002' : 'text-gray-400'}`} />
                <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                  No transactions yet
                </p>
              </div>
            ) : (
              <>
                {wallet.transactions.map((txn, i) => (
                  <div key={i} className={`flex items-center gap-3 p-4 rounded-xl ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${txn.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {getTransactionIcon(txn)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-black-200'}`}>
                        {getTransactionLabel(txn)}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                        {new Date(txn.createdAt).toLocaleDateString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                        {txn.type === 'credit' ? '+' : '-'}₦{txn.amount?.toLocaleString()}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${txn.status === 'completed'
                        ? 'bg-green-500/10 text-green-500'
                        : txn.status === 'failed'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-primary/10 text-primary'
                        }`}>
                        {txn.status}
                      </span>
                    </div>
                  </div>
                ))}

                {wallet.pagination?.pages > page && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className={`w-full py-3 rounded-xl text-sm font-medium ${darkMode
                      ? 'bg-black-200 text-gray-1002'
                      : 'bg-gray-1001 text-black-200'
                      }`}
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {paystackModal && (
        <PaystackPaymentModal
          reference={paystackModal.reference}
          amount={paystackModal.amount}
          email={paystackModal.email}
          darkMode={darkMode}
          onSuccess={async (ref) => {
            setPaystackModal(null);
            try {
              await dispatch(verifyWalletFunding({ reference: ref.reference })).unwrap();
            } catch (err) {
              console.error('Verify failed:', err);
            } finally {
              dispatch(getWalletBalance());
              dispatch(getTransactionHistory({ page: 1, limit: 20 }));
            }
          }}
          onCancel={() => setPaystackModal(null)}
        />
      )}
    </div>
  );
}