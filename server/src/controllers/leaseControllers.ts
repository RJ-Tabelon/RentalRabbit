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
