# CreativeHUB Server

This backend provides MongoDB support for the CreativeHUB frontend.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies from the workspace root:

```bash
pnpm install
```

3. Start MongoDB locally or use MongoDB Atlas, then set `MONGO_URI` in `.env`.
4. Run the server:

```bash
cd server
pnpm dev
```

## API Endpoints

- `GET /api/` - health check
- `POST /api/auth/signup` - create a new user
- `POST /api/auth/login` - authenticate
- `GET /api/freelancers` - list freelancer profiles
- `GET /api/freelancers/:id` - load single freelancer
- `GET /api/bookings` - list bookings
- `POST /api/bookings` - create a booking

## MongoDB Models

- `User` - clients and freelancers
- `Booking` - booking requests and status
- `Request` - collaboration requests
- `Message` - chat messages
- `Notification` - app notifications
