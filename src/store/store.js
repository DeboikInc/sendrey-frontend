import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { injectStore } from '../utils/api';

import authReducer from '../Redux/authSlice';
import userReducer from '../Redux/userSlice';
import orderReducer from '../Redux/orderSlice';
import runnerReducer from '../Redux/runnerSlice';
import kycReducer from '../Redux/kycSlice';
import paymentReducer from '../Redux/paymentSlice';
import disputeReducer from '../Redux/disputeSlice';
import ratingReducer from '../Redux/ratingSlice';
import businessReducer from '../Redux/businessSlice';
import payoutReducer from '../Redux/payoutSlice';
import pinReducer from '../Redux/pinSlice';


const store = configureStore({
  reducer: {
    auth: persistReducer(
      { key: 'auth', storage, whitelist: ['runner', 'user'] },
      authReducer
    ),
    users: userReducer,
    runners: runnerReducer,
    kyc: kycReducer,
    order: orderReducer,
    payment: paymentReducer,
    dispute: disputeReducer,
    rating: ratingReducer,
    payout: payoutReducer,
    business: businessReducer,
    pin: persistReducer({ key: 'pin', storage, whitelist: ['isPinSet'] }, pinReducer),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

injectStore(store);
export const persistor = persistStore(store);
export default store;