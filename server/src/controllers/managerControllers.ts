import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { wktToGeoJSON } from '@terraformer/wkt';

const prisma = new PrismaClient();

export const getManager = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId } = req.params;
    const manager = await prisma.manager.findUnique({
      where: { cognitoId: cognitoId as string }
    });

    if (manager) {
      res.json(manager);
    } else {
      res.status(404).json({ message: 'Manager not found' });
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving manager: ${error.message}` });
  }
};

export const createManager = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId, name, email, phoneNumber } = req.body;

    const manager = await prisma.manager.create({
      data: {
        cognitoId,
        name,
        email,
        phoneNumber
      }
    });

    res.status(201).json(manager);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error creating manager: ${error.message}` });
  }
};

export const updateManager = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { cognitoId } = req.params;
    const { name, email, phoneNumber } = req.body;

    const updateManager = await prisma.manager.update({
      where: { cognitoId: cognitoId as string },
      data: {
        name,
        email,
        phoneNumber
      }
    });

    res.json(updateManager);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error updating manager: ${error.message}` });
  }
};

// This function gets all the properties that belong to a specific manager.
export const getManagerProperties = async (
  req: Request, // req = the request coming from the client (like the browser or app)
  res: Response // res = what we send back to the client as a response
): Promise<void> => {
  try {
    // Get the manager's ID from the request parameters (like /manager/1234).
    const { cognitoId } = req.params;

    // Find all properties in the database where "managerCognitoId" matches this ID.
    // Also, include the "location" info for each property.
    const properties = await prisma.property.findMany({
      where: { managerCognitoId: cognitoId as string },
      include: {
        location: true
      }
    });

    // Go through each property and reformat its location so it has
    // longitude and latitude instead of just raw coordinates.
    const propertiesWithFormattedLocation = await Promise.all(
      properties.map(async property => {
        // Run a raw SQL query to get the location coordinates (as text).
        const coordinates: { coordinates: string }[] =
          await prisma.$queryRaw`SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`;

        // Convert the coordinates text (WKT format) into GeoJSON (a standard map format).
        const geoJSON: any = wktToGeoJSON(coordinates[0]?.coordinates || '');

        // Extract longitude and latitude values from the GeoJSON data.
        const longitude = geoJSON.coordinates[0];
        const latitude = geoJSON.coordinates[1];

        // Return the property with the location formatted nicely (with longitude and latitude).
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

    // Send back the list of properties (with nice location data) to the client as JSON.
    res.json(propertiesWithFormattedLocation);
  } catch (err: any) {
    res
      .status(500)
      .json({ message: `Error retrieving manager properties: ${err.message}` });
  }
};

