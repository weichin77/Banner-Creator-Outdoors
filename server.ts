import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { handleGetUser, handleDeductCredit, handleRefundCredit, handleCreatePayPalOrder, handleCapturePayPalOrder } from "./server-proxy.ts";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Parse JSON bodies (as sent by API clients)
  app.use(express.json());

  // API routes
  app.get("/api/user", handleGetUser);
  app.post("/api/deduct-credit", handleDeductCredit);
  app.post("/api/refund-credit", handleRefundCredit);
  app.post("/api/paypal/create-order", handleCreatePayPalOrder);
  app.post("/api/paypal/capture-order", handleCapturePayPalOrder);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
