# Contributing to HubAssist

First off, thank you for considering a contribution to HubAssist! This document outlines how to get a development environment running and the conventions we follow for branches, commits, and pull requests.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Development Setup](#development-setup)
3. [Branch Naming](#branch-naming)
4. [Commit Message Format](#commit-message-format)
5. [Pull Request Process](#pull-request-process)
6. [Reporting Issues](#reporting-issues)

---

## Code of Conduct

Be respectful, inclusive, and constructive. Harassment of any kind will not be tolerated.

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 18.x and **npm**
- **PostgreSQL** ≥ 14
- **Rust** toolchain (`rustup`) with the `wasm32v1-none` target
- **Stellar CLI** ≥ 23.x (for contract work)

### Clone and Install

```bash
git clone https://github.com/Hub-Assist/Hub-Assist.git
cd Hub-Assist

# Backend
cd backend && cp .env.example .env && npm install

# Frontend
cd ../frontend && cp .env.example .env.local && npm install
```

### Run Locally

```bash
# Backend (http://localhost:3001)
cd backend && npm run start:dev

# Frontend (http://localhost:3000)
cd frontend && npm run dev

# Contracts (build all)
cd contracts && stellar contract build
```

### Run Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Contracts
cd contracts && cargo test
```

---

## Branch Naming

Use the following prefix conventions to make intent clear at a glance:

| Prefix       | When to use                              | Example                            |
|--------------|------------------------------------------|------------------------------------|
| `feat/`      | A new feature                            | `feat/membership-token-mint`       |
| `fix/`       | A bug fix                                | `fix/cors-origin-validation`       |
| `refactor/`  | A code refactor without behavior change  | `refactor/auth-service-cleanup`    |
| `docs/`      | Documentation only changes               | `docs/contributing-guide`          |
| `test/`      | Adding or fixing tests                   | `test/booking-service-unit-tests`  |
| `chore/`     | Build, CI, or tooling changes            | `chore/upgrade-nest-10`            |
| `perf/`      | A performance improvement                | `perf/query-optimisation`          |

Use lowercase, hyphen-separated names. Keep them short and descriptive.

---

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

### Allowed Types

- **feat**: a new feature
- **fix**: a bug fix
- **docs**: documentation only changes
- **style**: changes that do not affect meaning (white-space, formatting, etc.)
- **refactor**: code change that neither fixes a bug nor adds a feature
- **perf**: a code change that improves performance
- **test**: adding missing tests or correcting existing tests
- **build**: changes to the build system or dependencies
- **ci**: changes to CI configuration files and scripts
- **chore**: other changes that don't modify src or test files

### Examples

```
feat(auth): add WebAuthn biometric login flow
fix(bookings): prevent double-booking when timezone differs
docs(readme): document Vercel deployment process
refactor(users): split user service into auth and profile concerns
ci(contracts): add testnet deployment workflow
```

### Body & Footer

- Wrap the body at 72 characters.
- Explain **what** changed and **why**, not how (the diff covers how).
- Reference issues in the footer: `Closes #123` or `Refs #456`.
- Note breaking changes with `BREAKING CHANGE: <description>` in the footer.

---

## Pull Request Process

1. **Fork** the repository and create your feature branch from `main`.
2. **Make your changes** in small, focused commits that follow the format above.
3. **Add tests** for any new behavior. Make sure existing tests still pass.
4. **Lint and format** your code:
   - Backend: `npm run lint && npm run format`
   - Frontend: `npm run lint`
   - Contracts: `cargo fmt && cargo clippy`
5. **Update documentation** if your change affects user-facing behavior, configuration, or APIs.
6. **Open a Pull Request** against `main` using the PR template that auto-loads.
7. **Link the related issue(s)** in the PR description (`Closes #123`).
8. **Request review** from a maintainer. Address review feedback by pushing new commits — do not force-push to your branch until approval is given.
9. Once approved and CI is green, a maintainer will merge using **squash and merge** by default.

### CI Expectations

Every PR runs the GitHub Actions CI workflow, which must pass before merge:

- Backend build (`npm run build`)
- Frontend build (`npm run build`)
- Contracts build (`cargo build --target wasm32v1-none --release`)

---

## Reporting Issues

- **Bugs**: open an issue using the "Bug report" template.
- **Features**: open an issue using the "Feature request" template.
- **Security vulnerabilities**: report privately via [GitHub Security Advisories](https://github.com/Hub-Assist/Hub-Assist/security/advisories/new). Do **not** open a public issue.

---

Thanks for helping make HubAssist better! 🎉
