import React, { useEffect, useState } from 'react';
import Loader from '../components/common/Loader';
import Button from '../components/common/Button';
import api from '../services/api';

const Wallet = () => {
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('INR');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [error, setError] = useState('');

  const fetchWallet = async () => {
    try {
      setLoading(true);
      setError('');

      // Adjust to your backend endpoints
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

  const handleTopup = async (e) => {
    e.preventDefault();
    const amount = Number(topupAmount);

    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }

    try {
      setError('');

      // Example: create order / topup endpoint
      await api.post('/wallet/topup', { amount });
      setTopupAmount('');
      fetchWallet();
    } catch (err) {
      console.error(err);
      setError('Failed to add money to wallet');
    }
  };

  return (
    <div className="page wallet-page">
      <header className="page-header">
        <h1>Wallet</h1>
        <p>Manage your wallet balance and transactions.</p>
      </header>

      <section className="page-content">
        {loading && (
          <div className="centered">
            <Loader />
          </div>
        )}

        {error && !loading && <p className="error-text">{error}</p>}

        {!loading && !error && (
          <>
            <div className="wallet-balance-card">
              <h3>Available Balance</h3>
              <p className="wallet-balance">
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency,
                }).format(balance)}
              </p>

              <form className="wallet-topup-form" onSubmit={handleTopup}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="wallet-topup-input"
                />
                <Button type="submit">Add Money</Button>
              </form>
            </div>

            <div className="wallet-transactions">
              <h3>Transactions</h3>

              {transactions.length === 0 && (
                <p>No transactions yet.</p>
              )}

              <ul className="transaction-list">
                {transactions.map((tx) => (
                  <li key={tx._id} className="transaction-item">
                    <div>
                      <p className="transaction-title">{tx.category}</p>
                      <p className="transaction-date">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className={`transaction-amount ${tx.type === 'credit' ? 'credit' : 'debit'}`}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency,
                      }).format(tx.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Wallet;