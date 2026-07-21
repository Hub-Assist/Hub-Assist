# Quick Start Guide - New Features

This guide provides quick instructions to get started with the three new features implemented in the Hub-Assist backend.

## Prerequisites

- Node.js 18+
- PostgreSQL database
- JWT token for authentication
- Authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.) for TOTP testing

## Setup

### 1. Run Database Migration

```bash
npm run typeorm migration:run
```

This adds the TOTP columns to the users table:

- `totpEnabled` (boolean)
- `totpSecret` (varchar)
- `backupCodes` (text)

### 2. Start the Backend

```bash
npm run start:dev
```

The server will start on `http://localhost:3000`

### 3. Access API Documentation

Open your browser and navigate to:

```
http://localhost:3000/api/docs
```

All endpoints are documented with request/response schemas.

---

## Feature 1: Admin Attendance Records Endpoint

### Quick Test

1. **Get all attendance records**:

```bash
curl -X GET "http://localhost:3000/v1/attendance/all?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Filter by user**:

```bash
curl -X GET "http://localhost:3000/v1/attendance/all?userId=user-id&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. **Filter by date range**:

```bash
curl -X GET "http://localhost:3000/v1/attendance/all?startDate=2026-05-01&endDate=2026-05-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

4. **Filter by action**:

```bash
curl -X GET "http://localhost:3000/v1/attendance/all?action=clock_in" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Requirements

- User must have `ADMIN` role
- Requires valid JWT token
- Supports pagination with `page` and `limit` parameters

---

## Feature 2: Global Exception Filter

### How It Works

The exception filter automatically:

- Catches all unhandled errors
- Logs errors appropriately
- Returns standardized error responses
- Hides stack traces in production

### Example Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid request",
  "timestamp": "2026-05-31T10:00:00.000Z",
  "path": "/v1/attendance/all",
  "requestId": "req-uuid"
}
```

### Testing

1. **Test with invalid endpoint**:

```bash
curl -X GET "http://localhost:3000/v1/invalid-endpoint" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Test with invalid data**:

```bash
curl -X POST "http://localhost:3000/v1/attendance/clock-in" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

### Features

- Automatic error logging
- Request ID tracking
- Standardized response format
- Production-safe error messages

---

## Feature 3: TOTP Two-Factor Authentication

### Setup Flow

#### Step 1: Generate TOTP Secret

```bash
curl -X POST "http://localhost:3000/v1/auth/totp/setup" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response**:

```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "qrCodeUri": "otpauth://totp/HubAssist:user@example.com?secret=...",
    "manualEntryKey": "JBSWY3DPEBLW64TMMQ======"
  }
}
```

#### Step 2: Scan QR Code

1. Open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)
2. Scan the QR code from the response
3. The app will generate 6-digit codes

#### Step 3: Enable TOTP

Get a 6-digit code from your authenticator app and enable TOTP:

```bash
curl -X POST "http://localhost:3000/v1/auth/totp/enable" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "TOTP enabled successfully. Save your backup codes in a secure location.",
    "backupCodes": ["ABC123XY", "DEF456UV", "GHI789ST", ...]
  }
}
```

**Important**: Save the backup codes in a secure location!

### Verify TOTP Code

```bash
curl -X POST "http://localhost:3000/v1/auth/totp/verify" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "654321"}'
```

### Check TOTP Status

```bash
curl -X GET "http://localhost:3000/v1/auth/totp/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response**:

```json
{
  "success": true,
  "data": {
    "totpEnabled": true
  }
}
```

### Disable TOTP

```bash
curl -X POST "http://localhost:3000/v1/auth/totp/disable" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

### Testing with Different Authenticator Apps

All major authenticator apps are supported:

- **Google Authenticator** (iOS, Android)
- **Microsoft Authenticator** (iOS, Android)
- **Authy** (iOS, Android, Desktop)
- **FreeOTP** (iOS, Android)
- **1Password** (iOS, Android, Desktop)

### Time Window Tolerance

The implementation allows for ±1 time window (±30 seconds) to account for:

- Clock skew between devices
- Network latency
- User input delay

This means a code is valid for approximately 90 seconds.

---

## Common Issues & Solutions

### Issue: "TOTP is already enabled for this account"

**Solution**: Disable TOTP first before setting up a new one.

```bash
curl -X POST "http://localhost:3000/v1/auth/totp/disable" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

### Issue: "Invalid TOTP code"

**Possible causes**:

1. Code has expired (codes are valid for ~30 seconds)
2. Clock skew between server and client
3. Wrong secret used

**Solution**:

- Get a fresh code from your authenticator app
- Ensure server and client clocks are synchronized
- Verify the secret was correctly scanned

### Issue: "User not found"

**Solution**: Ensure the JWT token is valid and the user exists in the database.

### Issue: "Unauthorized" (401)

**Solution**: Include a valid JWT token in the Authorization header:

```bash
-H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## API Documentation

For complete API documentation, visit:

```
http://localhost:3000/api/docs
```

All endpoints are documented with:

- Request/response schemas
- Example requests and responses
- Authentication requirements
- Error codes and messages

---

## Database Schema

### Users Table Changes

```sql
-- New columns added
ALTER TABLE users ADD COLUMN totpEnabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN totpSecret VARCHAR(255) NULLABLE;
ALTER TABLE users ADD COLUMN backupCodes TEXT NULLABLE;
```

### Attendance Table (No changes)

The attendance table remains unchanged. The new admin endpoint uses existing data.

---

## Environment Variables

No new environment variables are required. The implementation uses existing configuration:

- `JWT_SECRET` - For JWT token validation
- `NODE_ENV` - For error handling (development vs production)
- `DATABASE_URL` - For database connection

---

## Performance Considerations

### Attendance Records Endpoint

- Uses pagination to handle large datasets
- Supports filtering for efficient queries
- Recommended page size: 20-50 records

### TOTP Verification

- Time window tolerance: ±1 (±30 seconds)
- Verification is fast (< 10ms)
- No database queries required for verification

### Exception Filter

- Minimal overhead
- Automatic error logging
- No performance impact

---

## Security Best Practices

1. **TOTP Setup**:
   - Always use HTTPS in production
   - Store backup codes securely
   - Don't share QR codes or secrets

2. **Attendance Records**:
   - Only admins can access all records
   - User data is included for audit trail
   - Consider implementing audit logging

3. **Exception Handling**:
   - Stack traces hidden in production
   - Sensitive information not exposed
   - Request IDs for tracing

---

## Next Steps

1. **Integrate TOTP into Login Flow**: Modify the login endpoint to require TOTP verification if enabled
2. **Implement Backup Code Management**: Add endpoints to regenerate backup codes
3. **Add Audit Logging**: Log all TOTP and attendance operations
4. **Implement Rate Limiting**: Add rate limiting to TOTP verification endpoints
5. **Add Admin Override**: Allow admins to reset TOTP for users

---

## Support

For detailed documentation, see:

- `IMPLEMENTATION_SUMMARY.md` - Overview of all three features
- `TOTP_2FA_IMPLEMENTATION.md` - Detailed TOTP implementation guide
- Swagger API documentation at `/api/docs`

---

## Troubleshooting

### Check Logs

```bash
# View application logs
npm run start:dev

# Look for error messages and request IDs
```

### Verify Database Migration

```bash
# Check if migration ran successfully
npm run typeorm migration:show

# Run migrations if needed
npm run typeorm migration:run
```

### Test Endpoints

Use the provided curl commands or Postman to test endpoints:

1. Verify JWT token is valid
2. Check user has required role (admin for attendance)
3. Verify database connection
4. Check error messages in response

---

## Additional Resources

- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [OWASP 2FA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
