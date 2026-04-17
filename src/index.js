import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./global.css";
import App from "./App";
import { Provider } from "react-redux";
import { ThemeProvider } from "@material-tailwind/react";
import { PersistGate } from 'redux-persist/integration/react';
import store, { persistor } from './store/store';

if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    height: 35vh; background: rgba(0,0,0,0.88); color: #0f0;
    font-size: 10px; font-family: monospace; overflow-y: auto;
    z-index: 999999; padding: 8px; box-sizing: border-box;
    pointer-events: auto;
    -webkit-overflow-scrolling: touch;
  `;
  document.body.appendChild(overlay);

  const write = (color, args) => {
    const line = document.createElement('div');
    line.style.color = color;
    line.style.borderBottom = '1px solid #222';
    line.style.padding = '2px 0';
    line.textContent = `[${new Date().toLocaleTimeString()}] ${args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
      catch { return String(a); }
    }).join(' ')}`;
    overlay.appendChild(line);
    overlay.scrollTop = overlay.scrollHeight;
  };

  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);

  // Override BEFORE production suppression runs
  console.log = (...args) => { _log(...args); write('#0f0', args); };
  console.warn = (...args) => { _warn(...args); write('#ff0', args); };
  console.error = (...args) => { _error(...args); write('#f55', args); };
}


// if (process.env.NODE_ENV === 'production') {
//   console.log = () => { };
//   console.error = () => { };
//   console.warn = () => { };
//   console.debug = () => { };
// }

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