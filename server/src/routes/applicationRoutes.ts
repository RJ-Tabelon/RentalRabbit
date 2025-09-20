import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  createApplication,
  listApplications,
  updateApplicationStatus
} from '../controllers/applicationControllers';

// Create a new router object to define routes related to applications
const router = express.Router();

// Route to create a new application
// Only users with the "tenant" role can access this route
router.post('/', authMiddleware(['tenant']), createApplication);

// Route to update the status of an application (like Approve or Deny)
// Only users with the "manager" role can access this route
router.put('/:id/status', authMiddleware(['manager']), updateApplicationStatus);

// Route to get a list of applications
// Users with "manager" or "tenant" roles can access this route
router.get('/', authMiddleware(['manager', 'tenant']), listApplications);

export default router;
