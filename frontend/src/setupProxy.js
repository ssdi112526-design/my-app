const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const backendTarget =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

const proxyUnavailable = (res) => {
  if (res.headersSent) return;
  res.status(503).json({
    success: false,
    message:
      "Backend API is not running. Start it with: cd backend && npm run dev. " +
      "If the server crashes on startup, whitelist your IP in MongoDB Atlas → Network Access.",
  });
};

module.exports = function setupProxy(app) {
  const proxyOpts = {
    target: backendTarget,
    changeOrigin: true,
    // Find Vehicles can warm S3 Excel indexes on first search (~15–60s).
    proxyTimeout: 180000,
    timeout: 180000,
    on: {
      error: (_err, _req, res) => proxyUnavailable(res),
    },
  };

  app.use("/api", createProxyMiddleware(proxyOpts));

  app.use(
    "/socket.io",
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      ws: true,
    })
  );

  app.use(
    "/uploads",
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
    })
  );

  app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.type("application/json");
    res.sendFile(
      path.join(__dirname, "../public/.well-known/appspecific/com.chrome.devtools.json")
    );
  });
};
