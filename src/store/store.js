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
import { injectStore } from '../utils/api'; 
import { rating } from '@material-tailwind/react';

const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    runners: runnerReducer,
    kyc: kycReducer,
    order: orderReducer,
    payment: paymentReducer,
    dispute: disputeReducer,
    rating: ratingReducer,
  },
});

// Inject the store ONCE to the shared API
injectStore(store);

export default store;