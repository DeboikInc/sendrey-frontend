import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from '../Redux/authSlice';
import userReducer from '../Redux/userSlice';
import orderReducer from "../Redux/orderSlice";
import runnerReducer from '../Redux/runnerSlice';
import kycReducer from '../Redux/kycSlice';
import paymentReducer from "../Redux/paymentSlice";
import disputeReducer from '../Redux/disputeSlice';
import ratingReducer from "../Redux/ratingSlice";
import businessReducer from "../Redux/businessSlice";
import { injectStore } from '../utils/api';
import payoutReducer from "../Redux/payoutSlice";
import pinReducer from '../Redux/pinSlice';

const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['token', 'runner', 'user', 'refreshToken'],
};

const pinPersistConfig = {
  key: 'pin',
  storage,
  whitelist: ['isPinSet'],
};

const store = configureStore({
  reducer: {
    auth: persistReducer(authPersistConfig, authReducer),
    pin: persistReducer(pinPersistConfig, pinReducer),
    users: userReducer,
    runners: runnerReducer,
    kyc: kycReducer,
    order: orderReducer,
    payment: paymentReducer,
    dispute: disputeReducer,
    rating: ratingReducer,
    payout: payoutReducer,
    business: businessReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

const persistor = persistStore(store);
injectStore(store);

export { store, persistor };
export default store;