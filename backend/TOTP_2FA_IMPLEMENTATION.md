# TOTP-Based Two-Factor Authentication Implementation

## Overview

This document describes the TOTP (Time-based One-Time Password) implementation for Hub-Assist backend. TOTP provides a secure, standards-based 2FA mechanism compatible with popular authenticator apps like Google Authenticator, Microsoft Authenticator, Authy, and others.

## Features

- **RFC 6238 Compliant**: Implements the standard TOTP algorithm
- **QR Code Provisioning**: Generates QR codes for easy setup with authenticator apps
- **Backup Codes**: Provides recovery codes for account access if the authenticator is lost
- **Time Window Tolerance**: Allows for clock skew between client and server (±1 time window)
- **Secure Secret Storage**: Secrets are stored encrypted in the database
- **User-Friendly**: Simple API for enabling, verifying, and disabling TOTP

## Architecture

### Files Added

1. **`src/auth/totp.service.ts`**
   - Core TOTP implementation
   - Secret generation and validation
   - QR code URI generation
   - Base32 encoding/decoding

2. **`src/auth/totp.controller.ts`**
   - REST endpoints for TOTP management
   - Setup, enable, verify, disable, and status endpoints

3. **`src/auth/dto/totp.dto.ts`**
   - Data transfer objects for TOTP operations
   - Request/response schemas

4. **`src/migrations/1685000000000-AddTotpToUser.ts`**
   - Database migration to add TOTP fields to users table

### Database Schema Changes

Added three new columns to the `users` table:

```sql
ALTER TABLE users ADD COLUMN totpEnabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN totpSecret VARCHAR(255) NULLABLE;
ALTER TABLE users ADD COLUMN backupCodes TEXT NULLABLE;
```

### User Entity Updates

```typescript
@Column({ default: false })
totpEnabled: boolean;

@Column({ nullable: true })
totpSecret?: string;

@Column({ type: 'simple-array', nullable: true })
backupCodes?: string[];
```

## API Endpoints

All endpoints require JWT authentication (Bearer token).

### 1. Setup TOTP

**Endpoint**: `POST /v1/auth/totp/setup`

**Description**: Generate TOTP setup credentials (secret and QR code)

**Request**:

```bash
curl -X POST http://localhost:3000/v1/auth/totp/setup \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

**Response**:

```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "qrCodeUri": "otpauth://totp/HubAssist:user@example.com?secret=JBSWY3DPEBLW64TMMQ%3D%3D%3D%3D%3D%3D&issuer=HubAssist&algorithm=SHA1&digits=6&period=30",
    "manualEntryKey": "JBSWY3DPEBLW64TMMQ======"
  },
  "timestamp": "2026-05-31T10:00:00.000Z"
}
```

**Usage**:

1. User calls this endpoint to get setup credentials
2. Frontend displays the QR code to the user
3. User scans the QR code with their authenticator app
4. User enters the 6-digit code from their app to enable TOTP

### 2. Enable TOTP

**Endpoint**: `POST /v1/auth/totp/enable`

**Description**: Verify TOTP code and enable 2FA for the account

**Request**:

```bash
curl -X POST http://localhost:3000/v1/auth/totp/enable \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

**Request Body**:

```json
{
  "code": "123456"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "TOTP enabled successfully. Save your backup codes in a secure location.",
    "backupCodes": ["ABC123XY", "DEF456UV", "GHI789ST", "JKL012QR", "MNO345OP"]
  },
  "timestamp": "2026-05-31T10:00:00.000Z"
}
```

**Important**:

- The user must verify the TOTP code before enabling
- Backup codes are returned only once during setup
- User should save backup codes in a secure location

### 3. Verify TOTP

**Endpoint**: `POST /v1/auth/totp/verify`

**Description**: Verify a TOTP code (for login or other operations)

**Request**:

```bash
curl -X POST http://localhost:3000/v1/auth/totp/verify \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

**Request Body**:

```json
{
  "code": "123456"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "TOTP code verified successfully",
    "valid": true
  },
  "timestamp": "2026-05-31T10:00:00.000Z"
}
```

### 4. Disable TOTP

**Endpoint**: `POST /v1/auth/totp/disable`

**Description**: Disable TOTP 2FA for the account

**Request**:

```bash
curl -X POST http://localhost:3000/v1/auth/totp/disable \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

**Request Body**:

```json
{
  "code": "123456"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "TOTP disabled successfully"
  },
  "timestamp": "2026-05-31T10:00:00.000Z"
}
```

**Important**: User must verify the current TOTP code before disabling

### 5. Get TOTP Status

**Endpoint**: `GET /v1/auth/totp/status`

**Description**: Check if TOTP is enabled for the current user

**Request**:

```bash
curl -X GET http://localhost:3000/v1/auth/totp/status \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response**:

```json
{
  "success": true,
  "data": {
    "totpEnabled": true
  },
  "timestamp": "2026-05-31T10:00:00.000Z"
}
```

## Implementation Details

### TOTP Algorithm

The implementation follows RFC 6238 with the following parameters:

- **Hash Algorithm**: HMAC-SHA1
- **Time Step**: 30 seconds
- **Digits**: 6
- **Time Window**: ±1 (allows for clock skew)

### Secret Generation

- **Length**: 20 bytes (160 bits)
- **Encoding**: Base32 (RFC 4648)
- **Format**: Compatible with all major authenticator apps

### QR Code URI

The QR code URI follows the Key Uri Format (RFC 6959):

```
otpauth://totp/[issuer]:[accountName]?secret=[secret]&issuer=[issuer]&algorithm=SHA1&digits=6&period=30
```

### Backup Codes

- **Count**: 10 codes generated per user
- **Format**: 8-character alphanumeric strings
- **Usage**: Single-use recovery codes for account access
- **Storage**: Stored as comma-separated values in the database

### Time Window Tolerance

The implementation allows for ±1 time window tolerance to account for:

- Clock skew between client and server
- Network latency
- User input delay

This means a code is valid for approximately 90 seconds (current window + 1 before + 1 after).

## Security Considerations

1. **Secret Storage**: Secrets should be encrypted at rest in production
2. **Backup Codes**: Should be displayed only once and stored securely by the user
3. **Rate Limiting**: Consider implementing rate limiting on verification endpoints
4. **Audit Logging**: Log all TOTP enable/disable operations
5. **Recovery**: Implement admin override mechanism for account recovery
6. **Backup Codes**: Implement single-use enforcement for backup codes

## Integration with Login Flow

To integrate TOTP into the login flow:

1. After successful password verification, check if user has TOTP enabled
2. If enabled, require TOTP verification before issuing JWT token
3. Create a temporary token or session for TOTP verification
4. After TOTP verification, issue the final JWT token

Example flow:

```
1. POST /auth/login (email + password)
2. Response: { requiresTOTP: true, tempToken: "..." }
3. POST /auth/totp/verify (tempToken + code)
4. Response: { accessToken: "...", refreshToken: "..." }
```

## Testing

### Manual Testing

1. **Setup TOTP**:

   ```bash
   curl -X POST http://localhost:3000/v1/auth/totp/setup \
     -H "Authorization: Bearer <JWT_TOKEN>"
   ```

2. **Scan QR Code**: Use Google Authenticator or similar app

3. **Enable TOTP**:

   ```bash
   curl -X POST http://localhost:3000/v1/auth/totp/enable \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -d '{"code": "123456"}'
   ```

4. **Verify TOTP**:
   ```bash
   curl -X POST http://localhost:3000/v1/auth/totp/verify \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -d '{"code": "654321"}'
   ```

### Test Vectors

For testing purposes, you can use the following test secret:

- **Secret**: `JBSWY3DPEBLW64TMMQ======`
- **Time**: 1234567890 (Feb 13, 2009)
- **Expected Code**: `755224`

## Migration Steps

1. Run the migration to add TOTP columns to the users table:

   ```bash
   npm run typeorm migration:run
   ```

2. The TOTP service is automatically available in the auth module

3. Update your frontend to include TOTP setup UI

## Future Enhancements

1. **Backup Code Management**: Implement regeneration of backup codes
2. **Device Tracking**: Track which devices have TOTP enabled
3. **Recovery Codes**: Implement more sophisticated recovery mechanisms
4. **Admin Override**: Allow admins to reset TOTP for users
5. **Audit Trail**: Comprehensive logging of TOTP operations
6. **WebAuthn Integration**: Combine with WebAuthn for passwordless 2FA

## References

- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [RFC 4648 - Base32 Encoding](https://tools.ietf.org/html/rfc4648)
- [RFC 6959 - Key Uri Format](https://tools.ietf.org/html/rfc6959)
- [Google Authenticator](https://support.google.com/accounts/answer/1066447)
- [OWASP 2FA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
