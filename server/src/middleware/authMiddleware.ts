import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

// This describes what we expect inside a decoded JWT.
// "sub" = user ID, "custom:role" = user role (like "admin" or "user").
interface DecodedToken extends JwtPayload {
  sub: string;
  "custom:role"?: string;
}

// Extend Express's Request type so we can safely add req.user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      }
    }
  }
}

// Middleware factory: takes a list of allowed roles
export const authMiddleware = (allowedRoles: string[]) => {
  // This is the actual middleware function that Express will run
  return (req: Request, res:Response, next:NextFunction): void => {
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
      const decoded = jwt.decode(token) as DecodedToken;

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
    } catch (err) {
      // If something goes wrong while decoding token
      console.error('Failed to decode token:', err);
      res.status(400).json({ message: 'Invalid token' });
      return;
    }

    // Everything looks good → move to the next middleware/route
    next();
  };
};