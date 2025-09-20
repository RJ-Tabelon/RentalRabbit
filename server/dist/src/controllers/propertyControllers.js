"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProperty = exports.getProperty = exports.getProperties = void 0;
const client_1 = require("@prisma/client");
const wkt_1 = require("@terraformer/wkt");
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1'
});
const getProperties = async (req, res) => {
    try {
        const { favoriteIds, priceMin, priceMax, beds, baths, propertyType, squareFeetMin, squareFeetMax, amenities, availableFrom, latitude, longitude } = req.query;
        let whereConditions = [];
        if (favoriteIds) {
            const favoriteIdsArray = favoriteIds.split(',').map(Number);
            whereConditions.push(client_1.Prisma.sql `p.id IN (${client_1.Prisma.join(favoriteIdsArray)})`);
        }
        if (priceMin) {
            whereConditions.push(client_1.Prisma.sql `p."pricePerMonth" >= ${Number(priceMin)}`);
        }
        if (priceMax) {
            whereConditions.push(client_1.Prisma.sql `p."pricePerMonth" <= ${Number(priceMax)}`);
        }
        if (beds && beds !== 'any') {
            whereConditions.push(client_1.Prisma.sql `p.beds >= ${Number(beds)}`);
        }
        if (baths && baths !== 'any') {
            whereConditions.push(client_1.Prisma.sql `p.baths >= ${Number(baths)}`);
        }
        if (squareFeetMin) {
            whereConditions.push(client_1.Prisma.sql `p."squareFeet" >= ${Number(squareFeetMin)}`);
        }
        if (squareFeetMax) {
            whereConditions.push(client_1.Prisma.sql `p."squareFeet" <= ${Number(squareFeetMax)}`);
        }
        if (propertyType && propertyType !== 'any') {
            whereConditions.push(client_1.Prisma.sql `p."propertyType" = ${propertyType}::"PropertyType"`);
        }
        if (amenities && amenities !== 'any') {
            const amenitiesArray = amenities.split(',');
            whereConditions.push(client_1.Prisma.sql `p.amenities @> ${amenitiesArray}`);
        }
        if (availableFrom && availableFrom !== 'any') {
            const availableFromDate = typeof availableFrom === 'string' ? availableFrom : null;
            if (availableFromDate) {
                const date = new Date(availableFromDate);
                if (!isNaN(date.getTime())) {
                    whereConditions.push(client_1.Prisma.sql `EXISTS (
              SELECT 1 FROM "Lease" l 
              WHERE l."propertyId" = p.id 
              AND l."startDate" <= ${date.toISOString()}
            )`);
                }
            }
        }
        if (latitude && longitude) {
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            const radiusInKilometers = 1000;
            const degrees = radiusInKilometers / 111; // Converts kilometers to degrees
            whereConditions.push(client_1.Prisma.sql `ST_DWithin(
          l.coordinates::geometry,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
          ${degrees}
        )`);
        }
        const completeQuery = client_1.Prisma.sql `
      SELECT 
        p.*,
        json_build_object(
          'id', l.id,
          'address', l.address,
          'city', l.city,
          'state', l.state,
          'country', l.country,
          'postalCode', l."postalCode",
          'coordinates', json_build_object(
            'longitude', ST_X(l."coordinates"::geometry),
            'latitude', ST_Y(l."coordinates"::geometry)
          )
        ) as location
      FROM "Property" p
      JOIN "Location" l ON p."locationId" = l.id
      ${whereConditions.length > 0
            ? client_1.Prisma.sql `WHERE ${client_1.Prisma.join(whereConditions, ' AND ')}`
            : client_1.Prisma.empty}
    `;
        const properties = await prisma.$queryRaw(completeQuery);
        res.json(properties);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving properties: ${error.message}` });
    }
};
exports.getProperties = getProperties;
const getProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const property = await prisma.property.findUnique({
            where: { id: Number(id) },
            include: {
                location: true
            }
        });
        if (property) {
            const coordinates = await prisma.$queryRaw `SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`;
            const geoJSON = (0, wkt_1.wktToGeoJSON)(coordinates[0]?.coordinates || '');
            const longitude = geoJSON.coordinates[0];
            const latitude = geoJSON.coordinates[1];
            const propertyWithCoordinates = {
                ...property,
                location: {
                    ...property.location,
                    coordinates: {
                        longitude,
                        latitude
                    }
                }
            };
            res.json(propertyWithCoordinates);
        }
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error retrieving property: ${err.message}` });
    }
};
exports.getProperty = getProperty;
// This function creates a new property (a rental listing).
// It takes information from the request (req), saves photos to AWS S3,
// looks up the address location (longitude/latitude), and stores everything in the database.
const createProperty = async (req, res) => {
    try {
        // Get all uploaded files (like property photos) from the request
        const files = req.files;
        // Get property info from the request body
        // The `...propertyData` means "everything else that wasn't listed above"
        const { address, city, state, country, postalCode, managerCognitoId, ...propertyData } = req.body;
        // Upload all photos to AWS S3 and get their URLs
        const photoUrls = await Promise.all(files.map(async (file) => {
            // Info needed for the upload (bucket, filename, file content, type)
            const uploadParams = {
                Bucket: process.env.S3_BUCKET_NAME, // S3 bucket name (from .env file)
                Key: `properties/${Date.now()}-${file.originalname}`, // unique filename
                Body: file.buffer, // the actual file content
                ContentType: file.mimetype // file type (like image/jpeg)
            };
            // Upload the file to S3
            const uploadResult = await new lib_storage_1.Upload({
                client: s3Client,
                params: uploadParams
            }).done();
            // Return the web URL of the uploaded photo
            return uploadResult.Location;
        }));
        // Build a URL to ask OpenStreetMap for latitude/longitude of the property
        const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
            street: address,
            city,
            country,
            postalCode: postalCode,
            format: 'json',
            limit: '1'
        }).toString()}`;
        // Send a request to OpenStreetMap API to get location coordinates
        const geocodingResponse = await axios_1.default.get(geocodingUrl, {
            headers: {
                'User-Agent': 'RentalRabbit (123@gmail.com)' // required by the API
            }
        });
        // Extract longitude and latitude from the response, or default to [0,0] if missing
        const [longitude, latitude] = geocodingResponse.data[0]?.lon && geocodingResponse.data[0]?.lat
            ? [
                parseFloat(geocodingResponse.data[0]?.lon),
                parseFloat(geocodingResponse.data[0]?.lat)
            ]
            : [0, 0];
        // Save the location details in the database (Postgres with PostGIS for maps)
        const [location] = await prisma.$queryRaw `
      INSERT INTO "Location" (address, city, state, country, "postalCode", coordinates)
      VALUES (${address}, ${city}, ${state}, ${country}, ${postalCode}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
      RETURNING id, address, city, state, country, "postalCode", ST_AsText(coordinates) as coordinates;
    `;
        // Create the actual property record in the database
        const newProperty = await prisma.property.create({
            data: {
                ...propertyData, // everything else that was passed in req.body
                photoUrls, // all the S3 photo URLs
                locationId: location?.id, // link to the saved location
                managerCognitoId, // ID of the manager who owns this property
                // Split strings like "wifi, pool, gym" into arrays
                amenities: typeof propertyData.amenities === 'string'
                    ? propertyData.amenities.split(',')
                    : [],
                highlights: typeof propertyData.highlights === 'string'
                    ? propertyData.highlights.split(',')
                    : [],
                // Convert strings to correct types (true/false, numbers, etc.)
                isPetsAllowed: propertyData.isPetsAllowed === 'true',
                isParkingIncluded: propertyData.isParkingIncluded === 'true',
                pricePerMonth: parseFloat(propertyData.pricePerMonth),
                securityDeposit: parseFloat(propertyData.securityDeposit),
                applicationFee: parseFloat(propertyData.applicationFee),
                beds: parseInt(propertyData.beds),
                baths: parseFloat(propertyData.baths),
                squareFeet: parseInt(propertyData.squareFeet)
            },
            include: {
                location: true, // also return location data
                manager: true // also return manager data
            }
        });
        // Send back the new property info with status 201 (Created)
        res.status(201).json(newProperty);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error creating property: ${err.message}` });
    }
};
exports.createProperty = createProperty;
//# sourceMappingURL=propertyControllers.js.map