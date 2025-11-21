import { configureStore } from '@reduxjs/toolkit';
import authReducer, { injectStore as injectAuthStore} from '../Redux/authSlice';
import userReducer, {injectStore as injectUserStore} from '../Redux/userSlice';
import runnerSlice, {injectStore as injectRunnerStore} from '../Redux/runnerSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    runners: runnerSlice,
    // ... other reducers
  },
});

// Inject the store so the axios interceptor can access it
injectAuthStore(store);
injectUserStore(store);
injectRunnerStore(store);

export default store;