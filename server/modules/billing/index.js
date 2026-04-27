import financeRouter from '../../routes/finance.js';
import paymentRouter from '../../routes/payment.js';

export const billingRoutes = Object.freeze([
  { path: '/api/payment', router: paymentRouter },
  { path: '/api/finance', router: financeRouter },
]);
