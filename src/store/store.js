// store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../Redux/authSlice';
import userReducer from '../Redux/userSlice';
import orderReducer from "../Redux/orderSlice"
import runnerSlice from '../Redux/runnerSlice';
import kycSlice from '../Redux/kycSlice';
import { injectStore } from '../utils/api'; 

const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    runners: runnerSlice,
    kyc: kycSlice,
    order: orderReducer,
  },
});

// Inject the store ONCE to the shared API
injectStore(store);

export default store;