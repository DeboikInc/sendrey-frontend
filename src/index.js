import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./global.css";
import App from "./App";
import { Provider } from "react-redux";
import  { store, persistor }  from "./store/store";
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider } from "@material-tailwind/react";


if (process.env.NODE_ENV === 'production') {
  console.log = () => { };
  console.error = () => { };
  console.warn = () => { };
  console.debug = () => { };
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>,
);
