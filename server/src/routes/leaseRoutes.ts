import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getLeasePayments, getLeases } from '../controllers/leaseControllers';

// Create a new router object that we can attach routes to
const router = express.Router();

// Define a route for getting all leases
// Only users with the role "manager" or "tenant" can access this route
router.get('/', authMiddleware(['manager', 'tenant']), getLeases);

// Define a route for getting all payments for a specific lease
// Only users with the role "manager" or "tenant" can access this route
router.get(
  '/:id/payments',
  authMiddleware(['manager', 'tenant']),
  getLeasePayments
);

export default router;
