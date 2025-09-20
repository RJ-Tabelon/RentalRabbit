"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeFavoriteProperty = exports.addFavoriteProperty = exports.getCurrentResidences = exports.updateTenant = exports.createTenant = exports.getTenant = void 0;
const client_1 = require("@prisma/client");
const wkt_1 = require("@terraformer/wkt");
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
const updateTenant = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        const { name, email, phoneNumber } = req.body;
        const updateTenant = await prisma.tenant.update({
            where: { cognitoId: cognitoId },
            data: {
                name,
                email,
                phoneNumber
            }
        });
        res.json(updateTenant);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error updating tenant: ${error.message}` });
    }
};
exports.updateTenant = updateTenant;
// This function gets all the rental properties where a tenant currently lives.
// It looks up the tenant by their Cognito ID, finds their properties,
// reformats the location to have longitude/latitude, and sends the result back.
const getCurrentResidences = async (req, // req = the request that comes from the client
res // res = the response we will send back to the client
) => {
    try {
        // Get the tenant's ID from the request URL 
        const { cognitoId } = req.params;
        // Find all properties from the database where this tenant lives.
        // "some" means: find properties where at least one tenant has this cognitoId.
        // Also include the related "location" info with each property.
        const properties = await prisma.property.findMany({
            where: { tenants: { some: { cognitoId: cognitoId } } },
            include: {
                location: true
            }
        });
        // For each property, we want to take the raw location data
        // and convert it into a nicer format with longitude and latitude.
        const residencesWithFormattedLocation = await Promise.all(properties.map(async (property) => {
            // Run a raw SQL query to get the location coordinates (as text).
            const coordinates = await prisma.$queryRaw `SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`;
            // Convert the coordinates from WKT (Well-Known Text) format into GeoJSON.
            const geoJSON = (0, wkt_1.wktToGeoJSON)(coordinates[0]?.coordinates || '');
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
        }));
        // Send back the list of properties (with clean location data) as JSON.
        res.json(residencesWithFormattedLocation);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error retrieving tenant properties: ${err.message}` });
    }
};
exports.getCurrentResidences = getCurrentResidences;
// This function adds a property to a tenant's list of favorite properties.
// It checks if the tenant exists, and also checks if the property is already a favorite.
const addFavoriteProperty = async (req, // req = request from the client
res // res = what we will send back to the client
) => {
    try {
        // Get the tenant's ID and the property ID from the URL
        const { cognitoId, propertyId } = req.params;
        // Find the tenant in the database by their Cognito ID
        // Also get their current list of favorite properties
        const tenant = await prisma.tenant.findUnique({
            where: { cognitoId: cognitoId },
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
                where: { cognitoId: cognitoId },
                data: {
                    favorites: {
                        connect: { id: propertyIdNumber } // Connect this property to the tenant's favorites
                    }
                },
                include: { favorites: true } // Return the updated list of favorites
            });
            // Send the updated tenant back as JSON
            res.json(updatedTenant);
        }
        else {
            // If the property is already a favorite, send a 409 conflict error
            res.status(409).json({ message: 'Property already added as favorite' });
        }
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error adding favorite property: ${error.message}` });
    }
};
exports.addFavoriteProperty = addFavoriteProperty;
// This function removes a property from a tenant's list of favorite properties.
const removeFavoriteProperty = async (req, // req = the request from the client
res // res = the response we will send back to the client
) => {
    try {
        // Get the tenant's ID and the property ID from the URL
        const { cognitoId, propertyId } = req.params;
        // Convert the property ID from a string to a number
        const propertyIdNumber = Number(propertyId);
        // Update the tenant in the database
        // "disconnect" removes the connection between this tenant and the property
        const updatedTenant = await prisma.tenant.update({
            where: { cognitoId: cognitoId },
            data: {
                favorites: {
                    disconnect: { id: propertyIdNumber } // Remove this property from favorites
                }
            },
            include: { favorites: true } // Return the updated list of favorite properties
        });
        // Send back the updated tenant (with new favorites) as JSON
        res.json(updatedTenant);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error removing favorite property: ${err.message}` });
    }
};
exports.removeFavoriteProperty = removeFavoriteProperty;
//# sourceMappingURL=tenantControllers.js.map