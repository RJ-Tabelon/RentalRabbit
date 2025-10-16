# RentalRabbit

Scalable, full‑stack rental property platform with a Next.js frontend, an Express/Node.js backend, PostgreSQL + PostGIS, and AWS infrastructure. Built with production patterns: role‑based auth (AWS Cognito), server‑side filtering and geospatial search, image uploads to S3, and a responsive, modern UI.

## What you can do

- Sign up/sign in with role selection (Tenant or Manager) using AWS Cognito
- Explore properties on a custom Mapbox map with server‑side filtering
  - Filter by price, beds, baths, square feet, property type, amenities, date, and location radius
  - Toggle a full filters panel and reset filters
- View property details with map preview and backend data
- Favorite/unfavorite listings (per authenticated user)
- Tenant dashboard
  - Favorites, current residences, applications, and settings (edit name/email/phone)
- Manager dashboard
  - Manage properties, review applications (approve/deny), view tenants by property, and update settings
  - Create a new property with image uploads to S3 and automatic geocoding
- Fully responsive UI with shadcn/ui components and Tailwind CSS

## Tech stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Redux Toolkit + RTK Query, React Hook Form, Zod, Framer Motion, Mapbox GL JS
- Backend: Node.js, Express 5, Prisma ORM, PostgreSQL with PostGIS, Multer, AWS SDK v3
- Auth: AWS Amplify (Cognito User Pool)
- Cloud: AWS Amplify (frontend hosting), Amazon Cognito (auth), Amazon EC2 (API), Amazon API Gateway (edge routing), Amazon RDS for PostgreSQL (+ PostGIS), Amazon S3 (image storage)

## Monorepo layout

```
client/         # Next.js app (frontend)
server/         # Express API + Prisma schema and seed data
```

Key highlights:
- `client/src/state/api.ts` uses RTK Query and attaches the Cognito ID token as `Authorization: Bearer <idToken>` to API requests.
- `server/src/middleware/authMiddleware.ts` decodes the JWT and gates routes by role (`tenant` or `manager`).
- `server/prisma/schema.prisma` defines entities: Property, Manager, Tenant, Location (geography Point), Application, Lease, Payment, with enums for amenities, highlights, property types, and statuses.
- `server/src/controllers/propertyControllers.ts` demonstrates server‑side filtering and geospatial search with PostGIS.

## Architecture overview

- Web App (Next.js) ↔ API (Express) ↔ PostgreSQL + PostGIS (via Prisma)
- Auth handled by Cognito User Pool through AWS Amplify
- Images uploaded from API to S3 (Multer in‑memory → S3 multipart upload)
- Geocoding via OpenStreetMap Nominatim (used when managers create properties)
- Map UX via Mapbox GL JS on the client

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with PostGIS extension available
- AWS accounts and resources for: Cognito User Pool, S3 bucket, RDS Postgres (with PostGIS), and optionally Amplify, API Gateway, EC2 for deployment
- Mapbox account + Access Token

## Environment variables

Create the following files with your values.

### client/.env.local

```
# API base URL for the Express server
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002

# AWS Cognito (User Pool)
NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=us-xxxx-xxxxxxxx
NEXT_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Mapbox (client-side)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Notes:
- The Cognito User Pool must define a custom attribute `custom:role` (string) used during signup with values `tenant` or `manager`.
- The app uses the Cognito ID token (`idToken`) and expects it on API calls.

### server/.env

```
# Express server
PORT=3002

# PostgreSQL (requires PostGIS)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public

# AWS region + S3 bucket for property photo uploads
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

Notes:
- Ensure your database role can `CREATE EXTENSION postgis;` (or PostGIS is already enabled).

## Install and run locally

Open two terminals (one for server, one for client).

### 1) Backend API (server)

```
cd server
npm install

# Generate Prisma client and copy types for the client app
npm run prisma:generate
npm run postprisma:generate

# Apply migrations (will create tables); ensure PostGIS is available
npx prisma migrate dev --name init

# Seed sample data (uses raw PostGIS inserts for Location)
npm run seed

# Start dev (TypeScript watch + Nodemon)
npm run dev
```

The API listens on http://localhost:3002 by default.

### 2) Frontend web app (client)

```
cd client
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

Sign up with a role (Tenant or Manager). Confirm the user per your Cognito flow. After sign‑in, the app will create a matching record in the API (`/managers` or `/tenants`) if one doesn’t exist yet.

## Database and geospatial

- The `Location.coordinates` column uses `geography(Point, 4326)`.
- Filtering with radius is implemented using PostGIS functions (e.g., `ST_DWithin`).
- Seeding inserts WKT/Point via `ST_GeomFromText` and resets sequences; see `server/prisma/seed.ts` and `server/prisma/seedData/*`.

## Image uploads

- Property creation accepts photo uploads using Multer in memory, then streams to S3 (`properties/<timestamp>-<originalname>`).
- Configure `AWS_REGION` and `S3_BUCKET_NAME` in `server/.env`. The server IAM role/credentials must allow PutObject on the bucket.

## Authentication and authorization

- The client uses AWS Amplify to manage auth and retrieve Cognito tokens.
- RTK Query adds `Authorization: Bearer <idToken>` for requests.
- The API decodes the JWT and checks the `custom:role` claim for route access:
  - Tenants: `/tenants`, `/applications` (create/list)
  - Managers: `/managers`, `/applications/:id/status`, `/properties` (POST)
  - Public: `/properties` (GET), `/properties/:id` (GET)

## API overview

Base URL: `http://localhost:3002`

- Properties
  - `GET /properties` — list with server‑side filters via query params:
    - `favoriteIds` (comma‑separated), `priceMin`, `priceMax`, `beds`, `baths`, `squareFeetMin`, `squareFeetMax`, `propertyType`, `amenities` (comma‑separated), `availableFrom` (ISO date), `latitude`, `longitude`
  - `GET /properties/:id` — property by id
  - `POST /properties` — create (manager only, multipart form with `photos`)
- Tenants
  - `GET /tenants/:cognitoId` — get tenant
  - `PUT /tenants/:cognitoId` — update tenant
  - `POST /tenants` — create tenant (used on first login)
  - `GET /tenants/:cognitoId/current-residences` — list current residences
  - `POST /tenants/:cognitoId/favorites/:propertyId` — add favorite
  - `DELETE /tenants/:cognitoId/favorites/:propertyId` — remove favorite
- Managers
  - `GET /managers/:cognitoId` — get manager
  - `PUT /managers/:cognitoId` — update manager
  - `POST /managers` — create manager (used on first login)
  - `GET /managers/:cognitoId/properties` — list properties owned by manager
- Leases
  - `GET /leases` — list leases (manager or tenant)
  - `GET /leases/:id/payments` — list payments for a lease (manager or tenant)
- Applications
  - `GET /applications?userId=...&userType=tenant|manager` — list applications
  - `POST /applications` — create application (tenant)
  - `PUT /applications/:id/status` — approve/deny (manager)

All protected endpoints require `Authorization: Bearer <Cognito ID token>`.

## UX notes

- Search page combines a compact filters bar and an expanded filters sidebar, plus a responsive Mapbox map and listings panel.
- Settings forms are powered by React Hook Form + Zod with inline validation and toast feedback.
- The app uses shadcn/ui components (Sidebar, Dialog, Tabs, Table, etc.) and Tailwind CSS.

## Deployment (high level)

- Frontend (Next.js):
  - Deploy on AWS Amplify or any static hosting that supports Next.js server features you use. Provide client env vars in the hosting console.
- Backend (Express):
  - Containerize or run on EC2. Place API Gateway in front for TLS, rate‑limiting, and routing.
  - Configure environment variables and IAM to allow S3 access.
- Database:
  - RDS for PostgreSQL with PostGIS enabled. Apply migrations and run the seed only in non‑prod.
- Auth:
  - Cognito User Pool with custom attribute `custom:role` used during signup. Expose Pool ID and Client ID to the client.
- Maps:
  - Provide Mapbox access token as a public client env var.

## Troubleshooting

- PostGIS errors on migrate/seed: ensure the DB user can `CREATE EXTENSION postgis;` or ask your admin to enable it.
- 401/403 from API: verify the client is sending a Cognito ID token and that the user’s `custom:role` matches the required route role.
- Images not appearing: confirm `S3_BUCKET_NAME`, `AWS_REGION`, and IAM permissions (PutObject, public access pattern or presigned URL usage) are configured.
- Empty property search: check query params and ensure seed data was loaded; verify Location coordinates exist.

## Scripts reference

- client
  - `npm run dev` — Next.js dev server
  - `npm run build` — build
  - `npm start` — start production build
  - `npm run lint` — lint
- server
  - `npm run dev` — TypeScript watch + Nodemon for API
  - `npm run build` — compile TypeScript to `dist`
  - `npm start` — build then run `dist/index.js`
  - `npm run seed` — seed database
  - `npm run prisma:generate` — generate Prisma client
  - `npm run postprisma:generate` — copy Prisma types to `client/src/types/prismaTypes.d.ts`

## Data model (Prisma)

- Property: pricing, details, arrays of amenities/highlights, type, rating, location, manager, leases, applications, favorites
- Manager: profile and managed properties
- Tenant: profile, favorites, residences, applications, leases
- Location: address metadata and `geography(Point, 4326)` coordinates
- Application: status, links tenant/property/lease
- Lease: dates, rent, deposit, links tenant/property, payments
- Payment: amount due/paid, due/paid dates, status

See `server/prisma/schema.prisma` for details and enums.