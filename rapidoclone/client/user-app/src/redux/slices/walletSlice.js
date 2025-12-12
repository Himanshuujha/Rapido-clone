// src/redux/slices/walletSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  balance: 0,
  currency: 'INR',
  transactions: [],       // [{ _id, type, amount, category, createdAt, ... }]
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
    },

    setWalletData: (state, action) => {
      const { balance, currency, transactions } = action.payload || {};
      if (typeof balance === 'number') state.balance = balance;
      if (currency) state.currency = currency;
      if (Array.isArray(transactions)) state.transactions = transactions;
      state.error = null;
    },

    setWalletBalance: (state, action) => {
      const { balance, currency } = action.payload || {};
      if (typeof balance === 'number') state.balance = balance;
      if (currency) state.currency = currency;
    },

    setWalletTransactions: (state, action) => {
      state.transactions = Array.isArray(action.payload)
        ? action.payload
        : [];
    },

    addWalletTransaction: (state, action) => {
      if (action.payload) {
        state.transactions = [action.payload, ...state.transactions];
      }
    },

    resetWallet: () => initialState,
  },
});

export const {
  setWalletLoading,
  setWalletError,
  setWalletData,
  setWalletBalance,
  setWalletTransactions,
  addWalletTransaction,
  resetWallet,
} = walletSlice.actions;

export default walletSlice.reducer;