import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { wktToGeoJSON } from '@terraformer/wkt';

const prisma = new PrismaClient();

export const getTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cognitoId } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { cognitoId: cognitoId as string },
      include: {
        favorites: true
      }
    });

    if (tenant) {
      res.json(tenant);
    } else {
      res.status(404).json({ message: 'Tenant not found' });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving tenant: ${error.message}` });
  }
};

export const createTenant = async (
  req: Request,
  res: Response
): Promise<void> => {
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
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error creating tenant: ${error.message}` });
  }
};

export const updateTenant = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId } = req.params;
    const { name, email, phoneNumber } = req.body;

    const updateTenant = await prisma.tenant.update({
      where: { cognitoId: cognitoId as string },
      data: {
        name,
        email,
        phoneNumber
      }
    });

    res.json(updateTenant);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error updating tenant: ${error.message}` });
  }
};

// This function gets all the rental properties where a tenant currently lives.
// It looks up the tenant by their Cognito ID, finds their properties,
// reformats the location to have longitude/latitude, and sends the result back.
export const getCurrentResidences = async (
  req: Request, // req = the request that comes from the client
  res: Response // res = the response we will send back to the client
): Promise<void> => {
  try {
    // Get the tenant's ID from the request URL (example: /residences/12345).
    const { cognitoId } = req.params;

    // Find all properties from the database where this tenant lives.
    // "some" means: find properties where at least one tenant has this cognitoId.
    // Also include the related "location" info with each property.
    const properties = await prisma.property.findMany({
      where: { tenants: { some: { cognitoId: cognitoId as string } } },
      include: {
        location: true
      }
    });

    // For each property, we want to take the raw location data
    // and convert it into a nicer format with longitude and latitude.
    const residencesWithFormattedLocation = await Promise.all(
      properties.map(async property => {
        // Run a raw SQL query to get the location coordinates (as text).
        const coordinates: { coordinates: string }[] =
          await prisma.$queryRaw`SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`;

        // Convert the coordinates from WKT (Well-Known Text) format into GeoJSON.
        const geoJSON: any = wktToGeoJSON(coordinates[0]?.coordinates || '');

        // Pull out longitude (x) and latitude (y) values from the GeoJSON data.
        const longitude = geoJSON.coordinates[0];
        const latitude = geoJSON.coordinates[1];

        // Return the property, but with its location updated
        // so it has readable longitude and latitude values.
        return {
          ...property,
          location: {
            ...property.location,
            coordinates: {
              longitude,
              latitude
            }
          }
        };
      })
    );

    // Send back the list of properties (with clean location data) as JSON.
    res.json(residencesWithFormattedLocation);
  } catch (err: any) {
    res
      .status(500)
      .json({ message: `Error retrieving tenant properties: ${err.message}` });
  }
};

// This function adds a property to a tenant's list of favorite properties.
// It checks if the tenant exists, and also checks if the property is already a favorite.
export const addFavoriteProperty = async (
  req: Request, // req = request from the client
  res: Response // res = what we will send back to the client
): Promise<void> => {
  try {
    // Get the tenant's ID and the property ID from the URL (example: /favorite/tenantId/propertyId)
    const { cognitoId, propertyId } = req.params;

    // Find the tenant in the database by their Cognito ID
    // Also get their current list of favorite properties
    const tenant = await prisma.tenant.findUnique({
      where: { cognitoId: cognitoId as string },
      include: { favorites: true }
    });

    // If the tenant doesn't exist, send a 404 error and stop the function
    if (!tenant) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    // Convert the property ID from a string to a number
    const propertyIdNumber = Number(propertyId);

    // Get the tenant's current favorites (or empty array if none)
    const existingFavorites = tenant.favorites || [];

    // Check if this property is already in the tenant's favorites
    if (!existingFavorites.some(fav => fav.id === propertyIdNumber)) {
      // If not, update the tenant in the database to add this property to favorites
      const updatedTenant = await prisma.tenant.update({
        where: { cognitoId: cognitoId as string },
        data: {
          favorites: {
            connect: { id: propertyIdNumber } // Connect this property to the tenant's favorites
          }
        },
        include: { favorites: true } // Return the updated list of favorites
      });

      // Send the updated tenant back as JSON
      res.json(updatedTenant);
    } else {
      // If the property is already a favorite, send a 409 conflict error
      res.status(409).json({ message: 'Property already added as favorite' });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error adding favorite property: ${error.message}` });
  }
};

// This function removes a property from a tenant's list of favorite properties.
export const removeFavoriteProperty = async (
  req: Request, // req = the request from the client
  res: Response // res = the response we will send back to the client
): Promise<void> => {
  try {
    // Get the tenant's ID and the property ID from the URL (example: /favorites/remove/tenantId/propertyId)
    const { cognitoId, propertyId } = req.params;

    // Convert the property ID from a string to a number
    const propertyIdNumber = Number(propertyId);

    // Update the tenant in the database
    // "disconnect" removes the connection between this tenant and the property
    const updatedTenant = await prisma.tenant.update({
      where: { cognitoId: cognitoId as string },
      data: {
        favorites: {
          disconnect: { id: propertyIdNumber } // Remove this property from favorites
        }
      },
      include: { favorites: true } // Return the updated list of favorite properties
    });

    // Send back the updated tenant (with new favorites) as JSON
    res.json(updatedTenant);
  } catch (err: any) {
    res
      .status(500)
      .json({ message: `Error removing favorite property: ${err.message}` });
  }
};
