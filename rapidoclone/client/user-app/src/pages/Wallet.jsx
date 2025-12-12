import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import api from '../services/api';

const Wallet = () => {
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('INR');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'credit' | 'debit'

  const quickAmounts = [100, 200, 500, 1000];

  const fetchWallet = async () => {
    try {
      setLoading(true);
      setError('');

      const [walletRes, txRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions'),
      ]);

      const walletData = walletRes.data?.data || walletRes.data;
      const txData = txRes.data?.data || txRes.data;

      setBalance(walletData.balance || 0);
      setCurrency(walletData.currency || 'INR');
      setTransactions(Array.isArray(txData) ? txData : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < 10) {
      alert('Minimum topup amount is ₹10');
      return;
    }

    try {
      setTopupLoading(true);
      await api.post('/wallet/topup', { amount });
      setTopupAmount('');
      setShowTopupModal(false);
      fetchWallet();
    } catch (err) {
      console.error(err);
      alert('Failed to add money');
    } finally {
      setTopupLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      ride_payment: '🚗',
      ride_earnings: '💰',
      wallet_topup: '➕',
      refund: '↩️',
      withdrawal: '🏧',
      bonus: '🎁',
      referral: '👥',
      cancellation_fee: '❌',
    };
    return icons[category] || '💳';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      ride_payment: 'Ride Payment',
      ride_earnings: 'Ride Earnings',
      wallet_topup: 'Wallet Topup',
      refund: 'Refund',
      withdrawal: 'Withdrawal',
      bonus: 'Bonus',
      referral: 'Referral Bonus',
      cancellation_fee: 'Cancellation Fee',
    };
    return labels[category] || category;
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === 'all') return true;
    return tx.type === activeTab;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Wallet</h1>
          </div>

          {/* Balance Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <p className="text-green-100 text-sm">Available Balance</p>
            {loading ? (
              <div className="py-4">
                <Loader size="md" className="text-white" />
              </div>
            ) : (
              <p className="text-4xl font-bold mt-1">
                {formatCurrency(balance)}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowTopupModal(true)}
                className="flex-1 bg-white text-green-700 hover:bg-green-50"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Money
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-white/30 text-white hover:bg-white/10"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Transfer
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <section className="grid grid-cols-4 gap-3">
          {[
            { icon: '📱', label: 'Pay Bills' },
            { icon: '🎁', label: 'Rewards' },
            { icon: '👥', label: 'Refer' },
            { icon: '📊', label: 'Stats' },
          ].map((action, index) => (
            <button
              key={index}
              className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-2xl mb-1">{action.icon}</span>
              <span className="text-xs text-gray-600">{action.label}</span>
            </button>
          ))}
        </section>

        {/* Transactions */}
        <section className="bg-white rounded-xl shadow-sm">
          <div className="px-4 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Transactions</h2>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {['all', 'credit', 'debit'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Transaction List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="h-16 w-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-gray-600">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Your transactions will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx._id}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                    {getCategoryIcon(tx.category)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {getCategoryLabel(tx.category)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Bal: {formatCurrency(tx.balanceAfter || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Topup Modal */}
      <Modal
        isOpen={showTopupModal}
        onClose={() => setShowTopupModal(false)}
        title="Add Money to Wallet"
        maxWidth="max-w-md"
      >
        <div className="space-y-6">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">
                ₹
              </span>
              <input
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-4 text-2xl font-semibold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Quick Amounts */}
          <div className="flex gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setTopupAmount(amount.toString())}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  topupAmount === amount.toString()
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                ₹{amount}
              </button>
            ))}
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-green-500 bg-green-50">
                <span className="text-2xl">📱</span>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">UPI</p>
                  <p className="text-xs text-gray-500">Pay via any UPI app</p>
                </div>
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Add Button */}
          <Button
            fullWidth
            onClick={handleTopup}
            disabled={topupLoading || !topupAmount || Number(topupAmount) < 10}
            className="py-4 text-base bg-green-600 hover:bg-green-700"
          >
            {topupLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                Processing...
              </span>
            ) : (
              `Add ${topupAmount ? formatCurrency(Number(topupAmount)) : 'Money'}`
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Wallet;