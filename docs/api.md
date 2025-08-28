# DiziPush API Documentation

Complete API reference for the DiziPush push notification platform.

## 🚀 Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:8000/api
```

## 🔐 Authentication

DiziPush uses Bearer token authentication with JWT tokens.

### Authentication Header
```http
Authorization: Bearer <your-api-key>
```

### API Key Scopes
- `read` - Read access to resources
- `write` - Create and update resources  
- `admin` - Full access including deletion
- `analytics` - Access to analytics data
- `webhooks` - Manage webhooks

## 📊 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

## 🔗 Endpoints

### Authentication

#### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Projects

#### GET /projects
List all projects for the authenticated user.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search by name

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_123",
        "name": "My Website",
        "slug": "my-website",
        "plan": "GROWTH",
        "domains": [
          {
            "id": "dom_123",
            "hostname": "example.com",
            "verified": true
          }
        ],
        "stats": {
          "subscribers": 1250,
          "campaigns": 45,
          "deliveryRate": 94.2
        },
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "pages": 1
    }
  }
}
```

#### POST /projects
Create a new project.

**Request Body:**
```json
{
  "name": "My New Project",
  "plan": "STARTER"
}
```

#### GET /projects/:projectId
Get project details.

#### PUT /projects/:projectId
Update project settings.

#### DELETE /projects/:projectId
Delete project (requires admin scope).

---

### Subscribers

#### GET /projects/:projectId/subscribers
List project subscribers.

**Query Parameters:**
- `page`, `limit` - Pagination
- `status` - Filter by status (`ACTIVE`, `SOFT_FAIL`, `HARD_FAIL`, `UNSUBSCRIBED`)
- `country` - Filter by country code
- `device` - Filter by device type
- `tags` - Filter by tags (comma-separated)
- `lastSeen` - Filter by last seen date (ISO string)
- `search` - Search in browser, OS, or location

**Response:**
```json
{
  "success": true,
  "data": {
    "subscribers": [
      {
        "id": "sub_123",
        "endpoint": "https://fcm.googleapis.com/fcm/send/...",
        "browser": "Chrome",
        "browserVersion": "120.0.0",
        "os": "Windows",
        "device": "Desktop",
        "country": "US",
        "region": "California",
        "city": "San Francisco",
        "timezone": "America/Los_Angeles",
        "locale": "en-US",
        "tags": ["premium", "newsletter"],
        "status": "ACTIVE",
        "firstSeen": "2024-01-01T00:00:00Z",
        "lastSeen": "2024-01-15T10:00:00Z",
        "pageViews": 127
      }
    ],
    "pagination": { /* ... */ },
    "stats": {
      "total": 1250,
      "active": 1180,
      "unsubscribed": 70,
      "byStatus": {
        "ACTIVE": 1180,
        "SOFT_FAIL": 15,
        "HARD_FAIL": 5,
        "UNSUBSCRIBED": 50
      }
    }
  }
}
```

#### POST /projects/:projectId/subscribers
Create or update subscriber.

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "p256dh": "BKD...",
  "auth": "abc123...",
  "browser": "Chrome",
  "os": "Windows",
  "device": "Desktop",
  "country": "US",
  "timezone": "America/Los_Angeles",
  "locale": "en-US",
  "tags": ["premium"],
  "metadata": {
    "source": "homepage",
    "campaign": "winter2024"
  }
}
```

#### DELETE /projects/:projectId/subscribers/:subscriberId
Unsubscribe a subscriber.

#### POST /projects/:projectId/subscribers/:subscriberId/tags
Add tags to subscriber.

**Request Body:**
```json
{
  "tags": ["vip", "early-access"]
}
```

#### DELETE /projects/:projectId/subscribers/:subscriberId/tags
Remove tags from subscriber.

---

### Segments

#### GET /projects/:projectId/segments
List segments with subscriber counts.

**Response:**
```json
{
  "success": true,
  "data": {
    "segments": [
      {
        "id": "seg_123",
        "name": "Active Desktop Users",
        "description": "Users who visited in last 7 days on desktop",
        "definition": {
          "operator": "AND",
          "rules": [
            {
              "field": "device.type",
              "operator": "IN",
              "values": ["DESKTOP"]
            },
            {
              "field": "last_seen_days_ago",
              "operator": "<=",
              "value": 7
            }
          ]
        },
        "subscriberCount": 450,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### POST /projects/:projectId/segments
Create a new segment.

**Request Body:**
```json
{
  "name": "Mobile Users in US",
  "definition": {
    "operator": "AND",
    "rules": [
      {
        "field": "device.type",
        "operator": "IN",
        "values": ["MOBILE"]
      },
      {
        "field": "geo.country",
        "operator": "=",
        "value": "US"
      }
    ]
  }
}
```

#### GET /projects/:projectId/segments/:segmentId/preview
Preview subscribers matching the segment (first 100).

---

### Campaigns

#### GET /projects/:projectId/campaigns
List campaigns with stats.

**Query Parameters:**
- `status` - Filter by status
- `type` - Filter by type (`INSTANT`, `SCHEDULED`, `RECURRING`, `TRIGGERED`)
- `dateFrom`, `dateTo` - Date range filter

**Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "camp_123",
        "name": "Weekend Sale",
        "type": "INSTANT",
        "status": "SENT",
        "payload": {
          "title": "🎉 Weekend Sale - 50% Off!",
          "body": "Limited time offer on all products",
          "icon": "https://example.com/icon.png",
          "url": "https://example.com/sale?utm_source=push"
        },
        "stats": {
          "sent": 1180,
          "delivered": 1098,
          "clicked": 156,
          "clickRate": 14.2,
          "deliveryRate": 93.1
        },
        "createdAt": "2024-01-15T10:00:00Z",
        "sentAt": "2024-01-15T10:05:00Z"
      }
    ]
  }
}
```

#### POST /projects/:projectId/campaigns
Create a new campaign.

**Request Body:**
```json
{
  "name": "New Product Launch",
  "type": "INSTANT",
  "segmentId": "seg_123",
  "payload": {
    "title": "🚀 New Feature Available!",
    "body": "Check out our latest update",
    "icon": "https://example.com/icon.png",
    "image": "https://example.com/hero.jpg",
    "url": "https://example.com/features?utm_source=push",
    "actions": [
      {
        "action": "view",
        "title": "View Now"
      },
      {
        "action": "later",
        "title": "Remind Later"
      }
    ],
    "requireInteraction": true,
    "tag": "feature-announcement"
  },
  "schedule": {
    "type": "immediate"
  }
}
```

**Scheduled Campaign:**
```json
{
  "schedule": {
    "type": "scheduled",
    "scheduledAt": "2024-01-20T15:00:00Z"
  }
}
```

**Recurring Campaign:**
```json
{
  "schedule": {
    "type": "recurring",
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "endDate": "2024-12-31T23:59:59Z"
  }
}
```

#### POST /projects/:projectId/campaigns/:campaignId/send
Send a campaign immediately (if draft or scheduled).

#### GET /projects/:projectId/campaigns/:campaignId/stats
Get detailed campaign statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "sent": 1180,
      "delivered": 1098,
      "failed": 82,
      "clicked": 156,
      "clickRate": 14.2,
      "deliveryRate": 93.1
    },
    "timeline": [
      {
        "timestamp": "2024-01-15T10:00:00Z",
        "sent": 200,
        "delivered": 185
      }
    ],
    "byDevice": {
      "desktop": { "sent": 650, "clicked": 98 },
      "mobile": { "sent": 480, "clicked": 52 },
      "tablet": { "sent": 50, "clicked": 6 }
    },
    "byLocation": {
      "US": { "sent": 820, "clicked": 124 },
      "CA": { "sent": 180, "clicked": 18 },
      "UK": { "sent": 180, "clicked": 14 }
    },
    "errors": [
      {
        "code": "410",
        "message": "Gone - subscription expired",
        "count": 45
      }
    ]
  }
}
```

---

### Analytics

#### GET /projects/:projectId/analytics/overview
Get overview analytics for specified time range.

**Query Parameters:**
- `range` - Time range (`24h`, `7d`, `30d`, `90d`, or `custom`)
- `dateFrom`, `dateTo` - Custom date range (ISO strings)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalSubscribers": 1250,
      "activeSubscribers": 1180,
      "campaignsSent": 12,
      "totalSends": 14160,
      "avgDeliveryRate": 93.2,
      "avgClickRate": 8.5,
      "growth": {
        "subscribers": 5.2,
        "deliveryRate": 1.8,
        "clickRate": -0.3
      }
    },
    "charts": {
      "subscribersOverTime": [
        {
          "date": "2024-01-01",
          "subscribers": 1100,
          "newSubscribers": 25,
          "unsubscribers": 5
        }
      ],
      "campaignPerformance": [
        {
          "date": "2024-01-15",
          "sent": 1180,
          "delivered": 1098,
          "clicked": 156
        }
      ]
    }
  }
}
```

#### GET /projects/:projectId/analytics/campaigns
Campaign performance analytics.

#### GET /projects/:projectId/analytics/subscribers
Subscriber analytics and segmentation data.

#### GET /projects/:projectId/analytics/export
Export analytics data.

**Query Parameters:**
- `type` - Export type (`subscribers`, `campaigns`, `events`)
- `format` - Export format (`csv`, `json`)
- `dateFrom`, `dateTo` - Date range

---

### Imports/Exports

#### POST /projects/:projectId/imports
Import subscribers from file.

**Request:** Multipart form data
- `file` - CSV or JSON file
- `type` - Import type (`subscribers`)

**Response:**
```json
{
  "success": true,
  "data": {
    "importId": "imp_123",
    "status": "PROCESSING",
    "filename": "subscribers.csv",
    "totalRecords": 1500
  }
}
```

#### GET /projects/:projectId/imports/:importId
Get import status and results.

#### GET /projects/:projectId/exports
List export jobs.

#### POST /projects/:projectId/exports
Create export job.

---

### Webhooks

#### GET /projects/:projectId/webhooks
List configured webhooks.

#### POST /projects/:projectId/webhooks
Create webhook.

**Request Body:**
```json
{
  "name": "Campaign Events",
  "url": "https://your-app.com/webhooks/dizipush",
  "events": ["campaign.sent", "campaign.delivered", "subscriber.clicked"],
  "secret": "your-webhook-secret"
}
```

#### PUT /projects/:projectId/webhooks/:webhookId
Update webhook.

#### DELETE /projects/:projectId/webhooks/:webhookId
Delete webhook.

---

### Testing

#### POST /projects/:projectId/test-push
Send test notification.

**Request Body:**
```json
{
  "subscriberId": "sub_123",
  "payload": {
    "title": "Test Notification",
    "body": "This is a test",
    "url": "https://example.com"
  }
}
```

---

## 📤 Webhook Events

DiziPush can send webhooks for various events:

### Event Types
- `subscriber.created` - New subscriber added
- `subscriber.unsubscribed` - Subscriber unsubscribed
- `campaign.sent` - Campaign sending started
- `campaign.completed` - Campaign sending completed
- `campaign.delivered` - Individual notification delivered
- `campaign.clicked` - Notification clicked
- `campaign.failed` - Campaign sending failed

### Webhook Payload
```json
{
  "event": "campaign.delivered",
  "timestamp": "2024-01-15T10:30:00Z",
  "projectId": "proj_123",
  "data": {
    "campaignId": "camp_123",
    "subscriberId": "sub_123",
    "deliveredAt": "2024-01-15T10:30:00Z"
  }
}
```

### Webhook Security
Webhooks are signed with HMAC-SHA256:
```
X-Dizipush-Signature: sha256=<signature>
```

Verify signature:
```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return signature === `sha256=${expectedSignature}`
}
```

---

## 🚫 Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `QUOTA_EXCEEDED` | Plan limits exceeded |
| `PUSH_DELIVERY_ERROR` | Push notification delivery failed |
| `INTERNAL_ERROR` | Internal server error |

---

## 📊 Rate Limits

| Endpoint Category | Rate Limit |
|------------------|------------|
| Authentication | 5 requests/minute |
| General API | 1000 requests/hour |
| Push Sending | 100 campaigns/hour |
| File Uploads | 10 uploads/hour |
| Analytics | 200 requests/hour |

Rate limit headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

---

## 🔧 SDKs and Libraries

### Official SDKs
- **JavaScript/TypeScript:** `@dizipush/js-sdk`
- **PHP:** `dizipush/php-sdk`
- **Python:** `dizipush-python`
- **Node.js:** `@dizipush/node-sdk`

### Example Usage (JavaScript)
```javascript
import DiziPush from '@dizipush/js-sdk'

const client = new DiziPush({
  apiKey: 'your-api-key',
  projectId: 'proj_123'
})

// Send campaign
const campaign = await client.campaigns.create({
  name: 'Flash Sale',
  payload: {
    title: 'Flash Sale - 50% Off!',
    body: 'Limited time offer',
    url: 'https://example.com/sale'
  },
  segmentId: 'seg_123'
})
```

---

## 📚 OpenAPI Specification

Complete OpenAPI 3.0 specification available at:
```
GET /api/docs/openapi.json
```

Interactive documentation at:
```
GET /api/docs
```