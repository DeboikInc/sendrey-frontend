// store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../Redux/authSlice';
import userReducer from '../Redux/userSlice';
import orderReducer from "../Redux/orderSlice"
import runnerReducer from '../Redux/runnerSlice';
import kycReducer from '../Redux/kycSlice';
import paymentReducer from "../Redux/paymentSlice";
import disputeReducer from '../Redux/disputeSlice';
import ratingReducer from "../Redux/ratingSlice";
import businessReducer from "../Redux/businessSlice";
import { injectStore } from '../utils/api';
import payoutReducer from "../Redux/payoutSlice";
import pinReducer from '../Redux/pinSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

const authPersistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'],
};

const pinPersistConfig = {
  key: 'pin',
  storage,
  whitelist: ['isPinSet'],    
};

const store = configureStore({
  reducer: {
    auth: persistReducer(authPersistConfig, authReducer),
    users: userReducer,
    runners: runnerReducer,
    kyc: kycReducer,
    order: orderReducer,
    payment: paymentReducer,
    dispute: disputeReducer,
    rating: ratingReducer,
    payout: payoutReducer,
    business: businessReducer,
    pin: persistReducer(pinPersistConfig, pinReducer),
  },
});

// Inject the store ONCE to the shared API
injectStore(store);
export const persistor = persistStore(store);
export default store;