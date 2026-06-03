# DataShare — API Interface Contract

## General

| Property       | Value                              |
|----------------|------------------------------------|
| Base URL       | `/api/v1`                          |
| Data format    | JSON (except file upload/download) |
| Upload format  | `multipart/form-data`              |
| Auth scheme    | JWT Bearer (`Authorization: Bearer <token>`) |

### Authentication

Endpoints marked **[AUTH]** require a valid JWT token in the `Authorization` header.  
Endpoints marked **[PUBLIC]** are open to everyone.  
Endpoints marked **[ANON ONLY]** are restricted to unauthenticated users.

---

### Error Response Format

All errors return a consistent JSON body:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| HTTP Status | When |
|-------------|------|
| `400` | Invalid input / validation failure |
| `401` | Missing or invalid JWT |
| `403` | Authenticated but not the resource owner |
| `404` | Resource not found or expired |
| `409` | Conflict (e.g. duplicate email, duplicate tag) |
| `413` | File exceeds 1 GB |
| `422` | Forbidden file type |

---

## Endpoints

---

### Auth

#### `POST /auth/register` [PUBLIC]

Create a new user account.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "mysecretpassword"
}
```

| Field      | Type   | Rules                    |
|------------|--------|--------------------------|
| `email`    | string | valid format, unique     |
| `password` | string | min 8 characters         |

**Response `201 Created`**
```json
{
  "id": 1,
  "email": "user@example.com",
  "created_at": "2024-06-03T10:00:00Z"
}
```

**Errors**

| Code | Error code        | Cause                  |
|------|-------------------|------------------------|
| 400  | `VALIDATION_ERROR`| Invalid email or password too short |
| 409  | `EMAIL_TAKEN`     | Email already registered |

---

#### `POST /auth/login` [PUBLIC]

Authenticate and receive a JWT token.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "mysecretpassword"
}
```

**Response `200 OK`**
```json
{
  "token": "eyJhbGciOiJSUzI1NiJ9...",
  "expires_in": 3600
}
```

**Errors**

| Code | Error code          | Cause                        |
|------|---------------------|------------------------------|
| 400  | `VALIDATION_ERROR`  | Missing or malformed fields  |
| 401  | `INVALID_CREDENTIALS` | Wrong email or password    |

---

### Files

#### `POST /files` [AUTH]

Upload a file as an authenticated user.

**Request** `multipart/form-data`

| Field            | Type    | Required | Rules                                  |
|------------------|---------|----------|----------------------------------------|
| `file`           | file    | yes      | max 1 GB, no forbidden types           |
| `expires_in_days`| integer | no       | 1–7, default `7`                       |
| `password`       | string  | no       | min 6 characters                       |
| `tags[]`         | string  | no       | each max 30 chars, no duplicates       |

**Response `201 Created`**
```json
{
  "id": 42,
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "original_name": "report.pdf",
  "mime_type": "application/pdf",
  "size": 204800,
  "expires_at": "2024-06-10T10:00:00Z",
  "uploaded_at": "2024-06-03T10:00:00Z",
  "password_protected": false,
  "download_url": "/api/v1/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download",
  "tags": ["invoice", "2024"]
}
```

**Errors**

| Code | Error code           | Cause                          |
|------|----------------------|--------------------------------|
| 400  | `VALIDATION_ERROR`   | Invalid field value            |
| 401  | `UNAUTHORIZED`       | Missing or invalid JWT         |
| 413  | `FILE_TOO_LARGE`     | File exceeds 1 GB              |
| 422  | `FORBIDDEN_FILE_TYPE`| File extension not allowed     |

---

#### `POST /files/anonymous` [ANON ONLY]

Upload a file without an account.

**Request** `multipart/form-data`

| Field             | Type    | Required | Rules                            |
|-------------------|---------|----------|----------------------------------|
| `file`            | file    | yes      | max 1 GB, no forbidden types     |
| `expires_in_days` | integer | no       | 1–7, default `7`                 |
| `password`        | string  | no       | min 6 characters                 |

**Response `201 Created`**
```json
{
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "original_name": "photo.jpg",
  "mime_type": "image/jpeg",
  "size": 102400,
  "expires_at": "2024-06-10T10:00:00Z",
  "uploaded_at": "2024-06-03T10:00:00Z",
  "password_protected": true,
  "download_url": "/api/v1/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download"
}
```

**Errors** — same as `POST /files` except `401` does not apply.

---

#### `GET /files/{token}` [PUBLIC]

Get file metadata before downloading. Lets the client show file info and prompt for password if needed.

**Path parameter:** `token` — the file's public UUID.

**Response `200 OK`**
```json
{
  "original_name": "report.pdf",
  "mime_type": "application/pdf",
  "size": 204800,
  "expires_at": "2024-06-10T10:00:00Z",
  "password_protected": false
}
```

**Errors**

| Code | Error code      | Cause                            |
|------|-----------------|----------------------------------|
| 404  | `FILE_NOT_FOUND`| Token unknown or file expired    |

---

#### `GET /files/{token}/download` [PUBLIC]

Download the file. Returns a binary stream.

**Path parameter:** `token` — the file's public UUID.

**Query parameter** _(only if file is password-protected)_

| Param      | Type   | Required  |
|------------|--------|-----------|
| `password` | string | if protected |

**Response `200 OK`**
```
Content-Type: <mime_type>
Content-Disposition: attachment; filename="<original_name>"

<binary stream>
```

**Errors**

| Code | Error code        | Cause                             |
|------|-------------------|-----------------------------------|
| 401  | `WRONG_PASSWORD`  | Incorrect file password           |
| 404  | `FILE_NOT_FOUND`  | Token unknown or file expired     |

---

#### `GET /files` [AUTH]

Get the authenticated user's upload history.

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": 42,
      "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "original_name": "report.pdf",
      "mime_type": "application/pdf",
      "size": 204800,
      "expires_at": "2024-06-10T10:00:00Z",
      "uploaded_at": "2024-06-03T10:00:00Z",
      "is_expired": false,
      "password_protected": false,
      "download_url": "/api/v1/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download",
      "tags": ["invoice", "2024"]
    }
  ]
}
```

**Errors**

| Code | Error code    | Cause                  |
|------|---------------|------------------------|
| 401  | `UNAUTHORIZED`| Missing or invalid JWT |

---

#### `DELETE /files/{id}` [AUTH]

Permanently delete a file and all its metadata.

**Path parameter:** `id` — the file's internal integer ID.

**Response `204 No Content`** — empty body.

**Errors**

| Code | Error code      | Cause                              |
|------|-----------------|------------------------------------|
| 401  | `UNAUTHORIZED`  | Missing or invalid JWT             |
| 403  | `FORBIDDEN`     | File belongs to another user       |
| 404  | `FILE_NOT_FOUND`| No file with this ID for this user |

---

### Tags

#### `POST /files/{id}/tags` [AUTH]

Add a tag to a file.

**Path parameter:** `id` — the file's internal ID.

**Request body**
```json
{
  "name": "invoice"
}
```

| Field  | Type   | Rules           |
|--------|--------|-----------------|
| `name` | string | max 30 chars    |

**Response `201 Created`**
```json
{
  "id": 7,
  "name": "invoice"
}
```

**Errors**

| Code | Error code       | Cause                                   |
|------|------------------|-----------------------------------------|
| 400  | `VALIDATION_ERROR` | Name empty or exceeds 30 chars        |
| 401  | `UNAUTHORIZED`   | Missing or invalid JWT                  |
| 403  | `FORBIDDEN`      | File belongs to another user            |
| 404  | `FILE_NOT_FOUND` | No file with this ID                    |
| 409  | `TAG_ALREADY_EXISTS` | This tag name already exists on the file |

---

#### `DELETE /files/{id}/tags/{tagId}` [AUTH]

Remove a tag from a file.

**Path parameters:** `id` — file ID, `tagId` — tag ID.

**Response `204 No Content`** — empty body.

**Errors**

| Code | Error code      | Cause                              |
|------|-----------------|------------------------------------|
| 401  | `UNAUTHORIZED`  | Missing or invalid JWT             |
| 403  | `FORBIDDEN`     | File belongs to another user       |
| 404  | `FILE_NOT_FOUND`| No file or tag with these IDs      |

---

## Endpoint Summary

| Method   | Path                              | Auth        | Description                  |
|----------|-----------------------------------|-------------|------------------------------|
| `POST`   | `/auth/register`                  | PUBLIC      | Create account               |
| `POST`   | `/auth/login`                     | PUBLIC      | Login, get JWT               |
| `POST`   | `/files`                          | AUTH        | Upload file (authenticated)  |
| `POST`   | `/files/anonymous`                | ANON ONLY   | Upload file (anonymous)      |
| `GET`    | `/files`                          | AUTH        | Get upload history           |
| `GET`    | `/files/{token}`                  | PUBLIC      | Get file metadata            |
| `GET`    | `/files/{token}/download`         | PUBLIC      | Download file                |
| `DELETE` | `/files/{id}`                     | AUTH        | Delete a file                |
| `POST`   | `/files/{id}/tags`                | AUTH        | Add a tag to a file          |
| `DELETE` | `/files/{id}/tags/{tagId}`        | AUTH        | Remove a tag from a file     |
