# DataShare — Logical Data Model (MLD)

## Relational Notation

> Primary keys are **bold**. Foreign keys are prefixed with `#`.

```
USER    ( **id**, email, password, created_at )

FILE    ( **id**, original_name, storage_path, mime_type, size,
          token, password_hash, expires_at, uploaded_at, #user_id )

TAG     ( **id**, name, #file_id )
```

---

## Table Definitions

### `users`

| Column       | Type           | Constraints                        |
|--------------|----------------|------------------------------------|
| `id`         | SERIAL         | PRIMARY KEY                        |
| `email`      | VARCHAR(255)   | NOT NULL, UNIQUE                   |
| `password`   | VARCHAR(255)   | NOT NULL                           |
| `created_at` | TIMESTAMP      | NOT NULL, DEFAULT NOW()            |

---

### `files`

| Column          | Type         | Constraints                                             |
|-----------------|--------------|---------------------------------------------------------|
| `id`            | SERIAL       | PRIMARY KEY                                             |
| `original_name` | VARCHAR(255) | NOT NULL                                                |
| `storage_path`  | VARCHAR(500) | NOT NULL                                                |
| `mime_type`     | VARCHAR(100) | NOT NULL                                                |
| `size`          | BIGINT       | NOT NULL, CHECK (size > 0 AND size <= 1073741824)       |
| `token`         | VARCHAR(36)  | NOT NULL, UNIQUE                                        |
| `password_hash` | VARCHAR(255) | NULL                                                    |
| `expires_at`    | TIMESTAMP    | NOT NULL                                                |
| `uploaded_at`   | TIMESTAMP    | NOT NULL, DEFAULT NOW()                                 |
| `user_id`       | INTEGER      | NULL, FK → users(id) ON DELETE SET NULL                 |

---

### `tags`

| Column    | Type        | Constraints                                  |
|-----------|-------------|----------------------------------------------|
| `id`      | SERIAL      | PRIMARY KEY                                  |
| `name`    | VARCHAR(30) | NOT NULL                                     |
| `file_id` | INTEGER     | NOT NULL, FK → files(id) ON DELETE CASCADE   |

**Additional constraint:** `UNIQUE (file_id, name)` — no duplicate tag name per file.

---

## Foreign Keys

| Table   | Column    | References      | On Delete    |
|---------|-----------|-----------------|--------------|
| `files` | `user_id` | `users(id)`     | SET NULL     |
| `tags`  | `file_id` | `files(id)`     | CASCADE      |

**Why SET NULL on `files.user_id`?**
If a user account is deleted, their files should remain accessible via their token (the recipient still has the link). The file becomes ownerless but is not lost. A background purge can later clean up ownerless files if needed.

**Why CASCADE on `tags.file_id`?**
Tags have no meaning without their file. When a file is deleted (manually or by the cron purge), all its tags must be removed automatically.

---

## Indexes

| Table   | Index                          | Purpose                                      |
|---------|--------------------------------|----------------------------------------------|
| `users` | UNIQUE on `email`              | Fast login lookup, uniqueness enforcement    |
| `files` | UNIQUE on `token`              | Fast download link resolution                |
| `files` | INDEX on `expires_at`          | Efficient daily cron purge query             |
| `files` | INDEX on `user_id`             | Fast history fetch per user                  |
| `tags`  | UNIQUE on `(file_id, name)`    | No-duplicate enforcement, fast tag filtering |

---

## Integrity Rules Summary

| Rule | Enforced by |
|------|-------------|
| Email is unique per user | UNIQUE constraint on `users.email` |
| Download token is unguessable | Application generates UUID v4 via Symfony UID |
| Download token is unique | UNIQUE constraint on `files.token` |
| File size ≤ 1 GB | CHECK constraint on `files.size` + API validation |
| Tag name ≤ 30 chars | VARCHAR(30) + API validation |
| No duplicate tag per file | UNIQUE constraint on `(file_id, name)` |
| Expired files are purged | Daily cron deletes rows WHERE `expires_at < NOW()` |
| Tags deleted with their file | ON DELETE CASCADE on `tags.file_id` |
| Anonymous file survives user deletion | ON DELETE SET NULL on `files.user_id` |
