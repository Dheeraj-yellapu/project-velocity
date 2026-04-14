import rateLimit from "express-rate-limit";
import { securityConfig } from "./securityConfig.js";

// Rate Limit logic for express search queries
export const searchRateLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // Limit each IP to 20 requests per `window`
  message: { error: "Too many requests from this IP, please try again after 10 seconds." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req, _res) => {
    // If security is disabled globally via Admin Panel, skip rate limiting completely
    return !securityConfig.enabled;
  },
  keyGenerator: (req) => {
    // Get IP considering Nginx reverse proxy x-forwarded-for header
    return req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  }
});