import chatbotRouter from '../../routes/chatbot.js';
import notificationRouter from '../../routes/notifications.js';
import quotationRouter from '../../routes/quotation.js';
import supportRouter from '../../routes/supportTickets.js';

export const engagementRoutes = Object.freeze([
  { path: '/api/quotation', router: quotationRouter },
  { path: '/api/support', router: supportRouter },
  { path: '/api/chat', router: chatbotRouter },
  { path: '/api/notifications', router: notificationRouter },
]);
