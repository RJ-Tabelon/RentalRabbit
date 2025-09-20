"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagerProperties = exports.updateManager = exports.createManager = exports.getManager = void 0;
const client_1 = require("@prisma/client");
const wkt_1 = require("@terraformer/wkt");
const prisma = new client_1.PrismaClient();
const getManager = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        const manager = await prisma.manager.findUnique({
            where: { cognitoId: cognitoId }
        });
        if (manager) {
            res.json(manager);
        }
        else {
            res.status(404).json({ message: 'Manager not found' });
        }
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving manager: ${error.message}` });
    }
};
exports.getManager = getManager;
const createManager = async (req, res) => {
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
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error creating manager: ${error.message}` });
    }
};
exports.createManager = createManager;
const updateManager = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        const { name, email, phoneNumber } = req.body;
        const updateManager = await prisma.manager.update({
            where: { cognitoId: cognitoId },
            data: {
                name,
                email,
                phoneNumber
            }
        });
        res.json(updateManager);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error updating manager: ${error.message}` });
    }
};
exports.updateManager = updateManager;
// This function gets all the properties that belong to a specific manager.
const getManagerProperties = async (req, // req = the request coming from the client (like the browser or app)
res // res = what we send back to the client as a response
) => {
    try {
        // Get the manager's ID from the request parameters (like /manager/1234).
        const { cognitoId } = req.params;
        // Find all properties in the database where "managerCognitoId" matches this ID.
        // Also, include the "location" info for each property.
        const properties = await prisma.property.findMany({
            where: { managerCognitoId: cognitoId },
            include: {
                location: true
            }
        });
        // Go through each property and reformat its location so it has
        // longitude and latitude instead of just raw coordinates.
        const propertiesWithFormattedLocation = await Promise.all(properties.map(async (property) => {
            // Run a raw SQL query to get the location coordinates (as text).
            const coordinates = await prisma.$queryRaw `SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`;
            // Convert the coordinates text (WKT format) into GeoJSON (a standard map format).
            const geoJSON = (0, wkt_1.wktToGeoJSON)(coordinates[0]?.coordinates || '');
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
        }));
        // Send back the list of properties (with nice location data) to the client as JSON.
        res.json(propertiesWithFormattedLocation);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error retrieving manager properties: ${err.message}` });
    }
};
exports.getManagerProperties = getManagerProperties;
//# sourceMappingURL=managerControllers.js.map