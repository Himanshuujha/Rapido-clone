// src/redux/api/walletApi.js
import { apiSlice } from './apiSlice';

export const walletApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ===== Balance =====
    getWalletBalance: builder.query({
      query: () => '/wallet/balance',
      providesTags: ['Wallet'],
    }),

    // ===== Transactions =====
    getWalletTransactions: builder.query({
      query: (params) => ({
        url: '/wallet/transactions',
        params: {
          page: params?.page || 1,
          limit: params?.limit || 20,
          type: params?.type, // 'credit' | 'debit' | undefined for all
          startDate: params?.startDate,
          endDate: params?.endDate,
          category: params?.category,
        },
      }),
      providesTags: ['WalletTransactions'],
    }),

    // ===== Get Single Transaction =====
    getTransaction: builder.query({
      query: (transactionId) => `/wallet/transactions/${transactionId}`,
      providesTags: (result, error, id) => [{ type: 'WalletTransactions', id }],
    }),

    // ===== Topup / Add Money =====
    topupWallet: builder.mutation({
      query: (body) => ({
        url: '/wallet/topup',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions'],
    }),

    // ===== Verify Topup (after payment gateway callback) =====
    verifyTopup: builder.mutation({
      query: (body) => ({
        url: '/wallet/topup/verify',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions'],
    }),

    // ===== Transfer to Another User =====
    transferMoney: builder.mutation({
      query: (body) => ({
        url: '/wallet/transfer',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions'],
    }),

    // ===== Withdraw Money =====
    withdrawMoney: builder.mutation({
      query: (body) => ({
        url: '/wallet/withdraw',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions'],
    }),

    // ===== Get Withdrawal Requests =====
    getWithdrawalRequests: builder.query({
      query: () => '/wallet/withdrawals',
      providesTags: ['Withdrawals'],
    }),

    // ===== Cancel Withdrawal =====
    cancelWithdrawal: builder.mutation({
      query: (withdrawalId) => ({
        url: `/wallet/withdrawals/${withdrawalId}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions', 'Withdrawals'],
    }),

    // ===== Get Saved Payment Methods =====
    getPaymentMethods: builder.query({
      query: () => '/wallet/payment-methods',
      providesTags: ['PaymentMethods'],
    }),

    // ===== Add Payment Method =====
    addPaymentMethod: builder.mutation({
      query: (body) => ({
        url: '/wallet/payment-methods',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PaymentMethods'],
    }),

    // ===== Delete Payment Method =====
    deletePaymentMethod: builder.mutation({
      query: (methodId) => ({
        url: `/wallet/payment-methods/${methodId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PaymentMethods'],
    }),

    // ===== Set Default Payment Method =====
    setDefaultPaymentMethod: builder.mutation({
      query: (methodId) => ({
        url: `/wallet/payment-methods/${methodId}/default`,
        method: 'PUT',
      }),
      invalidatesTags: ['PaymentMethods'],
    }),

    // ===== Get Wallet Stats =====
    getWalletStats: builder.query({
      query: (params) => ({
        url: '/wallet/stats',
        params: {
          period: params?.period || 'month', // 'week' | 'month' | 'year'
        },
      }),
      providesTags: ['WalletStats'],
    }),

    // ===== Get Available Rewards/Cashback =====
    getRewards: builder.query({
      query: () => '/wallet/rewards',
      providesTags: ['Rewards'],
    }),

    // ===== Redeem Reward =====
    redeemReward: builder.mutation({
      query: (rewardId) => ({
        url: `/wallet/rewards/${rewardId}/redeem`,
        method: 'POST',
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions', 'Rewards'],
    }),

    // ===== Get Referral Info =====
    getReferralInfo: builder.query({
      query: () => '/wallet/referral',
      providesTags: ['Referral'],
    }),

    // ===== Apply Referral Code =====
    applyReferralCode: builder.mutation({
      query: (body) => ({
        url: '/wallet/referral/apply',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wallet', 'WalletTransactions', 'Referral'],
    }),

    // ===== Get Bank Accounts (for withdrawal) =====
    getBankAccounts: builder.query({
      query: () => '/wallet/bank-accounts',
      providesTags: ['BankAccounts'],
    }),

    // ===== Add Bank Account =====
    addBankAccount: builder.mutation({
      query: (body) => ({
        url: '/wallet/bank-accounts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BankAccounts'],
    }),

    // ===== Delete Bank Account =====
    deleteBankAccount: builder.mutation({
      query: (accountId) => ({
        url: `/wallet/bank-accounts/${accountId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BankAccounts'],
    }),

    // ===== Verify Bank Account =====
    verifyBankAccount: builder.mutation({
      query: ({ accountId, ...body }) => ({
        url: `/wallet/bank-accounts/${accountId}/verify`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BankAccounts'],
    }),
  }),
  overrideExisting: false,
});

export const {
  // Balance
  useGetWalletBalanceQuery,
  // Transactions
  useGetWalletTransactionsQuery,
  useGetTransactionQuery,
  // Topup
  useTopupWalletMutation,
  useVerifyTopupMutation,
  // Transfer & Withdraw
  useTransferMoneyMutation,
  useWithdrawMoneyMutation,
  useGetWithdrawalRequestsQuery,
  useCancelWithdrawalMutation,
  // Payment Methods
  useGetPaymentMethodsQuery,
  useAddPaymentMethodMutation,
  useDeletePaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  // Stats
  useGetWalletStatsQuery,
  // Rewards
  useGetRewardsQuery,
  useRedeemRewardMutation,
  // Referral
  useGetReferralInfoQuery,
  useApplyReferralCodeMutation,
  // Bank Accounts
  useGetBankAccountsQuery,
  useAddBankAccountMutation,
  useDeleteBankAccountMutation,
  useVerifyBankAccountMutation,
} = walletApi;