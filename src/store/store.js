import { configureStore } from '@reduxjs/toolkit';
import authReducer, { injectStore as injectAuthStore} from '../Redux/authSlice';
import userReducer, {injectStore as injectUserStore} from '../Redux/userSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    // ... other reducers
  },
});

// Inject the store so the axios interceptor can access it
injectAuthStore(store);
injectUserStore(store);

export default store;