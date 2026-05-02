import { theme } from "antd";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import enUS from "antd/locale/en_US";

import App from "./App.jsx";
import "./styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={enUS}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: "#0f766e",
            borderRadiusLG: 12,
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            colorBgLayout: "#f0f4f8",
          },
          components: {
            Layout: {
              siderBg: "#0c1e2e",
              triggerBg: "#0c1e2e",
            },
            Menu: {
              darkItemBg: "transparent",
              darkItemSelectedBg: "rgba(15, 118, 110, 0.35)",
              darkItemHoverBg: "rgba(255,255,255,0.06)",
            },
          },
        }}
      >
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
