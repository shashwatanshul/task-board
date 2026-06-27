# Task Board

A small full-stack Task Board where a user can sign up, log in, create tasks, view their own tasks, and update each task's status (Todo / In Progress / Done).

Live URL: _add after deploying to Vercel_

## Tech Stack

- **Next.js 16** (App Router) with **TypeScript**
- **Tailwind CSS** for styling
- **PostgreSQL** (hosted on **Neon**)
- **Prisma ORM** (v7, using the `@prisma/adapter-pg` driver adapter, with automatic retry for Neon cold starts)
- **Custom authentication**: `bcryptjs` for password hashing + JWT (`jose`) stored in an httpOnly cookie

## Features

- Email/password signup and login (single role: User)
- Securely hashed passwords (bcrypt)
- Create a task (title; status defaults to `Todo`)
- View all tasks belonging to the logged-in user
- Update a task's status via a dropdown
- Loading state, empty state, and a responsive layout
- Input validation (zod) and consistent JSON error handling

## Authentication Flow

1. **Signup** (`POST /api/auth/signup`): input is validated with zod; the password is hashed with bcrypt and the user is stored. A signed JWT is then set as an httpOnly cookie.
2. **Login** (`POST /api/auth/login`): the password is compared against the stored hash with bcrypt. On success, a JWT is issued and set as an httpOnly cookie. (The same error message is returned for unknown email and wrong password so we don't leak which emails exist.)
3. **JWT**: signed with HS256 using `JWT_SECRET` via the `jose` library (edge/Node compatible). The token holds `userId` and `email` and expires after 7 days.
4. **Authorization**: `src/proxy.ts` (Next.js 16 "proxy", formerly middleware) verifies the cookie and:
   - redirects unauthenticated users away from `/` to `/login`,
   - returns `401 JSON` for unauthenticated `/api/tasks/*` requests,
   - redirects already-authenticated users away from `/login` and `/signup`.
   Each API route additionally re-checks the user via `getCurrentUser()` (defense in depth) and scopes all task queries to that user's id.
5. **Logout** (`POST /api/auth/logout`): clears the cookie.

## Database Schema

One `User` has many `Task`s. Every task belongs to exactly one user and is always queried with a `userId` filter, so users can only see and modify their own tasks.

```
User
├─ id            String  @id @default(cuid())
├─ email         String  @unique
├─ passwordHash  String
├─ createdAt     DateTime
└─ tasks         Task[]

Task
├─ id         String   @id @default(cuid())
├─ title      String
├─ status     Status   @default(Todo)   // enum: Todo | InProgress | Done
├─ userId     String                     // FK -> User.id (onDelete: Cascade)
├─ createdAt  DateTime
└─ updatedAt  DateTime
```

See [`prisma/schema.prisma`](prisma/schema.prisma) for the source of truth.

## API Routes

| Method | Route               | Auth | Description                         |
| ------ | ------------------- | ---- | ----------------------------------- |
| POST   | `/api/auth/signup`  | No   | Create account + set cookie         |
| POST   | `/api/auth/login`   | No   | Log in + set cookie                 |
| POST   | `/api/auth/logout`  | No   | Clear cookie                        |
| GET    | `/api/tasks`        | Yes  | List the current user's tasks       |
| POST   | `/api/tasks`        | Yes  | Create a task                       |
| PATCH  | `/api/tasks/[id]`   | Yes  | Update a task's status (own tasks)  |

## Project Structure

```
prisma/
  schema.prisma           # models + Status enum
prisma.config.ts          # Prisma 7 CLI config (connection URL for migrations)
src/
  app/
    api/
      auth/{signup,login,logout}/route.ts
      tasks/route.ts        # GET (list) + POST (create)
      tasks/[id]/route.ts   # PATCH (update status)
    login/page.tsx
    signup/page.tsx
    page.tsx                # protected dashboard
    layout.tsx
  components/
    AuthForm.tsx            # shared login/signup form (client)
    TaskBoard.tsx           # task list + create + status update (client)
    LogoutButton.tsx
  lib/
    prisma.ts               # PrismaClient singleton (pg adapter + cold-start retry)
    auth.ts                 # bcrypt + cookie helpers + getCurrentUser
    jwt.ts                  # sign/verify JWT (jose)
    validation.ts           # zod schemas
    status.ts               # client-safe status enum + labels
  proxy.ts                  # route protection (Next.js 16)
```

## Run Locally

### Prerequisites

- Node.js 18.18+ (tested on Node 22)
- A PostgreSQL database. The instructions below use a free [Neon](https://neon.tech) database.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

`.env` needs:

- `DATABASE_URL` – Neon **pooled** connection string (host contains `-pooler`). Used by the app at runtime.
- `DIRECT_URL` – Neon **direct** (non-pooled) connection string. Used by Prisma Migrate.
- `JWT_SECRET` – a long random string. Generate one with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 3. Create the database tables

```bash
npx prisma migrate dev --name init
```

### 4. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000. You'll be redirected to `/login`. Create an account at `/signup`, then add and update tasks.

### Useful commands

```bash
npm run dev        # start dev server
npm run build      # prisma generate + production build
npm run start      # run the production build
npm run lint       # lint
npx prisma studio  # browse the database
```
