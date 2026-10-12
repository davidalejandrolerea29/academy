# Backend Implementation Guide for Zoom Video SDK

## Prerequisites

1. **Zoom SDK Credentials**
   - SDK Key (Client ID)
   - SDK Secret (Client Secret)
   - Get them from: https://marketplace.zoom.us/

2. **Required NPM Package**
   ```bash
   npm install jsrsasign
   ```

## Node.js/Express Implementation

### 1. Environment Variables

Create or update your `.env` file:

```env
ZOOM_SDK_KEY=your_sdk_key_here
ZOOM_SDK_SECRET=your_sdk_secret_here
```

### 2. JWT Token Generation Endpoint

Create `routes/zoom.js`:

```javascript
const express = require('express');
const router = express.Router();
const KJUR = require('jsrsasign');

// Middleware to verify authentication
const authMiddleware = require('../middleware/auth');

/**
 * Generate Zoom Video SDK JWT Token
 * POST /api/zoom/generate-token
 */
router.post('/generate-token', authMiddleware, (req, res) => {
  try {
    const { sessionName, role = 0 } = req.body;

    if (!sessionName) {
      return res.status(400).json({ 
        error: 'sessionName is required' 
      });
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2; // Token valid for 2 hours

    const oHeader = { alg: 'HS256', typ: 'JWT' };
    
    const oPayload = {
      app_key: process.env.ZOOM_SDK_KEY,
      iat: iat,
      exp: exp,
      tpc: sessionName, // Topic (session name)
      role_type: role,  // 0 = participant, 1 = host
      version: 1,
      user_identity: req.user.id.toString(), // From your auth middleware
    };

    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);
    
    const token = KJUR.jws.JWS.sign(
      'HS256',
      sHeader,
      sPayload,
      process.env.ZOOM_SDK_SECRET
    );

    res.json({
      token,
      sessionName,
    });

  } catch (error) {
    console.error('Error generating Zoom token:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      message: error.message 
    });
  }
});

/**
 * Create a new Zoom session (optional - for tracking)
 * POST /api/zoom/create-session
 */
router.post('/create-session', authMiddleware, async (req, res) => {
  try {
    const { sessionName, sessionPasscode } = req.body;

    // Store session in your database if needed
    // This is optional - Zoom SDK doesn't require pre-created sessions
    
    const session = {
      sessionId: `session-${Date.now()}`,
      sessionName,
      sessionPasscode,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    };

    // await db.sessions.create(session); // Your DB logic

    res.json(session);

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      error: 'Failed to create session',
      message: error.message 
    });
  }
});

/**
 * End a Zoom session (optional - for cleanup)
 * POST /api/zoom/end-session
 */
router.post('/end-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    // Update session status in your database
    // await db.sessions.update(sessionId, { status: 'ended' });

    res.json({ success: true });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ 
      error: 'Failed to end session',
      message: error.message 
    });
  }
});

module.exports = router;
```

### 3. Register Routes

In your main `app.js` or `server.js`:

```javascript
const zoomRoutes = require('./routes/zoom');

// ... other middleware ...

app.use('/api/zoom', zoomRoutes);
```

### 4. Authentication Middleware Example

If you don't have one, create `middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## Laravel Implementation

### 1. Environment Variables

Add to `.env`:

```env
ZOOM_SDK_KEY=your_sdk_key_here
ZOOM_SDK_SECRET=your_sdk_secret_here
```

### 2. Install JWT Package

```bash
composer require firebase/php-jwt
```

### 3. Create Controller

Create `app/Http/Controllers/ZoomController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Firebase\JWT\JWT;
use Carbon\Carbon;

class ZoomController extends Controller
{
    /**
     * Generate Zoom Video SDK JWT Token
     */
    public function generateToken(Request $request)
    {
        $request->validate([
            'sessionName' => 'required|string',
            'role' => 'sometimes|integer|in:0,1',
        ]);

        $sessionName = $request->input('sessionName');
        $role = $request->input('role', 0);

        $iat = time();
        $exp = $iat + (60 * 60 * 2); // 2 hours

        $payload = [
            'app_key' => env('ZOOM_SDK_KEY'),
            'iat' => $iat,
            'exp' => $exp,
            'tpc' => $sessionName,
            'role_type' => $role,
            'version' => 1,
            'user_identity' => auth()->id(),
        ];

        $token = JWT::encode(
            $payload,
            env('ZOOM_SDK_SECRET'),
            'HS256'
        );

        return response()->json([
            'token' => $token,
            'sessionName' => $sessionName,
        ]);
    }

    /**
     * Create a new session (optional)
     */
    public function createSession(Request $request)
    {
        $request->validate([
            'sessionName' => 'required|string',
            'sessionPasscode' => 'sometimes|string',
        ]);

        // Store in database if needed
        $session = [
            'sessionId' => 'session-' . time(),
            'sessionName' => $request->sessionName,
            'sessionPasscode' => $request->sessionPasscode,
            'createdBy' => auth()->id(),
            'createdAt' => Carbon::now()->toISOString(),
        ];

        return response()->json($session);
    }

    /**
     * End a session (optional)
     */
    public function endSession(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
        ]);

        // Update database if needed

        return response()->json(['success' => true]);
    }
}
```

### 4. Register Routes

In `routes/api.php`:

```php
use App\Http\Controllers\ZoomController;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/zoom/generate-token', [ZoomController::class, 'generateToken']);
    Route::post('/zoom/create-session', [ZoomController::class, 'createSession']);
    Route::post('/zoom/end-session', [ZoomController::class, 'endSession']);
});
```

## Testing the Backend

### Using cURL

```bash
# Generate token
curl -X POST http://localhost:8000/api/zoom/generate-token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionName": "test-room-123",
    "role": 0
  }'
```

### Expected Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "sessionName": "test-room-123"
}
```

## Security Considerations

1. **Never expose SDK Secret to frontend**
   - Always generate tokens on the backend
   - SDK Secret should only be in backend environment variables

2. **Token Expiration**
   - Set reasonable expiration times (1-2 hours)
   - Implement token refresh if needed

3. **Rate Limiting**
   - Add rate limiting to token generation endpoint
   - Prevent abuse

4. **Session Validation**
   - Validate that user has permission to join the session
   - Check if session exists and is active

## Troubleshooting

### "Invalid token" error
- Check that SDK Key and Secret are correct
- Verify token hasn't expired
- Ensure payload structure matches Zoom's requirements

### CORS issues
- Add proper CORS headers in backend
- Allow your frontend domain

### Token generation fails
- Verify `jsrsasign` (Node.js) or `firebase/php-jwt` (Laravel) is installed
- Check environment variables are loaded correctly

## Next Steps

1. Deploy backend with Zoom endpoints
2. Test token generation
3. Update frontend `.env` with `VITE_ZOOM_SDK_KEY`
4. Test full integration with VideoRoom component
