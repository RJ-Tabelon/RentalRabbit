import { Request, Response } from 'express';
export declare const getTenant: (req: Request, res: Response) => Promise<void>;
export declare const createTenant: (req: Request, res: Response) => Promise<void>;
export declare const updateTenant: (req: Request, res: Response) => Promise<void>;
export declare const getCurrentResidences: (req: Request, // req = the request that comes from the client
res: Response) => Promise<void>;
export declare const addFavoriteProperty: (req: Request, // req = request from the client
res: Response) => Promise<void>;
export declare const removeFavoriteProperty: (req: Request, // req = the request from the client
res: Response) => Promise<void>;
//# sourceMappingURL=tenantControllers.d.ts.map