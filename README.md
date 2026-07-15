# WorkflowCore — Configurable Workflow Engine

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-purple.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Overview

WorkflowCore is a configurable workflow engine for managing multi-user business processes with strong data consistency, a full audit history, and safe behaviour under concurrent access.

### Key Features

- Dynamic workflow templates with custom stages and transitions
- Immutable audit trail with event sourcing
- Optimistic locking for concurrency safety
- Crash recovery with a reconcile mechanism
- Durable notification queue with BullMQ
- File attachments with versioning
- Search with pagination
- Role-based access control (`ADMIN`, `MANAGER`, `REVIEWER`, `CLIENT`, `PROVIDER`, `VENDOR`, `BUYER`, `REQUESTER`, `BIDDER`)
- Comprehensive test suite (unit, integration, and stress)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/pramudithasadeepa/workflow-core-Assignment.git
cd workflow-core-Assignment
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root (see [Environment Variables](#environment-variables)) and set at least `DATABASE_URL` and `JWT_SECRET`.

4. **Start PostgreSQL and Redis**, then generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Or equivalently:

```bash
npx prisma generate
npx prisma migrate dev
```

5. **Start the application**

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

6. **Run tests** (optional)

```bash
npm test
```

The API listens on `http://localhost:3000` by default (`PORT` in `.env`).

## API Documentation

**Base URL:** `http://localhost:3000/api`

Protected routes require:

```http
Authorization: Bearer <token>
```

Public routes: register, login, health, and queue status/process.

---

### Authentication

#### Register User

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "ADMIN"
}
```

`role` is optional (defaults to `CLIENT`). Password must be at least 6 characters.

#### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Profile

```http
GET /api/auth/profile
Authorization: Bearer <token>
```

#### Change Password

```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "currentPassword": "password123",
  "newPassword": "newpassword123"
}
```

#### List Users (Admin)

```http
GET /api/auth/users
Authorization: Bearer <token>
```

#### Update User Role (Admin)

```http
PATCH /api/auth/users/:userId/role
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "role": "MANAGER"
}
```

#### Delete User (Admin)

```http
DELETE /api/auth/users/:userId
Authorization: Bearer <token>
```

---

### Workflow Templates

Template **create/update** require `ADMIN` or `MANAGER`. **Delete** requires `ADMIN`.

#### Create Template

```http
POST /api/templates
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Approval Workflow",
  "description": "Standard approval process",
  "stages": ["Draft", "Review", "Approval", "Completed"],
  "transitions": {
    "Draft": ["Review"],
    "Review": ["Approval", "Rejected"],
    "Approval": ["Completed", "Rejected"],
    "Rejected": ["Draft"]
  },
  "permissions": {
    "Review": ["ADMIN", "MANAGER"],
    "Approval": ["ADMIN"]
  }
}
```

#### Get All Templates

```http
GET /api/templates
Authorization: Bearer <token>
```

#### Get Template

```http
GET /api/templates/:id
Authorization: Bearer <token>
```

#### Update Template

```http
PATCH /api/templates/:id
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Updated Workflow Name"
}
```

#### Delete Template

```http
DELETE /api/templates/:id
Authorization: Bearer <token>
```

#### Get Valid Transitions (by template)

```http
GET /api/templates/:id/transitions?currentStage=Draft
Authorization: Bearer <token>
```

---

### Workflow Items

#### Create Item

```http
POST /api/items
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "templateId": 1,
  "title": "Document Approval Request",
  "description": "Please approve this document",
  "assignedUsers": [1, 2, 3],
  "priority": "HIGH",
  "dueDate": "2026-12-31T23:59:59.999Z",
  "metadata": {}
}
```

Required fields: `templateId`, `title`.

#### Get All Items (with filters)

```http
GET /api/items?stage=Draft&assignedUser=1&templateId=1&fromDate=2026-01-01&toDate=2026-12-31&page=1&limit=10
Authorization: Bearer <token>
```

Supported query params: `stage`, `assignedUser`, `templateId`, `fromDate`, `toDate`, `page`, `limit`.

#### Get Item

```http
GET /api/items/:id
Authorization: Bearer <token>
```

#### Update Item

```http
PATCH /api/items/:id
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "priority": "URGENT",
  "version": 1
}
```

`version` is used for optimistic locking.

#### Get My Items

```http
GET /api/items/my
Authorization: Bearer <token>
```

---

### Transitions

#### Get Valid Transitions (by item)

```http
GET /api/transitions/:id/valid-transitions
Authorization: Bearer <token>
```

#### Perform Transition

```http
POST /api/transitions/:id/transition
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "fromStage": "Draft",
  "toStage": "Review"
}
```

---

### Audit Trail

#### Get Audit History

```http
GET /api/items/:id/audit
Authorization: Bearer <token>
```

#### Rebuild State

```http
GET /api/items/:id/rebuild
Authorization: Bearer <token>
```

#### Reconcile Item

```http
POST /api/items/:id/reconcile
Authorization: Bearer <token>
```

---

### Attachments

#### Upload File

```http
POST /api/items/:id/attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Form field: `file` — the file to upload.

#### Get Attachments

```http
GET /api/items/:id/attachments
Authorization: Bearer <token>
```

#### Get Version History

```http
GET /api/items/:id/attachments/versions?fileName=document.pdf
Authorization: Bearer <token>
```

`fileName` query parameter is required.

#### Get Attachment

```http
GET /api/attachments/:id
Authorization: Bearer <token>
```

#### Download File

```http
GET /api/attachments/:id/download
Authorization: Bearer <token>
```

#### Delete Attachment

```http
DELETE /api/attachments/:id
Authorization: Bearer <token>
```

---

### Queue

These endpoints are public (no auth middleware).

#### Get Queue Status

```http
GET /api/queue/status
```

#### Process Pending Notifications

```http
POST /api/queue/process
```

---

### Health Check

```http
GET /health
```

## Testing

```bash
# All tests
npm test

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Stress tests
npm run test:stress

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (nodemon) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled app from `dist/` |
| `npm test` | Run all Jest tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:stress` | Stress / concurrency tests |
| `npm run test:coverage` | Tests with coverage |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## Project Structure

```text
workflow-core-Assignment/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── template.controller.ts
│   │   ├── item.controller.ts
│   │   ├── transition.controller.ts
│   │   └── attachment.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── template.service.ts
│   │   ├── item.service.ts
│   │   ├── transition.service.ts
│   │   ├── audit.service.ts
│   │   └── attachment.service.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── template.routes.ts
│   │   ├── item.routes.ts
│   │   ├── transition.routes.ts
│   │   └── attachment.routes.ts
│   ├── middleware/
│   │   └── auth.middleware.ts
│   ├── config/
│   │   └── redis.config.ts
│   ├── queues/
│   │   └── notification.queue.ts
│   ├── tests/
│   │   ├── setup.ts
│   │   ├── unit/
│   │   ├── integration/
│   │   └── stress/
│   └── app.ts
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── scripts/
│   ├── test-db.ts
│   └── test-redis.ts
├── .eslintrc.json
├── .gitignore
├── eslint.config.js
├── jest.config.js
├── nodemon.json
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── README.md
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/workflow_core"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# File uploads
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760
```

Notes:

- `DATABASE_URL`, `JWT_SECRET`, and Redis settings are required for a working app and tests.
- `FRONTEND_URL` is used for CORS (defaults to `*` if unset).
- `UPLOAD_DIR` defaults to `./uploads`; `MAX_FILE_SIZE` defaults to `10485760` (10MB).
- JWT tokens currently expire in **7 days** (`auth.service.ts`).

## License

This project is licensed under the MIT License.
