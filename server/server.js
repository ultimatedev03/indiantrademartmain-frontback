import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import otpRoutes from './routes/otp.js';
import quotationRoutes from './routes/quotation.js';
import passwordResetRoutes from './routes/passwordReset.js';
import migrationRoutes from './routes/migration.js';
import supportTicketRoutes from './routes/supportTickets.js';
import kycRoutes from './routes/kyc.js';
import adminRoutes from './routes/admin.js';
import dirRoutes from './routes/dir.js';
import paymentRoutes from './routes/payment.js';
import financeRoutes from './routes/finance.js';
import chatbotRoutes from './routes/chatbot.js';
import superadminRoutes from './routes/superadmin.js';
import employeeRoutes from './routes/employee.js';
import categoryRequestRoutes from './routes/categoryRequests.js';
import { subdomainMiddleware, subdomainRedirectMiddleware, getSubdomainAwareCORS } from './middleware/subdomainMiddleware.js';
import { initializeSubscriptionCronJobs } from './lib/subscriptionCronJobs.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Subdomain Detection Middleware (BEFORE cors)
app.use(subdomainMiddleware);

// CORS with subdomain support
app.use(cors(getSubdomainAwareCORS()));

// Subdomain Redirect Middleware (optional - redirects wrong subdomain access)
app.use(subdomainRedirectMiddleware);

// ✅ IMPORTANT: Quotation PDF attachments are sent as base64 in JSON.
// Default express.json limit (100kb) causes "request entity too large" (413).
// Keep limit reasonably high for local/proxy usage.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '10mb' }));


// Input sanitization - prevent NoSQL injection and XSS
app.use(mongoSanitize()); // Sanitize data against NoSQL injection
app.use((req, res, next) => {
  // Sanitize string fields in request body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Remove potentially dangerous characters
        req.body[key] = req.body[key]
          .replace(/[<>"']/g, '') // Remove HTML/quotes
          .trim(); // Remove leading/trailing whitespace
      }
    });
  }
  next();
});

// Rate limiting middleware
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many OTP attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/otp', otpLimiter);

// Routes
app.use('/api/otp', otpRoutes);
app.use('/api/quotation', quotationRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/support', supportTicketRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dir', dirRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/category-requests', categoryRequestRoutes);

// Initialize subscription monitoring cron jobs
initializeSubscriptionCronJobs();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ OTP Server running on http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.GMAIL_EMAIL}`);
  console.log(`⏱️  OTP Expiry: 2 minutes`);
  console.log(`🔢 OTP Length: 6 digits`);
});
