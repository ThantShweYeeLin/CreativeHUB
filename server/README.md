# CreativeHUB Server

This optional API provides Supabase-backed endpoints for CreativeHUB. The Vite
frontend accesses Supabase directly and does not require this server to run.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies from the workspace root:

```bash
pnpm install
```

3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` (the equivalent
   `VITE_SUPABASE_*` variables are also accepted).
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

All persisted data is stored in the Supabase tables defined in
`../supabase/schema.sql`.
