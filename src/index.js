import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./global.css";
import App from "./App";
import { Provider } from "react-redux";
import store from "./store/store";

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
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
);
