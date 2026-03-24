# FindMe API Documentation

## Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

### Error Response
```json
{
  "error": {
    "message": "Error description",
    "stack": "Stack trace (development only)"
  }
}
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phone": "+1234567890"
}

Response 201:
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response 200:
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

#### Update FCM Token
```http
PUT /auth/fcm-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "fcmToken": "firebase-token"
}

Response 200:
{
  "success": true,
  "message": "FCM token updated"
}
```

### Items

#### Create Item
```http
POST /items
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
- type: "lost" | "found"
- title: string
- description: string
- category: "electronics" | "documents" | "pets" | "accessories" | "clothing" | "keys" | "bags" | "other"
- date: ISO8601 date string
- location: JSON string {"address": "..."}
- image: file (optional)
- audio: file (optional)

Response 201:
{
  "success": true,
  "item": {
    "_id": "item-id",
    "user": "user-id",
    "type": "lost",
    "title": "Lost iPhone",
    "description": "Black iPhone 13 Pro",
    "category": "electronics",
    "date": "2024-01-15T10:00:00Z",
    "location": {
      "address": "Central Park, NY",
    },
    "imageUrl": "https://cloudinary.com/...",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Get All Items
```http
GET /items?type=lost&category=electronics&status=active
Authorization: Bearer <token>

Query Parameters:
- type: "lost" | "found" (optional)
- category: string (optional)
- status: "active" | "matched" | "resolved" | "expired" (optional)

Response 200:
{
  "success": true,
  "count": 10,
  "items": [...]
}
```

#### Get My Items
```http
GET /items/my-items
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "count": 5,
  "items": [...]
}
```

#### Get Single Item
```http
GET /items/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "item": {
    "_id": "item-id",
    "user": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "type": "lost",
    "title": "Lost iPhone",
    ...
  }
}
```

#### Update Item
```http
PUT /items/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "status": "resolved"
}

Response 200:
{
  "success": true,
  "item": {...}
}
```

#### Delete Item
```http
DELETE /items/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "message": "Item deleted"
}
```

### Matches

#### Get My Matches
```http
GET /matches
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "matches": [
    {
      "_id": "match-id",
      "lostItem": {...},
      "foundItem": {...},
      "lostUser": {...},
      "foundUser": {...},
      "matchScore": 0.85,
      "matchType": "image",
      "chatRoomId": "uuid",
      "status": "pending",
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

#### Get Single Match
```http
GET /matches/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "match": {
    "_id": "match-id",
    "lostItem": {...},
    "foundItem": {...},
    "lostUser": {...},
    "foundUser": {...},
    "matchScore": 0.85,
    "matchType": "image",
    "chatRoomId": "uuid",
    "status": "pending"
  }
}
```

### Chat

#### Get Chat Messages
```http
GET /chat/:chatRoomId/messages
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "messages": [
    {
      "_id": "message-id",
      "chatRoomId": "uuid",
      "sender": {
        "_id": "user-id",
        "name": "John Doe"
      },
      "content": "Hello!",
      "type": "text",
      "readBy": ["user-id"],
      "createdAt": "2024-01-15T11:05:00Z"
    }
  ]
}
```

#### Mark Messages as Read
```http
POST /chat/:chatRoomId/read
Authorization: Bearer <token>

Response 200:
{
  "success": true
}
```

### Notifications

#### Get My Notifications
```http
GET /notifications
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "notifications": [
    {
      "_id": "notification-id",
      "user": "user-id",
      "type": "match",
      "title": "Match Found!",
      "message": "We found a potential match for your lost item!",
      "link": "/chat/uuid",
      "data": {
        "matchId": "match-id",
        "chatRoomId": "uuid"
      },
      "read": false,
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

#### Mark Notification as Read
```http
PUT /notifications/:id/read
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "notification": {...}
}
```

#### Mark All as Read
```http
PUT /notifications/read-all
Authorization: Bearer <token>

Response 200:
{
  "success": true
}
```

## AI Service API

### Generate Image Embedding
```http
POST http://localhost:5001/embed
Content-Type: application/json

{
  "image_url": "https://cloudinary.com/..."
}

Response 200:
{
  "success": true,
  "embedding": [0.123, -0.456, ...],
  "dimension": 512
}
```

### Generate Text Embedding
```http
POST http://localhost:5001/embed-text
Content-Type: application/json

{
  "text": "Black iPhone 13 Pro with cracked screen"
}

Response 200:
{
  "success": true,
  "embedding": [0.123, -0.456, ...],
  "dimension": 512
}
```

### Find Matches
```http
POST http://localhost:5001/match
Content-Type: application/json

{
  "query_embedding": [0.123, -0.456, ...],
  "candidate_embeddings": [
    {
      "id": "item-1",
      "embedding": [0.234, -0.567, ...]
    },
    {
      "id": "item-2",
      "embedding": [0.345, -0.678, ...]
    }
  ],
  "threshold": 0.78
}

Response 200:
{
  "success": true,
  "matches": [
    {
      "index": 0,
      "id": "item-1",
      "similarity": 0.85
    }
  ]
}
```

### Transcribe Audio
```http
POST http://localhost:5001/transcribe
Content-Type: application/json

{
  "audio_url": "https://cloudinary.com/..."
}

Response 200:
{
  "success": true,
  "transcript": "I lost my black iPhone 13 Pro at Central Park"
}
```

## WebSocket Events (Socket.io)

### Connection
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'jwt-token' }
});
```

### Events

#### Join Room
```javascript
socket.emit('join-room', { chatRoomId: 'uuid' });

socket.on('joined-room', ({ chatRoomId }) => {
  console.log('Joined room:', chatRoomId);
});
```

#### Send Message
```javascript
socket.emit('send-message', {
  chatRoomId: 'uuid',
  content: 'Hello!'
});

socket.on('new-message', (message) => {
  console.log('New message:', message);
});
```

#### Typing Indicators
```javascript
socket.emit('typing', { chatRoomId: 'uuid' });
socket.emit('stop-typing', { chatRoomId: 'uuid' });

socket.on('user-typing', ({ userId, userName }) => {
  console.log(`${userName} is typing...`);
});

socket.on('user-stop-typing', ({ userId }) => {
  console.log('User stopped typing');
});
```

#### Mark as Read
```javascript
socket.emit('mark-read', { chatRoomId: 'uuid' });

socket.on('messages-read', ({ userId }) => {
  console.log('Messages read by:', userId);
});
```

#### Error Handling
```javascript
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
});
```

## Rate Limits

- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per 15 minutes

## Error Codes

- 400: Bad Request (validation error)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error
