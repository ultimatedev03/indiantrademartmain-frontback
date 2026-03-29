import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const parseJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const unwrap = async (res, fallbackMessage) => {
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackMessage);
  }
  return data;
};

export const salesApi = {
  getStats: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/stats'));
    const data = await unwrap(res, 'Failed to load sales stats');
    return data?.stats || null;
  },

  getAllLeads: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/leads'));
    const data = await unwrap(res, 'Failed to load leads');
    return data?.leads || [];
  },

  updateLeadStatus: async (id, status) => {
    const leadId = String(id || '').trim();
    const nextStatus = String(status || '').trim().toUpperCase();
    if (!leadId || !nextStatus) {
      throw new Error('leadId and status are required');
    }

    const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/leads/${leadId}/status`), {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await unwrap(res, 'Failed to update lead status');
    return data?.lead || null;
  },

  updateLead: async (id, updates = {}) => {
    const leadId = String(id || '').trim();
    if (!leadId) {
      throw new Error('leadId is required');
    }

    const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/leads/${leadId}`), {
      method: 'PATCH',
      body: JSON.stringify(updates || {}),
    });
    const data = await unwrap(res, 'Failed to update lead');
    return data?.lead || null;
  },

  getPricingRules: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/pricing-rules'));
    const data = await unwrap(res, 'Failed to load pricing rules');
    return data?.rules || [];
  },

  createPricingRule: async (payload = {}) => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/pricing-rules'), {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    const data = await unwrap(res, 'Failed to create pricing rule');
    return data?.rule || null;
  },

  getManagerPricingApprovals: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/manager/pricing-approvals'));
    const data = await unwrap(res, 'Failed to load pricing approvals');
    return data?.rules || [];
  },

  decidePricingRule: async (ruleId, decision, remarks = '') => {
    const normalizedRuleId = String(ruleId || '').trim();
    if (!normalizedRuleId) {
      throw new Error('ruleId is required');
    }

    const res = await fetchWithCsrf(apiUrl(`/api/employee/manager/pricing-approvals/${normalizedRuleId}/decision`), {
      method: 'POST',
      body: JSON.stringify({
        decision,
        remarks,
      }),
    });
    const data = await unwrap(res, 'Failed to update pricing rule approval');
    return data?.rule || null;
  },
};
