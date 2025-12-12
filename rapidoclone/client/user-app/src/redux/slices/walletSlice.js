// src/redux/slices/walletSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  balance: 0,
  currency: 'INR',
  transactions: [],
  stats: null,
  rewards: [],
  referral: null,
  loading: false,
  error: null,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setWalletLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },

    setWalletError: (state, action) => {
      state.error = action.payload || null;
      state.loading = false;
    },

    setWalletData: (state, action) => {
      const { balance, currency, transactions, stats, rewards, referral } = 
        action.payload || {};
      
      if (typeof balance === 'number') state.balance = balance;
      if (currency) state.currency = currency;
      if (Array.isArray(transactions)) state.transactions = transactions;
      if (stats) state.stats = stats;
      if (Array.isArray(rewards)) state.rewards = rewards;
      if (referral) state.referral = referral;
      
      state.error = null;
      state.loading = false;
    },

    setWalletBalance: (state, action) => {
      const { balance, currency } = action.payload || {};
      if (typeof balance === 'number') state.balance = balance;
      if (currency) state.currency = currency;
    },

    updateBalance: (state, action) => {
      const { amount, type } = action.payload || {};
      if (typeof amount === 'number') {
        if (type === 'credit') {
          state.balance += amount;
        } else if (type === 'debit') {
          state.balance -= amount;
        }
      }
    },

    setWalletTransactions: (state, action) => {
      state.transactions = Array.isArray(action.payload) ? action.payload : [];
    },

    addWalletTransaction: (state, action) => {
      if (action.payload) {
        state.transactions = [action.payload, ...state.transactions];
      }
    },

    setWalletStats: (state, action) => {
      state.stats = action.payload || null;
    },

    setRewards: (state, action) => {
      state.rewards = Array.isArray(action.payload) ? action.payload : [];
    },

    removeReward: (state, action) => {
      state.rewards = state.rewards.filter(
        (reward) => reward._id !== action.payload
      );
    },

    setReferral: (state, action) => {
      state.referral = action.payload || null;
    },

    resetWallet: () => initialState,
  },
});

export const {
  setWalletLoading,
  setWalletError,
  setWalletData,
  setWalletBalance,
  updateBalance,
  setWalletTransactions,
  addWalletTransaction,
  setWalletStats,
  setRewards,
  removeReward,
  setReferral,
  resetWallet,
} = walletSlice.actions;

// Selectors
export const selectWalletBalance = (state) => state.wallet.balance;
export const selectWalletCurrency = (state) => state.wallet.currency;
export const selectWalletTransactions = (state) => state.wallet.transactions;
export const selectWalletStats = (state) => state.wallet.stats;
export const selectRewards = (state) => state.wallet.rewards;
export const selectReferral = (state) => state.wallet.referral;
export const selectWalletLoading = (state) => state.wallet.loading;
export const selectWalletError = (state) => state.wallet.error;

export default walletSlice.reducer;