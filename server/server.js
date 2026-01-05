import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import otpRoutes from './routes/otp.js';
import quotationRoutes from './routes/quotation.js';
import passwordResetRoutes from './routes/passwordReset.js';
import migrationRoutes from './routes/migration.js';
import supportTicketRoutes from './routes/supportTickets.js';
import kycRoutes from './routes/kyc.js';
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

app.use(express.json());

// Routes
app.use('/api/otp', otpRoutes);
app.use('/api/quotation', quotationRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/support', supportTicketRoutes);
app.use('/api/kyc', kycRoutes);

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
