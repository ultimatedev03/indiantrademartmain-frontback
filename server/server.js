import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import otpRoutes from './routes/otp.js';
import quotationRoutes from './routes/quotation.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/otp', otpRoutes);
app.use('/api/quotation', quotationRoutes);

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
