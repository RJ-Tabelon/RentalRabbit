import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// Create a Prisma client instance to talk to the database
const prisma = new PrismaClient();

// This function lists rental applications with extra information
export const listApplications = async (
  req: Request, // The request coming from the client
  res: Response // The response we will send back to the client
): Promise<void> => {
  try {
    // Get query parameters from the URL, like userId and userType
    const { userId, userType } = req.query;

    // Start with an empty filter (will fetch all applications if no userId/type is given)
    let whereClause = {};

    // If both userId and userType are provided, filter applications
    if (userId && userType) {
      if (userType === 'tenant') {
        // If the user is a tenant, only show their applications
        whereClause = { tenantCognitoId: String(userId) };
      } else if (userType === 'manager') {
        // If the user is a manager, only show applications for properties they manage
        whereClause = {
          property: {
            managerCognitoId: String(userId)
          }
        };
      }
    }

    // Get applications from the database using the filter
    // Also include related property info (location + manager) and tenant info
    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        property: {
          include: {
            location: true,
            manager: true
          }
        },
        tenant: true
      }
    });

    // Helper function to calculate the next payment date for a lease
    function calculateNextPaymentDate(startDate: Date): Date {
      const today = new Date();
      const nextPaymentDate = new Date(startDate);
      // Keep adding 1 month until the date is in the future
      while (nextPaymentDate <= today) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }
      return nextPaymentDate;
    }

    // Format applications to include extra info like manager, address, and next payment date
    const formattedApplications = await Promise.all(
      applications.map(async app => {
        // Find the latest lease for this tenant and property
        const lease = await prisma.lease.findFirst({
          where: {
            tenant: {
              cognitoId: app.tenantCognitoId
            },
            propertyId: app.propertyId
          },
          orderBy: { startDate: 'desc' } // Get the most recent lease
        });

        return {
          ...app, // Include all original application data
          property: {
            ...app.property,
            address: app.property.location.address // Add the property address
          },
          manager: app.property.manager, // Include the manager info
          lease: lease
            ? {
                ...lease,
                nextPaymentDate: calculateNextPaymentDate(lease.startDate) // Add next payment date
              }
            : null // If no lease exists, set to null
        };
      })
    );

    // Send the formatted applications back to the client as JSON
    res.json(formattedApplications);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving applications: ${error.message}` });
  }
};
