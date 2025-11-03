import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../Redux/authSlice";
import userReducer from "../Redux/userSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
  },

});

export default store;