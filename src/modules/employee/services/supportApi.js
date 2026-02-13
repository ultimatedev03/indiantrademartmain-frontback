import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

export const supportApi = {
  getAllTickets: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
    if (filters.search) params.append('search', filters.search);
    params.append('pageSize', '200');

    const response = await fetchWithCsrf(apiUrl(`/api/support/tickets?${params.toString()}`));
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const { tickets } = await response.json();
    return tickets || [];
  },

  // ✅ Messages via API (RLS safe)
  getMessages: async (ticketId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`));
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch messages');
    return data.messages || [];
  },

  sendMessage: async (ticketId, message) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sender_type: 'SUPPORT' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to send message');
    return data.message;
  },

  getStats: async () => {
    const response = await fetchWithCsrf(apiUrl(`/api/support/stats`));
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const { stats } = await response.json();
    return {
      open: stats.openTickets || 0,
      inProgress: stats.inProgressTickets || 0,
      closed: stats.closedTickets || 0,
      highPriority: stats.highPriorityTickets || 0,
      resolvedToday: stats.resolvedTickets || 0,
      total: stats.totalTickets || 0
    };
  }
};
