# DataShare — Specification Summary

## Goal
A file-sharing web app where users (anonymous or registered) can upload files and share them via temporary download links, with optional password protection and management features for authenticated users.

---

## MVP User Stories

### US01 — Upload (authenticated)
- Authenticated users upload files and receive a unique download token/link.
- File is tied to the user's account and visible in their history.
- **Default expiration: 7 days** (user-configurable at upload time, max 7 days).
- File + metadata are auto-deleted on expiration.
- Optional password protection at upload time.
- **Max file size: 1 GB**; blocked file types to define (e.g. `.exe`, `.bat`).
- Tags can be added at upload.

### US02 — Download via link
- Anyone with the link can download the file (no account needed).
- If password-protected, password is required before download.
- File metadata (name, type, size, expiration date) shown before download.
- Expired or invalid links return a clear error.

### US03 — Account creation
- Email (unique) + password (min 8 chars, hashed + salted).
- No email confirmation required in MVP.
- No admin role in MVP.
- JWT token issued on login.

### US04 — User login
- Login with email + password.
- Returns a JWT token for authenticated requests.

### US05 — File history
- Authenticated users see all their uploaded files: name, size, upload date, expiration date, link status (valid / expired).
- Manual deletion before expiration is allowed.
- No filtering/sorting required in MVP.

### US06 — File deletion
- Authenticated users can delete their own files.
- Deletion is permanent (file + all metadata removed from storage).
- Confirmation required on the front-end.
- Only own files can be deleted.

---

## Optional / Advanced Features

### US07 — Anonymous upload
- Same rules as US01 but not tied to a user account.
- No history or file management available after upload.
- Optional password and expiration fields.
- Only accessible to unauthenticated users.

### US08 — Tag management
- Authenticated users can add free-text tags to files (0–N tags, max 30 chars each, no duplicates per file).
- Tags can optionally be used for filtering in the history view.

### US09 — Password protection
- Any user (anonymous or authenticated) can set a password on a file at upload time.
- Password is hashed (not reversible); no recovery mechanism.
- Min 6 characters.

### US10 — Automatic file expiration
- Default: 7 days; user can choose 1–7 days at upload.
- A scheduled task (cron or equivalent) runs daily to purge expired files.
- Expiration deletes both the file and all associated metadata.

---

## Technical Constraints

- Code in a Git repository (GitHub or GitLab) with clean commit history; conventional commits recommended.
- REST API architecture.
- JWT authentication.
- Client-side **and** server-side input validation.
- Proper error handling.
- Accessibility (PSH users considered).
- Deployment scripts: install + DB configuration.

### Tech Stack (to choose)

| Layer     | Options |
|-----------|---------|
| Back-end  | Spring Boot (Java) · .NET Core (C#) · NestJS (TypeScript) · PHP Symfony/Laravel |
| Front-end | Angular · React · VueJS |
| Database  | PostgreSQL · MongoDB |
| Storage   | Local filesystem · AWS S3 |

---

## Quality & Maintenance Requirements

Four required documentation files:

| File | Content |
|------|---------|
| `TESTING.md` | Unit tests on all MVP features; E2E tests (Cypress or equivalent, ≥ 23 critical scenarios); acceptance criteria; run instructions; ≥ 70% code coverage (with screenshot of coverage report) |
| `SECURITY.md` | Basic security scan (e.g. npm dependency/vulnerability audit); brief analysis of findings and decisions |
| `PERF.md` | k6 (or equivalent) load test on a critical endpoint with results; front-end performance budget (bundle size, browser metrics); logs/metrics captures |
| `MAINTENANCE.md` | Dependency update procedures: frequency and risks |

---

## Key Business Rules at a Glance

| Rule | Value |
|------|-------|
| Max file size | 1 GB |
| Default expiration | 7 days |
| Max expiration | 7 days |
| Min expiration | 1 day |
| File password min length | 6 characters |
| Account password min length | 8 characters |
| Tag max length | 30 characters |
| Expiration purge | Daily cron job |
| Auth method | JWT |
