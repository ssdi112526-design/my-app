import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { AuthProvider } from "./context/AuthContext";
import { ControlPanelProvider } from "./context/ControlPanelContext";
import "./styles/index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ControlPanelProvider>
          <App />
        </ControlPanelProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);