import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const safeReadJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  throw new Error(text || `Request failed with status ${response.status}`);
};

export const hrApi = {
  getEmployees: async () => {
    const response = await fetchWithCsrf(apiUrl('/api/employee/staff'));
    const payload = await safeReadJson(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to fetch employees');
    }
    return Array.isArray(payload?.employees) ? payload.employees : [];
  },

  createEmployee: async (employeeData) => {
    const response = await fetchWithCsrf(apiUrl('/api/employee/staff'), {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
    const payload = await safeReadJson(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to create employee');
    }
    return payload;
  },

  updateEmployee: async (employeeId, employeeData) => {
    const response = await fetchWithCsrf(apiUrl(`/api/employee/staff/${employeeId}`), {
      method: 'PATCH',
      body: JSON.stringify(employeeData),
    });
    const payload = await safeReadJson(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Failed to update employee');
    }
    return payload?.employee || payload;
  },

  updateEmployeeStatus: async (employeeId, status) => {
    return hrApi.updateEmployee(employeeId, { status });
  },

  getStats: async () => {
    const employees = await hrApi.getEmployees();
    const totalEmployees = employees.length;
    const active = employees.filter((employee) => String(employee?.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;

    return {
      totalEmployees,
      active,
      onLeave: 0,
    };
  },
};
