"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const leaseControllers_1 = require("../controllers/leaseControllers");
// Create a new router object that we can attach routes to
const router = express_1.default.Router();
// Define a route for getting all leases
// Only users with the role "manager" or "tenant" can access this route
router.get('/', (0, authMiddleware_1.authMiddleware)(['manager', 'tenant']), leaseControllers_1.getLeases);
// Define a route for getting all payments for a specific lease
// Only users with the role "manager" or "tenant" can access this route
router.get('/:id/payments', (0, authMiddleware_1.authMiddleware)(['manager', 'tenant']), leaseControllers_1.getLeasePayments);
exports.default = router;
//# sourceMappingURL=leaseRoutes.js.map