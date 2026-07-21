# HubAssist

[![CI](https://github.com/Hub-Assist/Hub-Assist/actions/workflows/ci.yml/badge.svg)](https://github.com/Hub-Assist/Hub-Assist/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Hub-Assist/Hub-Assist/branch/main/graph/badge.svg)](https://codecov.io/gh/Hub-Assist/Hub-Assist)

> A Comprehensive Coworking and Workspace Management System — powered by [Stellar](https://stellar.org)

[![CI](https://github.com/Hub-Assist/Hub-Assist/actions/workflows/ci.yml/badge.svg)](https://github.com/Hub-Assist/Hub-Assist/actions/workflows/ci.yml)

HubAssist is a full-stack monorepo platform designed to streamline **coworking and workspace management** for hubs, shared offices, and enterprise workspaces. It combines a modern web frontend, a robust REST API backend, and on-chain smart contracts deployed on the **Stellar** blockchain via **Soroban** — enabling trustless payments, membership tokens, and access control.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Monorepo Structure](#monorepo-structure)
5. [Getting Started](#getting-started)
6. [Running the Project](#running-the-project)
7. [Stellar / Soroban Contracts](#stellar--soroban-contracts)
8. [Deployment](#deployment)
   - [Frontend (Vercel)](#frontend-vercel)
   - [Backend](#backend)
   - [Contracts (Stellar Testnet)](#contracts-stellar-testnet)
9. [Environment Variables Reference](#environment-variables-reference)
10. [Contributing](#contributing)
11. [Roadmap](#roadmap)
12. [License](#license)

---

## About

HubAssist handles the everyday operational needs of tech hubs and coworking spaces — from managing members and tracking workspace usage to biometric attendance and on-chain payment escrow. The platform is modular, scalable, and built with real-world enterprise requirements in mind.

This project is built on top of the **Stellar network**, leveraging **Soroban smart contracts** (written in Rust) for:
- Membership token issuance
- Workspace booking with payment escrow
- Role-based access control on-chain

---

## Key Features

- **Biometric Authentication** — Clock-in/clock-out via WebAuthn biometric verification.
- **User & Role Management** — Granular roles: admin, member, staff.
- **Workspace Tracking** — Real-time seat usage, room bookings, and resource allocation.
- **On-Chain Payments** — Stellar-powered payment escrow for workspace bookings.
- **Membership Tokens** — Soroban-based membership token contracts.
- **Analytics & Dashboard** — Attendance history, activity logs, and usage reports.
- **Newsletter & Contact** — Subscriber management and contact form handling.
- **Modular Architecture** — Each package (frontend, backend, contracts) is independently deployable.

---

## Tech Stack

| Layer                  | Technology                              |
|------------------------|-----------------------------------------|
| Frontend               | Next.js 14, React, Tailwind CSS         |
| Backend                | NestJS, Node.js, TypeScript             |
| Database               | PostgreSQL (via TypeORM)                |
| Blockchain / Contracts | Rust, Stellar, Soroban SDK              |
| Auth                   | JWT + Biometric (WebAuthn)              |
| Deployment             | Vercel (frontend), Docker (backend)     |
| CI/CD                  | GitHub Actions                          |

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Next.js Frontend  │──────▶│   NestJS REST API         │
│   (Vercel)          │  HTTP  │   /api/v1/...             │
│                     │◀──────│   (Docker / Node)         │
└─────────────────────┘        └────────────┬─────────────┘
                                             │
                              ┌──────────────▼─────────────┐
                              │   PostgreSQL Database       │
                              │   (TypeORM entities)        │
                              └──────────────┬─────────────┘
                                             │
                              ┌──────────────▼─────────────┐
                              │   Stellar / Soroban         │
                              │   Smart Contracts (Rust)    │
                              └────────────────────────────┘
```

The frontend communicates exclusively with the backend REST API. The backend interacts with PostgreSQL for persistence and with Soroban smart contracts on the Stellar network for on-chain operations (payment escrow, membership tokens, access control).

---

## Monorepo Structure

```
hubassist/
├── backend/                  # NestJS REST API
│   └── src/
│       ├── auth/             # JWT auth, OTP, biometric (WebAuthn)
│       ├── users/            # User management and profiles
│       ├── workspaces/       # Workspace CRUD and availability
│       ├── bookings/         # Booking lifecycle and payment
│       ├── attendance/       # Clock-in / clock-out tracking
│       ├── newsletter/       # Subscription management
│       ├── contact/          # Contact form submissions
│       ├── dashboard/        # Aggregated stats and activity
│       ├── stellar/          # Soroban contract interaction
│       ├── email/            # Transactional email (Nodemailer)
│       ├── cloudinary/       # Image upload and storage
│       ├── common/           # Guards, pipes, decorators, pagination
│       ├── config/           # App and database configuration
│       ├── database/
│       │   └── seeds/        # Development seed scripts
│       └── main.ts           # App entry point
│
├── frontend/                 # Next.js 14 App Router
│   ├── src/
│   │   ├── app/              # Pages & layouts (App Router)
│   │   ├── components/       # Reusable UI components
│   │   │   ├── auth/
│   │   │   ├── bookings/
│   │   │   ├── dashboard/
│   │   │   ├── attendance/
│   │   │   ├── workspaces/
│   │   │   ├── landing/
│   │   │   └── ui/
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # API client, store, react-query, schemas
│   │   ├── providers/        # Context providers
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions
│   └── __tests__/            # Frontend unit tests
│
├── contracts/                # Soroban smart contracts (Rust)
│   ├── hubassist_hub/        # Core hub registry
│   ├── manage_hub/           # Hub management (tiers, staking, rewards)
│   ├── workspace_booking/    # Booking + payment escrow
│   ├── membership_token/     # Membership token (SRC-20 style)
│   ├── access_control/       # On-chain role management
│   ├── payment_escrow/       # Payment escrow logic
│   ├── common_types/         # Shared Rust types
│   └── scripts/              # Deploy and initialize scripts
│
├── .github/
│   └── workflows/            # CI/CD pipelines
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **PostgreSQL** ≥ 14
- **Rust** toolchain (`rustup`)
- **Stellar CLI** ≥ 23.x

Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none
```

Install Stellar CLI:
```bash
cargo install --locked stellar-cli@23.1.3
```

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/Hub-Assist/Hub-Assist.git
cd Hub-Assist

# 2. Install backend dependencies
cd backend && npm install

# 3. Install frontend dependencies
cd ../frontend && npm install
```

### Environment Variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Key backend variables:

| Variable         | Description                          |
|------------------|--------------------------------------|
| `DATABASE_URL`   | PostgreSQL connection string         |
| `JWT_SECRET`     | Secret key for JWT signing           |
| `STELLAR_NETWORK`| `testnet` or `mainnet`               |
| `CONTRACT_ID`    | Deployed Soroban contract address    |
| `FRONTEND_URL`   | Allowed CORS origin                  |

Key frontend variables:

| Variable               | Description                    |
|------------------------|--------------------------------|
| `NEXT_PUBLIC_API_URL`  | Backend API base URL (with `/v1`) |

### Seed Development Data

After the database is running:

```bash
cd backend
npm run seed
```

This creates 1 admin, 5 members, 3 staff, 4 workspaces, 10 bookings, 5 newsletter subscribers, and 3 contact messages. The seeder is idempotent — safe to run multiple times. See [backend/README.md](./backend/README.md) for seed credentials.

---

## Running the Project

**Run everything from the root (recommended):**
```bash
# Install all workspace dependencies
npm run install:all

# Start frontend + backend concurrently
npm run dev

# Build both
npm run build

# Lint both
npm run lint

# Test both
npm run test
```

**Or run individually:**

```bash
cd backend && npm run start:dev   # API at http://localhost:3001
cd frontend && npm run dev        # App at http://localhost:3000
```

### Health Check

```
GET /api/health           → { status, timestamp, uptime, database }
GET /api/health/detailed  → DB pool stats, memory, version (admin only)
```

---

## Docker (Local Development)

The entire stack can be started with Docker Compose:

```bash
# Copy and configure environment
cp backend/.env.example backend/.env

# Start all services (postgres + backend + frontend)
docker compose up
```

`docker-compose.override.yml` is applied automatically in development — it mounts source directories into the containers for hot-reload.

| Service    | URL                        |
|------------|----------------------------|
| Frontend   | http://localhost:3000       |
| Backend    | http://localhost:3001       |
| PostgreSQL | localhost:5432              |

To run only the database (e.g. for local `npm run start:dev`):
```bash
docker compose up postgres
```

---

## API Reference

The REST API is versioned under `/api/v1/`. Interactive documentation is available via Swagger UI at:

```
http://localhost:3001/api/docs
```

### Versioning Strategy

URI versioning is used (`/api/v1/`, `/api/v2/`, ...). The current version is **v1**. All controllers declare `version: '1'` explicitly. Future breaking changes will be introduced in a new version while v1 remains supported.

### Endpoints Summary

| Tag         | Base path            | Description                        |
|-------------|----------------------|------------------------------------|
| auth        | `/api/v1/auth`       | Register, login, OTP, refresh      |
| biometric   | `/api/v1/auth/biometric` | WebAuthn registration & login  |
| users       | `/api/v1/users`      | User management                    |
| workspaces  | `/api/v1/workspaces` | Workspace CRUD                     |
| bookings    | `/api/v1/bookings`   | Booking lifecycle                  |
| attendance  | `/api/v1/attendance` | Clock-in / clock-out               |
| newsletter  | `/api/v1/newsletter` | Subscription management            |
| contact     | `/api/v1/contact`    | Contact form                       |
| dashboard   | `/api/v1/dashboard`  | Stats and activity                 |
| hubs        | `/api/v1/hubs`       | Multi-hub management               |
| analytics   | `/api/v1/analytics`  | Admin analytics & reporting        |
| stellar     | `/api/v1/stellar`    | Stellar transaction verification   |

---

## Full-Stack Integration

### Booking Flow

```
BookingForm (frontend)
  → POST /api/v1/bookings  { workspaceId, startTime, endTime, totalAmount, stellarTxHash? }
  → BookingsService validates workspace + checks overlaps
  → StellarService.verifyTransaction(stellarTxHash)  [on confirm]
  → Booking stored in PostgreSQL
  → Confirmation returned to frontend
```

### Membership Token Flow

```
Admin dashboard
  → POST /api/v1/membership-tokens  { userId, tier, expiryDate }
  → Backend calls Soroban membership_token.issue_token(...)
  → Token ID stored on user record
```

### Attendance Flow

```
ClockButton (frontend)
  → POST /api/v1/attendance/clock-in  or  /clock-out
  → AttendanceService stores record in PostgreSQL
  → (optional) manage_hub.log_attendance called on-chain
```

### Stellar Transaction Verification

```
POST /api/v1/stellar/verify-tx  { txHash }
  → StellarService.verifyTransaction(txHash)
  → Returns transaction status from Soroban RPC
```

### Smoke Test

Run the full end-to-end smoke test against a running backend:

```bash
./scripts/smoke-test.sh http://localhost:3001/api/v1
```

The script exercises: register → login → browse workspaces → create booking → clock in → clock out → health check → verify-tx endpoint.

---

## Contract Architecture

All smart contracts live in `contracts/` and are written in **Rust** targeting the **Soroban** runtime on Stellar.

| Contract             | Description                                                  |
|----------------------|--------------------------------------------------------------|
| `hubassist_hub`      | Core hub registry — stores hub metadata and member list      |
| `manage_hub`         | Hub management — tiers, staking, rewards, attendance logging |
| `workspace_booking`  | Booking creation, cancellation, and payment escrow           |
| `membership_token`   | Tokenized membership with expiry and tier support            |
| `access_control`     | On-chain role assignment and permission checks               |
| `payment_escrow`     | Holds funds until booking conditions are met                 |
| `common_types`       | Shared enums, structs, and error types                       |

### Contract Interactions

```
hubassist_hub ──▶ access_control   (role checks)
workspace_booking ──▶ payment_escrow  (hold/release funds)
manage_hub ──▶ membership_token    (issue/revoke tokens)
manage_hub ──▶ attendance_log      (on-chain clock-in/out)
```

### Build & Deploy

```bash
# Build a contract
cd contracts/workspace_booking
stellar contract build

# Run tests
cargo test

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/workspace_booking.wasm \
  --source-account <your-account> \
  --network testnet \
  --alias workspace_booking
```

---

## Deployment

### Frontend — Vercel

1. Connect the repository to [Vercel](https://vercel.com).
2. Set the root directory to `frontend`.
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1`.
4. Deploy.

### Backend — Docker

A `Dockerfile` can be added to `backend/`. The recommended approach:

```bash
# Build
docker build -t hubassist-backend ./backend

# Run
docker run -p 3001:3001 --env-file backend/.env hubassist-backend
```

For production, use a managed PostgreSQL service (e.g. AWS RDS, Supabase) and set `NODE_ENV=production` to disable `synchronize` on TypeORM.

---

## Deployment

### Frontend (Vercel)

The frontend is deployed to [Vercel](https://vercel.com). The repository ships with a `frontend/vercel.json` that pins the Next.js framework, build command, and security headers.

#### Connect the repository

1. From the Vercel dashboard, click **Add New → Project** and import the `Hub-Assist/Hub-Assist` GitHub repo.
2. When prompted for the **Root Directory**, choose `frontend`.
3. Vercel auto-detects Next.js. Keep the default **Build Command** (`next build`) and **Output Directory** (`.next`).

#### Configure environment variables

Set the following project environment variables in **Vercel → Project → Settings → Environment Variables** (apply to Production, Preview, and Development scopes as appropriate):

| Variable | Example (Production) | Notes |
|----------|----------------------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.hubassist.com/api` | Public URL of the backend API. Must include the `/api` suffix. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `mainnet` | `testnet` for preview deployments. |
| `NEXT_PUBLIC_APP_URL` | `https://hubassist.com` | Canonical public URL used in metadata and OG tags. |

`frontend/.env.production` documents these variables but contains no real secrets.

#### Custom domain

1. In **Vercel → Project → Settings → Domains**, add your domain (e.g. `hubassist.com`).
2. Add the suggested `A` / `CNAME` records at your DNS provider.
3. Wait for Vercel to issue a TLS certificate (typically under a minute).
4. Update `NEXT_PUBLIC_APP_URL` to the new domain and trigger a redeploy.

#### Deploy from the CLI

```bash
# Preview deployment
npm run deploy:frontend:preview

# Production deployment
npm run deploy:frontend
```

Both commands shell out to the [Vercel CLI](https://vercel.com/docs/cli); run `vercel login` once before first use.

### Backend

The backend is deployed via Docker (or any Node.js host that can run `npm run start:prod`). Ensure all variables listed in [Environment Variables Reference](#environment-variables-reference) are configured in the target environment.

### Contracts (Stellar Testnet)

Contracts can be deployed manually via `contracts/scripts/deploy.sh`, or automatically via the **Deploy Contracts** GitHub Actions workflow (`.github/workflows/deploy-contracts.yml`). The workflow can be triggered manually from the Actions tab and writes deployed contract IDs to `contracts/.env.testnet`.

Required GitHub Actions secret:

- `STELLAR_SECRET_KEY` — Stellar account secret key (starts with `S…`) used to fund deployment. Add it under **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

---

## Environment Variables Reference

### Backend (`backend/.env`)

#### Database
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DATABASE_URL` | string | yes | — | PostgreSQL connection string. |

#### JWT / Auth
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `JWT_SECRET` | string | yes | — | Secret used to sign access tokens. |
| `JWT_EXPIRES_IN` | string | no | `1h` | Access token TTL (e.g. `15m`, `1h`). |
| `REFRESH_TOKEN_SECRET` | string | yes | — | Secret used to sign refresh tokens. |
| `REFRESH_TOKEN_EXPIRES_IN` | string | no | `7d` | Refresh token TTL. |

#### Email (SMTP)
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SMTP_HOST` | string | no | — | SMTP server hostname. |
| `SMTP_PORT` | number | no | — | SMTP server port (often 587 or 465). |
| `SMTP_USER` | string | no | — | SMTP username. |
| `SMTP_PASSWORD` | string | no | — | SMTP password or app password. |
| `EMAIL_FROM` | string | no | — | Default "From" address for outbound mail. |

#### Cloudinary (file uploads)
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | string | no | — | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | string | no | — | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | string | no | — | Cloudinary API secret. |

#### Stellar / Contracts
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `STELLAR_NETWORK` | enum | no | `testnet` | `testnet` or `mainnet`. |
| `WORKSPACE_BOOKING_CONTRACT_ID` | string | no | — | Deployed `workspace_booking` contract ID. |
| `MEMBERSHIP_TOKEN_CONTRACT_ID` | string | no | — | Deployed `membership_token` contract ID. |

#### App
| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NODE_ENV` | enum | no | `development` | `development`, `production`, or `test`. |
| `FRONTEND_URL` | string | no | `http://localhost:3000` | Allowed CORS origin. |

### Frontend (`frontend/.env.local`)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | string | yes | `http://localhost:3001/api` | Public URL of the backend API, including the `/api` suffix. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | enum | no | `testnet` | `testnet` or `mainnet`. |
| `NEXT_PUBLIC_APP_URL` | string | no | `http://localhost:3000` | Canonical public URL of the app. |

To validate the backend env config without booting the app, run:

```bash
npm run validate-env
```

This runs `backend/scripts/validate-env.js`, which loads `backend/.env` and checks it against the Joi schema in `backend/src/config/validation.schema.ts`.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide covering local setup, branch naming, [Conventional Commits](https://www.conventionalcommits.org/), and the pull request process.

Quick start:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes following Conventional Commits (`feat: ...`, `fix: ...`, etc.)
4. Push and open a Pull Request — the PR template will populate automatically

---

## Multi-Hub Architecture

HubAssist supports managing multiple independent hubs (franchise/chain model) from a single platform instance.

### Hub Model

Each hub has:
- `id` — UUID primary key
- `name` — display name
- `slug` — unique URL-friendly identifier
- `address` — physical address (optional)
- `ownerId` — FK to the User who owns the hub
- `isActive` — soft enable/disable flag
- `createdAt` — creation timestamp

### Hub-scoped Resources

`Workspace`, `Booking`, and `Attendance` records each carry an optional `hubId` foreign key. This allows:
- Filtering workspaces and bookings by hub
- Reporting attendance per hub
- Isolating data between franchise locations

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/hubs` | admin | Create a new hub |
| `GET` | `/api/v1/hubs` | any | List all hubs |
| `GET` | `/api/v1/hubs/:slug` | any | Get hub details with its workspaces |

### On-chain Registry

The `hubassist_hub` Soroban contract has been updated to support multiple hub registrations. Each hub is stored with a `hub_id` field, and members are registered per hub:

```
register_hub(caller, name)  → hub_id
get_hub(hub_id)             → Hub { hub_id, name, owner, active }
hub_count()                 → u32
register_member(caller, hub_id, role)
member_count(hub_id)        → u32
```

---

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Biometric hardware integration (fingerprint scanners)
- [ ] Multi-hub support (franchise/chain management)
- [ ] Stellar Anchor integration for fiat on/off ramp
- [ ] Advanced analytics dashboard
- [ ] Webhook support for third-party integrations
- [ ] Docker Compose setup for local development

---

## License

MIT © HubAssist Contributors
