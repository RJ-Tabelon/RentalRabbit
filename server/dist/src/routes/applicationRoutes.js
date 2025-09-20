"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const applicationControllers_1 = require("../controllers/applicationControllers");
// Create a new router object to define routes related to applications
const router = express_1.default.Router();
// Route to create a new application
// Only users with the "tenant" role can access this route
router.post('/', (0, authMiddleware_1.authMiddleware)(['tenant']), applicationControllers_1.createApplication);
// Route to update the status of an application (like Approve or Deny)
// Only users with the "manager" role can access this route
router.put('/:id/status', (0, authMiddleware_1.authMiddleware)(['manager']), applicationControllers_1.updateApplicationStatus);
// Route to get a list of applications
// Users with "manager" or "tenant" roles can access this route
router.get('/', (0, authMiddleware_1.authMiddleware)(['manager', 'tenant']), applicationControllers_1.listApplications);
exports.default = router;
//# sourceMappingURL=applicationRoutes.js.map