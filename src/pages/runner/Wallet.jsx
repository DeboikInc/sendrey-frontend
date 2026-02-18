import { 
ChevronLeft, 
Loader2, 
ArrowDownLeft, ArrowUpRight, 
Wallet as WalletIcon, 
RefreshCw, 
Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { 
  getWalletBalance, 
  getTransactionHistory,
  withdrawFromWallet,
  getBanks,
  verifyAccount
} from "../../Redux/paymentSlice";

export const Wallet = ({ darkMode, onBack, runnerId }) => {
  const dark = darkMode;
  const dispatch = useDispatch();
  const { wallet, banks, loading } = useSelector((state) => state.payment);

  const [activeTab, setActiveTab] = useState('overview');
  const [page, setPage] = useState(1);

  // Withdraw form state
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [verifiedAccount, setVerifiedAccount] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStep, setWithdrawStep] = useState('form'); // form | confirm | success

  useEffect(() => {
    dispatch(getWalletBalance());
    dispatch(getTransactionHistory({ page: 1, limit: 20 }));
    dispatch(getBanks());
  }, [dispatch]);

  const filteredBanks = banks?.filter(bank =>
    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  ) || [];

  const handleVerifyAccount = async () => {
    if (!accountNumber || accountNumber.length !== 10 || !selectedBank) {
      alert('Please enter a valid 10-digit account number and select a bank');
      return;
    }

    setIsVerifying(true);
    setVerifiedAccount(null);

    try {
      const result = await dispatch(verifyAccount({
        accountNumber,
        bankCode: selectedBank.code
      })).unwrap();

      setVerifiedAccount(result.data);
    } catch (error) {
      alert(error || 'Could not verify account. Please check details.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) < 100) {
      alert('Minimum withdrawal is ₦100');
      return;
    }

    if (parseFloat(withdrawAmount) > wallet.balance) {
      alert('Insufficient wallet balance');
      return;
    }

    if (!verifiedAccount || !selectedBank) {
      alert('Please verify your bank account first');
      return;
    }

    setWithdrawStep('confirm');
  };

  const handleConfirmWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      await dispatch(withdrawFromWallet({
        amount: parseFloat(withdrawAmount),
        bankDetails: {
          accountNumber,
          bankCode: selectedBank.code,
          accountName: verifiedAccount.account_name
        }
      })).unwrap();

      setWithdrawStep('success');
      dispatch(getWalletBalance());
      dispatch(getTransactionHistory({ page: 1, limit: 20 }));
    } catch (error) {
      alert(error || 'Withdrawal failed. Please try again.');
      setWithdrawStep('form');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const resetWithdrawForm = () => {
    setAccountNumber('');
    setSelectedBank(null);
    setBankSearch('');
    setVerifiedAccount(null);
    setWithdrawAmount('');
    setWithdrawStep('form');
  };

  const getTransactionLabel = (txn) => {
    const labels = {
      'wallet_funding': 'Wallet Top-up',
      'payment': 'Order Payment',
      'refund': 'Refund',
      'withdrawal': 'Withdrawal',
      'payout': 'Delivery Payout',
      'item_budget': 'Item Budget Release',
    };
    return labels[txn.transactionType] || txn.description || 'Transaction';
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    dispatch(getTransactionHistory({ page: nextPage, limit: 20 }));
  };

  return (
    <div className={`min-h-screen flex flex-col ${dark ? 'bg-black-100' : 'bg-white'}`}>

      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b ${
        dark ? 'border-black-200' : 'border-gray-1001'
      }`}>
        <button
          onClick={onBack}
          className={`p-2 rounded-full transition-colors ${
            dark ? 'hover:bg-black-200' : 'hover:bg-gray-1001'
          }`}
        >
          <ChevronLeft className={`w-5 h-5 ${dark ? 'text-white' : 'text-black-200'}`} />
        </button>
        <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-black-200'}`}>
          My Wallet
        </h1>
        <button
          onClick={() => {
            dispatch(getWalletBalance());
            dispatch(getTransactionHistory({ page: 1, limit: 20 }));
          }}
          className="ml-auto p-2 rounded-full"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${
            dark ? 'text-gray-1002' : 'text-gray-600'
          }`} />
        </button>
      </div>

      {/* Balance Card */}
      <div className="px-4 py-6">
        <div className="bg-primary rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <WalletIcon className="w-5 h-5 opacity-80" />
            <p className="text-sm opacity-80">Available Balance</p>
          </div>
          {loading ? (
            <div className="h-10 w-32 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-4xl font-bold">
              ₦{wallet.balance?.toLocaleString() || '0'}
            </p>
          )}
          <p className="text-xs opacity-60 mt-2">
            Earnings from completed deliveries
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b px-4 ${dark ? 'border-black-200' : 'border-gray-1001'}`}>
        {['overview', 'withdraw', 'transactions'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : dark ? 'text-gray-1002' : 'text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl ${dark ? 'bg-black-200' : 'bg-gray-1001'}`}>
              <p className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black-200'}`}>
                How earnings work
              </p>
              <p className={`text-xs leading-relaxed ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>
                After each successful delivery, your earnings are credited to your wallet automatically.
                You can withdraw to any Nigerian bank account at any time.
              </p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('withdraw')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/10"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>
                  Withdraw
                </span>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${
                  dark ? 'bg-black-200' : 'bg-gray-1001'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  dark ? 'bg-black-100' : 'bg-white'
                }`}>
                  <ArrowDownLeft className="w-5 h-5 text-secondary" />
                </div>
                <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>
                  History
                </span>
              </button>
            </div>

            {/* Recent transactions */}
            {wallet.transactions?.length > 0 && (
              <div>
                <p className={`text-sm font-semibold mb-3 ${dark ? 'text-white' : 'text-black-200'}`}>
                  Recent Transactions
                </p>
                <div className="space-y-2">
                  {wallet.transactions.slice(0, 3).map((txn, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${
                      dark ? 'bg-black-200' : 'bg-gray-1001'
                    }`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        txn.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        {txn.type === 'credit'
                          ? <ArrowDownLeft className="w-4 h-4 text-green-500" />
                          : <ArrowUpRight className="w-4 h-4 text-red-500" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>
                          {getTransactionLabel(txn)}
                        </p>
                        <p className={`text-xs ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>
                          {new Date(txn.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${
                        txn.type === 'credit' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {txn.type === 'credit' ? '+' : '-'}₦{txn.amount?.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WITHDRAW TAB */}
        {activeTab === 'withdraw' && (
          <div className="space-y-4">

            {/* Success state */}
            {withdrawStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <ArrowUpRight className="w-8 h-8 text-green-500" />
                </div>
                <h3 className={`text-lg font-bold ${dark ? 'text-white' : 'text-black-200'}`}>
                  Withdrawal Initiated!
                </h3>
                <p className={`text-sm text-center ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>
                  ₦{parseFloat(withdrawAmount).toLocaleString()} will be credited to {verifiedAccount?.account_name} within minutes.
                </p>
                <button
                  onClick={resetWithdrawForm}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
                >
                  Done
                </button>
              </div>
            )}

            {/* Confirm state */}
            {withdrawStep === 'confirm' && (
              <div className="space-y-4">
                <h3 className={`text-base font-bold ${dark ? 'text-white' : 'text-black-200'}`}>
                  Confirm Withdrawal
                </h3>

                <div className={`p-4 rounded-2xl space-y-3 ${dark ? 'bg-black-200' : 'bg-gray-1001'}`}>
                  <div className="flex justify-between">
                    <span className={`text-sm ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>Amount</span>
                    <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-black-200'}`}>
                      ₦{parseFloat(withdrawAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>Bank</span>
                    <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>
                      {selectedBank?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>Account</span>
                    <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>
                      {accountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>Name</span>
                    <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-black-200'}`}>
                      {verifiedAccount?.account_name}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setWithdrawStep('form')}
                    disabled={isWithdrawing}
                    className={`flex-1 py-3 rounded-xl font-semibold ${
                      dark ? 'bg-black-200 text-white' : 'bg-gray-1001 text-black-200'
                    }`}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmWithdraw}
                    disabled={isWithdrawing}
                    className={`flex-1 py-3 rounded-xl font-semibold bg-primary text-white ${
                      isWithdrawing ? 'opacity-50' : 'hover:opacity-90'
                    }`}
                  >
                    {isWithdrawing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                      </span>
                    ) : 'Confirm'}
                  </button>
                </div>
              </div>
            )}

            {/* Form state */}
            {withdrawStep === 'form' && (
              <>
                {/* Balance reminder */}
                <div className={`p-3 rounded-xl flex justify-between items-center ${
                  dark ? 'bg-black-200' : 'bg-gray-1001'
                }`}>
                  <span className={`text-sm ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>
                    Available
                  </span>
                  <span className="text-sm font-bold text-primary">
                    ₦{wallet.balance?.toLocaleString() || 0}
                  </span>
                </div>

                {/* Amount input */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    dark ? 'text-gray-1002' : 'text-black-200'
                  }`}>
                    Amount (₦)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max={wallet.balance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    className={`w-full p-4 rounded-xl border outline-none text-lg font-medium ${
                      dark
                        ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                        : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                    }`}
                  />
                </div>

                {/* Bank selector */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    dark ? 'text-gray-1002' : 'text-black-200'
                  }`}>
                    Select Bank
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowBankList(!showBankList)}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between ${
                        dark
                          ? 'bg-black-200 border-black-200 text-white'
                          : 'bg-gray-1001 border-gray-1001 text-black-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-4 h-4 ${dark ? 'text-gray-1002' : 'text-gray-600'}`} />
                        <span className={selectedBank ? '' : dark ? 'text-gray-1002' : 'text-gray-600'}>
                          {selectedBank ? selectedBank.name : 'Choose your bank'}
                        </span>
                      </div>
                      <ChevronLeft className={`w-4 h-4 transition-transform ${
                        showBankList ? '-rotate-90' : 'rotate-180'
                      } ${dark ? 'text-gray-1002' : 'text-gray-600'}`} />
                    </button>

                    {showBankList && (
                      <div className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border max-h-64 overflow-hidden ${
                        dark ? 'bg-black-100 border-black-200' : 'bg-white border-gray-1001'
                      } shadow-xl`}>
                        <div className={`p-2 border-b ${dark ? 'border-black-200' : 'border-gray-1001'}`}>
                          <input
                            type="text"
                            placeholder="Search bank..."
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                            className={`w-full p-2 rounded-lg outline-none text-sm ${
                              dark
                                ? 'bg-black-200 text-white placeholder-gray-1002'
                                : 'bg-gray-1001 text-black-200 placeholder-gray-600'
                            }`}
                          />
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {filteredBanks.length === 0 ? (
                            <p className={`text-sm text-center py-4 ${
                              dark ? 'text-gray-1002' : 'text-gray-600'
                            }`}>
                              No banks found
                            </p>
                          ) : (
                            filteredBanks.map((bank) => (
                              <button
                                key={bank.code}
                                onClick={() => {
                                  setSelectedBank(bank);
                                  setShowBankList(false);
                                  setBankSearch('');
                                  setVerifiedAccount(null);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                  dark
                                    ? 'text-white hover:bg-black-200'
                                    : 'text-black-200 hover:bg-gray-1001'
                                }`}
                              >
                                {bank.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account number */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    dark ? 'text-gray-1002' : 'text-black-200'
                  }`}>
                    Account Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      maxLength={10}
                      value={accountNumber}
                      onChange={(e) => {
                        setAccountNumber(e.target.value);
                        setVerifiedAccount(null);
                      }}
                      placeholder="10-digit account number"
                      className={`flex-1 p-4 rounded-xl border outline-none ${
                        dark
                          ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                          : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                      }`}
                    />
                    <button
                      onClick={handleVerifyAccount}
                      disabled={isVerifying || !selectedBank || accountNumber.length !== 10}
                      className={`px-4 rounded-xl font-medium text-sm bg-primary text-white ${
                        isVerifying || !selectedBank || accountNumber.length !== 10
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:opacity-90'
                      }`}
                    >
                      {isVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : 'Verify'}
                    </button>
                  </div>
                </div>

                {/* Verified account name */}
                {verifiedAccount && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-sm font-medium text-green-500">
                      {verifiedAccount.account_name}
                    </p>
                  </div>
                )}

                {/* Withdraw button */}
                <button
                  onClick={handleWithdraw}
                  disabled={
                    !withdrawAmount ||
                    parseFloat(withdrawAmount) < 100 ||
                    parseFloat(withdrawAmount) > wallet.balance ||
                    !verifiedAccount
                  }
                  className={`w-full py-4 rounded-xl font-semibold text-white bg-primary transition-all ${
                    !withdrawAmount ||
                    parseFloat(withdrawAmount) < 100 ||
                    parseFloat(withdrawAmount) > wallet.balance ||
                    !verifiedAccount
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-90'
                  }`}
                >
                  Withdraw ₦{parseFloat(withdrawAmount || 0).toLocaleString()}
                </button>
              </>
            )}
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div className="space-y-2">
            {loading && wallet.transactions?.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : wallet.transactions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <WalletIcon className={`w-12 h-12 mb-3 ${dark ? 'text-gray-1002' : 'text-gray-400'}`} />
                <p className={`text-sm ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>
                  No transactions yet
                </p>
              </div>
            ) : (
              <>
                {wallet.transactions.map((txn, i) => (
                  <div key={i} className={`flex items-center gap-3 p-4 rounded-xl ${
                    dark ? 'bg-black-200' : 'bg-gray-1001'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      txn.type === 'credit' ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      {txn.type === 'credit'
                        ? <ArrowDownLeft className="w-4 h-4 text-green-500" />
                        : <ArrowUpRight className="w-4 h-4 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        dark ? 'text-white' : 'text-black-200'
                      }`}>
                        {getTransactionLabel(txn)}
                      </p>
                      <p className={`text-xs ${dark ? 'text-gray-1002' : 'text-gray-600'}`}>
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
                      <p className={`text-sm font-bold ${
                        txn.type === 'credit' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {txn.type === 'credit' ? '+' : '-'}₦{txn.amount?.toLocaleString()}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.status === 'completed'
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
                    className={`w-full py-3 rounded-xl text-sm font-medium ${
                      dark ? 'bg-black-200 text-gray-1002' : 'bg-gray-1001 text-black-200'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                      </span>
                    ) : 'Load More'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};