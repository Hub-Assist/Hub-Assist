# HubAssist

> A Comprehensive Coworking and Workspace Management System — powered by [Stellar](https://stellar.org)

HubAssist is a full-stack monorepo platform designed to streamline **coworking and workspace management** for hubs, shared offices, and enterprise workspaces. It combines a modern web frontend, a robust REST API backend, and on-chain smart contracts deployed on the **Stellar** blockchain via **Soroban** — enabling trustless payments, membership tokens, and access control.

---

## Table of Contents

1. [About](#about)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Monorepo Structure](#monorepo-structure)
5. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Variables](#environment-variables)
6. [Running the Project](#running-the-project)
7. [Stellar / Soroban Contracts](#stellar--soroban-contracts)
8. [Contributing](#contributing)
9. [Roadmap](#roadmap)
10. [License](#license)

---

## About

HubAssist handles the everyday operational needs of tech hubs and coworking spaces — from managing members and tracking workspace usage to biometric attendance and on-chain payment escrow. The platform is modular, scalable, and built with real-world enterprise requirements in mind.

This project is built on top of the **Stellar network**, leveraging **Soroban smart contracts** (written in Rust) for:
- Membership token issuance
- Workspace booking with payment escrow
- Role-based access control on-chain

---

## Key Features

- **Biometric Authentication** — Clock-in/clock-out for users and staff via biometric verification.
- **User & Role Management** — Granular account roles and permissions (admin, member, staff).
- **Workspace Tracking** — Real-time monitoring of seat usage, room bookings, and resource allocation.
- **On-Chain Payments** — Stellar-powered payment escrow for workspace bookings.
- **Membership Tokens** — Soroban-based membership NFT/token contracts.
- **Analytics & Logs** — Attendance history, activity logs, and usage reports.
- **Team Collaboration** — Multi-user teams with delegated admin roles.
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

## Monorepo Structure

```
hubassist/
├── backend/                  # NestJS REST API
│   └── src/
│       ├── auth/             # JWT auth, biometric login
│       ├── users/            # User management module
│       ├── workspaces/       # Workspace & seat tracking
│       ├── bookings/         # Booking management
│       └── main.ts           # App entry point
│
├── frontend/                 # Next.js 14 App Router
│   ├── app/                  # Pages & layouts
│   ├── components/           # Reusable UI components
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # API clients, utilities
│   └── providers/            # Context providers
│
├── contracts/                # Soroban smart contracts (Rust)
│   ├── hubassist_hub/       # Core hub management contract
│   ├── workspace_booking/    # Booking + payment escrow
│   ├── membership_token/     # Membership token (SRC-20 style)
│   ├── access_control/       # On-chain role management
│   └── common_types/         # Shared Rust types
│
├── .github/
│   └── workflows/            # CI/CD pipelines
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** or **yarn**
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
# macOS/Linux via Homebrew
brew install stellar-cli

# or via cargo
cargo install --locked stellar-cli@23.1.3
```

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-org/hubassist.git
cd hubassist

# 2. Install frontend dependencies
cd frontend && npm install

# 3. Install backend dependencies
cd ../backend && npm install
```

### Environment Variables

```bash
# backend
cp backend/.env.example backend/.env
```

Key variables to configure in `backend/.env`:

| Variable         | Description                          |
|------------------|--------------------------------------|
| `DATABASE_URL`   | PostgreSQL connection string         |
| `JWT_SECRET`     | Secret key for JWT signing           |
| `STELLAR_NETWORK`| `testnet` or `mainnet`               |
| `CONTRACT_ID`    | Deployed Soroban contract address    |
| `FRONTEND_URL`   | Allowed CORS origin (e.g. `https://yourdomain.com`) |

### CORS Configuration

The API uses a strict CORS whitelist. Only the origin set in `FRONTEND_URL` is allowed to make cross-origin requests. Credentials (cookies, Authorization headers) are permitted.

```
FRONTEND_URL=https://yourdomain.com   # production
FRONTEND_URL=http://localhost:3000    # local development
```

Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`  
Allowed headers: `Content-Type, Authorization`

Security headers (HSTS, CSP, X-Frame-Options, etc.) are applied via [helmet](https://helmetjs.github.io/). Response compression is enabled via the `compression` middleware.

---

## Running the Project

**Backend (NestJS):**
```bash
cd backend
npm run start:dev
# API available at http://localhost:3001
```

**Frontend (Next.js):**
```bash
cd frontend
npm run dev
# App available at http://localhost:3000
```

---

## Stellar / Soroban Contracts

All smart contracts live in the `contracts/` directory and are written in **Rust** targeting the **Soroban** runtime on Stellar.

### Build a contract
```bash
cd contracts/workspace_booking
stellar contract build
# Output: target/wasm32v1-none/release/workspace_booking.wasm
```

### Run tests
```bash
cd contracts/workspace_booking
cargo test
```

### Deploy to testnet
```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/workspace_booking.wasm \
  --source-account <your-account> \
  --network testnet \
  --alias workspace_booking
```

### Contracts Overview

| Contract             | Description                                      |
|----------------------|--------------------------------------------------|
| `hubassist_hub`     | Core hub registry and member management          |
| `workspace_booking`  | Booking creation, cancellation, payment escrow   |
| `membership_token`   | Tokenized membership with expiry and tiers       |
| `access_control`     | On-chain role assignment and permission checks   |
| `common_types`       | Shared enums, structs, and error types           |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes with clear messages
4. Push and open a Pull Request

Please follow the existing code style and architecture patterns in each package.

---

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Biometric hardware integration (fingerprint scanners)
- [ ] Multi-hub support (franchise/chain management)
- [ ] Stellar Anchor integration for fiat on/off ramp
- [ ] Advanced analytics dashboard
- [ ] Webhook support for third-party integrations

---

## License

MIT © HubAssist Contributors
