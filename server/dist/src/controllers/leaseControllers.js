"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeasePayments = exports.getLeases = void 0;
const client_1 = require("@prisma/client");
// Create a new instance of the Prisma client
const prisma = new client_1.PrismaClient();
// This function gets all leases from the database
const getLeases = async (req, res) => {
    try {
        // Fetch all leases from the database
        // Include information about the tenant and the property for each lease
        const leases = await prisma.lease.findMany({
            include: {
                tenant: true,
                property: true
            }
        });
        // Send the leases back to the client as JSON
        res.json(leases);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving leases: ${error.message}` });
    }
};
exports.getLeases = getLeases;
// This function gets all payments for a specific lease from the database
const getLeasePayments = async (req, // req = the request from the client
res // res = what we will send back to the client
) => {
    try {
        // Get the lease ID from the URL
        const { id } = req.params;
        // Find all payments in the database where the leaseId matches the given ID
        const payments = await prisma.payment.findMany({
            where: { leaseId: Number(id) } // Convert id from string to number
        });
        // Send the payments back to the client as JSON
        res.json(payments);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving lease payments: ${error.message}` });
    }
};
exports.getLeasePayments = getLeasePayments;
//# sourceMappingURL=leaseControllers.js.map