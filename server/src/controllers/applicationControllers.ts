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

// This function creates a new rental application and also creates a lease for it
export const createApplication = async (
  req: Request, // The request coming from the client
  res: Response // The response we will send back to the client
): Promise<void> => {
  try {
    const {
      // Get all necessary data from the request body
      applicationDate,
      status,
      propertyId,
      tenantCognitoId,
      name,
      email,
      phoneNumber,
      message
    } = req.body;

    // Look up the property in the database to get its rent and security deposit
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { pricePerMonth: true, securityDeposit: true }
    });

    // If the property doesn't exist, send a 404 error
    if (!property) {
      res.status(404).json({ message: 'Property not found' });
      return;
    }

    // Use a database transaction to make sure lease and application are created together
    const newApplication = await prisma.$transaction(async prisma => {
      // 1. Create a new lease for this tenant and property
      const lease = await prisma.lease.create({
        data: {
          startDate: new Date(), // Lease starts today
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          ), // Lease ends 1 year from today
          rent: property.pricePerMonth, // Monthly rent from the property
          deposit: property.securityDeposit, // Security deposit from the property
          property: {
            connect: { id: propertyId } // Link lease to this property
          },
          tenant: {
            connect: { cognitoId: tenantCognitoId } // Link lease to this tenant
          }
        }
      });

      // 2. Create the application and connect it to the lease, tenant, and property
      const application = await prisma.application.create({
        data: {
          applicationDate: new Date(applicationDate),
          status,
          name,
          email,
          phoneNumber,
          message,
          property: {
            connect: { id: propertyId } // Link to property
          },
          tenant: {
            connect: { cognitoId: tenantCognitoId } // Link to tenant
          },
          lease: {
            connect: { id: lease.id } // Link to the lease we just created
          }
        },
        include: {
          property: true, // Include full property info in the result
          tenant: true, // Include full tenant info in the result
          lease: true // Include lease info in the result
        }
      });

      // Return the newly created application
      return application;
    });

    // Send the new application back to the client with a 201 Created status
    res.status(201).json(newApplication);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error creating application: ${error.message}` });
  }
};

// This function updates the status of a rental application
export const updateApplicationStatus = async (
  req: Request, // The request from the client
  res: Response // The response we will send back to the client
): Promise<void> => {
  try {
    // Get the application ID from the URL
    const { id } = req.params;

    // Get the new status from the request body
    const { status } = req.body;

    // Find the application in the database by its ID
    // Also include related property and tenant information
    const application = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: {
        property: true,
        tenant: true
      }
    });

    // If the application doesn't exist, return a 404 error
    if (!application) {
      res.status(404).json({ message: 'Application not found.' });
      return;
    }

    // If the status is "Approved", create a new lease
    if (status === 'Approved') {
      // Create a new lease for this tenant and property
      const newLease = await prisma.lease.create({
        data: {
          startDate: new Date(), // Lease starts today
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          ), // Lease ends 1 year from today
          rent: application.property.pricePerMonth, // Rent from property
          deposit: application.property.securityDeposit, // Deposit from property
          propertyId: application.propertyId, // Connect lease to property
          tenantCognitoId: application.tenantCognitoId // Connect lease to tenant
        }
      });

      // Update the property to connect this tenant (add tenant to property)
      await prisma.property.update({
        where: { id: application.propertyId },
        data: {
          tenants: {
            connect: { cognitoId: application.tenantCognitoId }
          }
        }
      });

      // Update the application with the new status and the new lease ID
      await prisma.application.update({
        where: { id: Number(id) },
        data: { status, leaseId: newLease.id },
        include: {
          property: true,
          tenant: true,
          lease: true
        }
      });
    } else {
      // For other statuses (like "Denied"), just update the status
      await prisma.application.update({
        where: { id: Number(id) },
        data: { status }
      });
    }

    // Get the updated application from the database including property, tenant, and lease
    const updatedApplication = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: {
        property: true,
        tenant: true,
        lease: true
      }
    });

    // Send the updated application back to the client as JSON
    res.json(updatedApplication);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error updating application status: ${error.message}` });
  }
};
