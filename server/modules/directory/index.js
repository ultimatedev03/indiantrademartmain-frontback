import dirRouter from '../../routes/dir.js';
import kycRouter from '../../routes/kyc.js';
import migrationRouter from '../../routes/migration.js';
import vendorRouter from '../../routes/vendorProfile.js';

export const directoryRoutes = Object.freeze([
  { path: '/api/dir', router: dirRouter },
  { path: '/api/vendors', router: vendorRouter },
  { path: '/api/kyc', router: kycRouter },
  { path: '/api/migration', router: migrationRouter },
]);
