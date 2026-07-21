# Attendance Summary API

## Endpoint

```
GET /api/v1/attendance/summary
```

Requires: `Authorization: Bearer <admin-token>`

---

## Query Parameters

| Parameter   | Type   | Required | Default        | Description |
|-------------|--------|----------|----------------|-------------|
| `timezone`  | string | No       | `UTC`          | IANA timezone name. Controls how UTC timestamps are bucketed into calendar days/weeks/months. Must be a valid IANA zone (validated against the full Luxon IANA database). |
| `period`    | string | No       | `daily`        | Aggregation granularity. One of: `daily`, `weekly`, `monthly`. |
| `startDate` | string | No       | 30 days ago    | ISO 8601 datetime. Start of the reporting window (inclusive). |
| `endDate`   | string | No       | now            | ISO 8601 datetime. End of the reporting window (inclusive). |

### Timezone validation

The `timezone` parameter is validated against the full IANA tz database via Luxon's `IANAZone.isValidZone()`. Invalid values return `400 Bad Request`.

Examples of valid values: `UTC`, `America/New_York`, `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`.

---

## Response Schema

```json
{
  "timezone": "America/New_York",
  "period": "daily",
  "startDate": "2026-05-01T00:00:00.000-04:00",
  "endDate": "2026-05-31T23:59:59.000-04:00",
  "totalSessions": 42,
  "totalDurationSeconds": 1209600,
  "avgDurationSeconds": 28800,
  "peakArrivalHour": 9,
  "peakDepartureHour": 17,
  "buckets": [
    {
      "bucket": "2026-05-01",
      "sessions": 3,
      "totalDurationSeconds": 86400,
      "avgDurationSeconds": 28800,
      "anomalies": {
        "short": 0,
        "long": 0
      }
    }
  ],
  "anomalies": [
    {
      "sessionId": "uuid",
      "userId": "uuid",
      "clockInUtc": "2026-05-15T09:00:00.000Z",
      "clockOutUtc": "2026-05-15T09:02:00.000Z",
      "durationSeconds": 120,
      "anomaly": "short"
    }
  ]
}
```

### Top-level fields

| Field                  | Type          | Description |
|------------------------|---------------|-------------|
| `timezone`             | string        | The timezone used for bucketing |
| `period`               | string        | `daily` / `weekly` / `monthly` |
| `startDate`            | ISO 8601      | Effective start of the window |
| `endDate`              | ISO 8601      | Effective end of the window |
| `totalSessions`        | number        | Count of completed sessions in the window |
| `totalDurationSeconds` | number        | Sum of all session durations |
| `avgDurationSeconds`   | number        | Mean session duration |
| `peakArrivalHour`      | number / null | Most common clock-in hour (0–23) in the requested timezone. `null` if no sessions. |
| `peakDepartureHour`    | number / null | Most common clock-out hour (0–23) in the requested timezone. `null` if no sessions. |
| `buckets`              | array         | Per-period aggregation entries, sorted chronologically |
| `anomalies`            | array         | All sessions flagged as anomalous |

### Bucket fields

| Field                  | Type   | Description |
|------------------------|--------|-------------|
| `bucket`               | string | Period key — see formats below |
| `sessions`             | number | Session count in this period |
| `totalDurationSeconds` | number | Sum of durations |
| `avgDurationSeconds`   | number | Mean duration |
| `anomalies.short`      | number | Sessions under 5 minutes |
| `anomalies.long`       | number | Sessions over 14 hours |

#### Bucket key formats

| Period    | Format       | Example      |
|-----------|--------------|--------------|
| `daily`   | `YYYY-MM-DD` | `2026-05-30` |
| `weekly`  | `YYYY-Www`   | `2026-W22`   |
| `monthly` | `YYYY-MM`    | `2026-05`    |

Weekly buckets use ISO week numbering (Monday = start of week).

### Anomaly session fields

| Field             | Type   | Description |
|-------------------|--------|-------------|
| `sessionId`       | uuid   | Session identifier |
| `userId`          | uuid   | User who owns the session |
| `clockInUtc`      | ISO 8601 | Clock-in time in UTC |
| `clockOutUtc`     | ISO 8601 | Clock-out time in UTC |
| `durationSeconds` | number | Session length in seconds |
| `anomaly`         | string | `"short"` (< 5 min) or `"long"` (> 14 h) |

---

## Anomaly Detection

| Flag     | Condition              | Threshold |
|----------|------------------------|-----------|
| `short`  | `durationSeconds < 300`  | < 5 minutes |
| `long`   | `durationSeconds > 50400` | > 14 hours |

Sessions at exactly the threshold are **not** flagged.

---

## Timezone-Aware Bucketing

All timestamps are stored in UTC in the database. When computing which calendar day/week/month a session belongs to, the clock-in timestamp is converted to the requested timezone using Luxon before the bucket key is derived.

### Example — midnight boundary

A clock-in at `2026-05-30T23:50:00Z` with `timezone=America/New_York` (UTC-4 in May):

- UTC date: **May 30**
- New York local time: **18:50 on May 30** → bucket `2026-05-30` ✅

The same event with `timezone=UTC` would also bucket into `2026-05-30`.

A clock-in at `2026-05-31T03:00:00Z` with `timezone=America/New_York`:

- UTC date: **May 31**
- New York local time: **22:00 on May 30** → bucket `2026-05-30` ✅

### DST handling

Luxon handles DST transitions automatically:

- **Spring-forward (23-hour day)**: The missing hour is skipped; sessions are counted once in the correct local day.
- **Fall-back (25-hour day)**: The repeated hour is disambiguated by wall-clock offset; sessions are counted once each.

---

## Error Responses

| Status | Condition |
|--------|-----------|
| `400`  | `timezone` is not a valid IANA zone name |
| `400`  | `startDate` or `endDate` is not a valid ISO 8601 string |
| `401`  | Missing or invalid JWT |
| `403`  | Authenticated user is not an admin |
