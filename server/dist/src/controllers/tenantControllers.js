"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenant = exports.getTenant = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getTenant = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        const tenant = await prisma.tenant.findUnique({
            where: { cognitoId: cognitoId },
            include: {
                favorites: true
            }
        });
        if (tenant) {
            res.json(tenant);
        }
        else {
            res.status(404).json({ message: 'Tenant not found' });
        }
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving tenant: ${error.message}` });
    }
};
exports.getTenant = getTenant;
const createTenant = async (req, res) => {
    try {
        const { cognitoId, name, email, phoneNumber } = req.body;
        const tenant = await prisma.tenant.create({
            data: {
                cognitoId,
                name,
                email,
                phoneNumber
            }
        });
        res.status(201).json(tenant);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error creating tenant: ${error.message}` });
    }
};
exports.createTenant = createTenant;
//# sourceMappingURL=tenantControllers.js.map