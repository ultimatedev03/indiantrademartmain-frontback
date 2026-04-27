import adminRouter from '../../routes/admin.js';
import categoryRequestRouter from '../../routes/categoryRequests.js';
import dataEntryRouter from '../../routes/dataEntry.js';
import employeeRouter from '../../routes/employee.js';
import superadminRouter from '../../routes/superadmin.js';
import territoryRouter from '../../routes/territory.js';

export const operationsRoutes = Object.freeze([
  { path: '/api/admin', router: adminRouter },
  { path: '/api/superadmin', router: superadminRouter },
  { path: '/api/employee', router: employeeRouter },
  { path: '/api/territory', router: territoryRouter },
  { path: '/api/category-requests', router: categoryRequestRouter },
  { path: '/api/data-entry', router: dataEntryRouter },
]);
