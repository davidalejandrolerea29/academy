# Zoom Video SDK Integration Guide

## Overview

This application now uses **Zoom Video SDK** instead of native WebRTC for video conferencing. This provides better reliability, scalability, and access to Zoom's advanced features.

## Architecture

### Core Components

1. **ZoomTokenService** (`src/services/ZoomTokenService.ts`)
   - Handles JWT token generation via backend API
   - Manages session creation and termination

2. **ZoomVideoSDKService** (`src/services/ZoomVideoSDKService.ts`)
   - Wrapper around Zoom Video SDK
   - Provides simplified API for video/audio/screen sharing

3. **useZoomVideo Hook** (`src/hooks/useZoomVideo.ts`)
   - React hook for managing Zoom sessions
   - Handles participant state and events
   - Replaces the old `useWebRTC` hook

4. **ZoomVideoCanvas** (`src/components/VideoRoom/ZoomVideoCanvas.tsx`)
   - Component for rendering video streams
   - Uses HTML5 Canvas for video display

## Backend Requirements

Your backend needs to implement these endpoints:

### 1. Generate JWT Token
```
POST /api/zoom/generate-token
```

**Request Body:**
```json
{
  "sessionName": "room-123",
  "role": 0
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "sessionName": "room-123"
}
```

**Implementation Example (Node.js):**
```javascript
const KJUR = require('jsrsasign');

app.post('/api/zoom/generate-token', (req, res) => {
  const { sessionName, role } = req.body;
  
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 2; // 2 hours
  
  const oHeader = { alg: 'HS256', typ: 'JWT' };
  const oPayload = {
    app_key: process.env.ZOOM_SDK_KEY,
    iat,
    exp,
    tpc: sessionName,
    role_type: role,
  };
  
  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const token = KJUR.jws.JWS.sign(
    'HS256',
    sHeader,
    sPayload,
    process.env.ZOOM_SDK_SECRET
  );
  
  res.json({ token, sessionName });
});
```

### 2. Create Session (Optional)
```
POST /api/zoom/create-session
```

**Request Body:**
```json
{
  "sessionName": "room-123",
  "sessionPasscode": "optional-passcode"
}
```

### 3. End Session (Optional)
```
POST /api/zoom/end-session
```

**Request Body:**
```json
{
  "sessionId": "session-id"
}
```

## Environment Variables

Add these to your `.env` file:

```env
# Frontend (.env)
VITE_ZOOM_SDK_KEY=your_sdk_key_here

# Backend (.env)
ZOOM_SDK_KEY=your_sdk_key_here
ZOOM_SDK_SECRET=your_sdk_secret_here
```

## Getting Zoom SDK Credentials

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Sign in with your Zoom account
3. Click "Develop" → "Build App"
4. Select "Video SDK"
5. Fill in app details
6. Get your SDK Key and SDK Secret from the "App Credentials" tab

## Usage Example

```tsx
import { useZoomVideo } from '../hooks/useZoomVideo';
import ZoomVideoCanvas from '../components/VideoRoom/ZoomVideoCanvas';

function VideoRoom({ roomId }) {
  const { currentUser } = useAuth();
  
  const {
    isInSession,
    participants,
    localUserId,
    isVideoOn,
    isAudioOn,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
  } = useZoomVideo({
    roomId,
    currentUser,
    onParticipantJoined: (name) => console.log(`${name} joined`),
    onParticipantLeft: (name) => console.log(`${name} left`),
  });

  return (
    <div>
      {/* Local video */}
      {localUserId && (
        <ZoomVideoCanvas userId={localUserId} />
      )}
      
      {/* Remote participants */}
      {Array.from(participants.values()).map((participant) => (
        <ZoomVideoCanvas 
          key={participant.userId}
          userId={participant.userId}
        />
      ))}
      
      {/* Controls */}
      <button onClick={toggleVideo}>
        {isVideoOn ? 'Stop Video' : 'Start Video'}
      </button>
      <button onClick={toggleAudio}>
        {isAudioOn ? 'Mute' : 'Unmute'}
      </button>
      <button onClick={startScreenShare}>
        Share Screen
      </button>
    </div>
  );
}
```

## Migration from WebRTC

The old WebRTC implementation has been **disabled but not deleted**. Files are preserved for reference:

- `src/hooks/useWebRTC.ts` - Old WebRTC hook (commented out)
- `src/types/webrtc.ts` - Old WebRTC types (kept for reference)

### Key Differences

| Feature | WebRTC (Old) | Zoom SDK (New) |
|---------|--------------|----------------|
| Video Rendering | `<video>` element | `<canvas>` element |
| Signaling | Laravel Reverb | Zoom's infrastructure |
| TURN Servers | Self-managed | Zoom-managed |
| Max Participants | ~50 (depends on TURN) | 1,000 |
| Screen Sharing | `getDisplayMedia()` | Zoom SDK API |
| Chat | Reverb WebSocket | Can use Reverb or Zoom SDK |

## Chat Integration

You can continue using Laravel Reverb for chat functionality. The `ReverbWebSocketService` is still active and can be used alongside Zoom SDK for messaging.

## Troubleshooting

### "Failed to initialize Zoom SDK"
- Check that `VITE_ZOOM_SDK_KEY` is set correctly
- Verify your SDK credentials are valid
- Check browser console for detailed errors

### "Failed to join session"
- Verify backend is generating valid JWT tokens
- Check token expiration time
- Ensure `sessionName` matches between frontend and backend

### Video not rendering
- Zoom SDK uses Canvas, not `<video>` elements
- Make sure you're using `ZoomVideoCanvas` component
- Check that participant has video enabled

### Audio issues
- Call `startAudio()` after joining session
- Check browser permissions for microphone
- Verify audio is not muted in Zoom SDK

## Performance Optimization

1. **Video Quality**: Adjust based on network conditions
   ```tsx
   <ZoomVideoCanvas 
     userId={userId}
     quality={VideoQuality.Video_720P} // or Video_360P, Video_180P
   />
   ```

2. **Canvas Size**: Match canvas dimensions to display size
   ```tsx
   <ZoomVideoCanvas 
     userId={userId}
     width={1280}
     height={720}
   />
   ```

3. **Participant Limit**: For large sessions, consider pagination or gallery view

## Resources

- [Zoom Video SDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- [Zoom Video SDK Web Reference](https://marketplacefront.zoom.us/sdk/custom/web/)
- [Sample Apps](https://github.com/zoom/videosdk-web-sample)
