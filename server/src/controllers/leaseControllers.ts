import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// Create a new instance of the Prisma client
const prisma = new PrismaClient();

// This function gets all leases from the database
export const getLeases = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving leases: ${error.message}` });
  }
};

// This function gets all payments for a specific lease from the database
export const getLeasePayments = async (
  req: Request, // req = the request from the client
  res: Response // res = what we will send back to the client
): Promise<void> => {
  try {
    // Get the lease ID from the URL
    const { id } = req.params;

    // Find all payments in the database where the leaseId matches the given ID
    const payments = await prisma.payment.findMany({
      where: { leaseId: Number(id) } // Convert id from string to number
    });

    // Send the payments back to the client as JSON
    res.json(payments);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving lease payments: ${error.message}` });
  }
};
