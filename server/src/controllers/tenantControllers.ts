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


