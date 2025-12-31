
import { apiClient } from '@/shared/services/apiClient';

// Mock authentication for employee portal
const mockLogin = async (email, password) => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay

  const emailLower = email.toLowerCase();
  
  // Data Entry Logic
  if (emailLower.includes('data')) {
    if (password === 'data' || password === '123456') {
      return { user: { id: 'emp_001', name: 'Deepak Kumar', email: emailLower, role: 'DATA_ENTRY', avatar: 'D' } };
    }
  }
  
  // Support Logic
  if (emailLower.includes('support')) {
    if (password === 'support' || password === '123456') {
      return { user: { id: 'emp_002', name: 'Sarah Wilson', email: emailLower, role: 'SUPPORT', avatar: 'S' } };
    }
  }
  
  // Sales Logic
  if (emailLower.includes('sales')) {
    if (password === 'sales' || password === '123456') {
      return { user: { id: 'emp_003', name: 'Rahul Sharma', email: emailLower, role: 'SALES', avatar: 'R' } };
    }
  }

  throw new Error('Invalid email or password. Try password: "data", "support", or "sales"');
};

export const employeeApi = {
  auth: {
    login: async (email, password) => {
      return mockLogin(email, password);
    },
    logout: () => {
      // Cleanup if needed
    }
  },
  // Placeholders for other employee functions
  profile: {
    get: () => Promise.resolve({}),
    update: (data) => Promise.resolve(data)
  }
};
