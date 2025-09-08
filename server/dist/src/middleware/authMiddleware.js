"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Middleware factory: takes a list of allowed roles
const authMiddleware = (allowedRoles) => {
    // This is the actual middleware function that Express will run
    return (req, res, next) => {
        // Get the JWT token from the "Authorization" header
        // Format is: "Bearer my.jwt.token"
        const token = req.headers.authorization?.split(' ')[1];
        // If there is no token, block the request
        if (!token) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        try {
            // Decode the token (does not verify signature, just reads data)
            const decoded = jsonwebtoken_1.default.decode(token);
            // Get role and user ID from token
            const userRole = decoded['custom:role'] || '';
            req.user = {
                id: decoded.sub,
                role: userRole
            };
            // Check if user's role is allowed to access this route
            const hasAccess = allowedRoles.includes(userRole.toLowerCase());
            if (!hasAccess) {
                res.status(403).json({ message: 'Access Denied' });
                return;
            }
        }
        catch (err) {
            // If something goes wrong while decoding token
            console.error('Failed to decode token:', err);
            res.status(400).json({ message: 'Invalid token' });
            return;
        }
        // Everything looks good → move to the next middleware/route
        next();
    };
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=authMiddleware.js.map