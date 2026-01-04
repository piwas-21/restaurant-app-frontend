# Google OAuth Multi-Platform Configuration Update

## Overview
Updated the backend to support Google OAuth authentication from multiple platforms: Web, Android, and iOS.

## Changes Made

### 1. Backend Code Changes

#### Updated Files:
- [`GoogleLoginCommandHandler.cs`](file:///Users/mahmutkaya/workspace/rumi-restaurant/backend/RestaurantSystem.Api/Features/Auth/Commands/LoginCommand/GoogleLoginCommandHandler.cs)
- [`app-secrets.json`](file:///Users/mahmutkaya/workspace/rumi-restaurant/backend/RestaurantSystem.Api/app-secrets.json)

#### What Changed:
The Google token validation now accepts tokens from three different client IDs:

```csharp
Audience = new List<string>() 
{ 
    _configuration["Authentication:Google:ClientId"]!,          // Web
    _configuration["Authentication:Google:AndroidClientId"]!,   // Android
    _configuration["Authentication:Google:IosClientId"]!        // iOS
}
```

### 2. Configuration Values

#### Local Development (`app-secrets.json`):
```json
"Authentication": {
  "Google": {
    "ClientId": "102252528656-3quqh29v8b7psntuo04r7duambcs1i0t.apps.googleusercontent.com",
    "ClientSecret": "<your-client-secret>",
    "AndroidClientId": "102252528656-3l24ct9qqgrds6ugqf25rule07bg77md.apps.googleusercontent.com",
    "IosClientId": "102252528656-h2jf66f6ftikb8rdc7q263ml945fsrtm.apps.googleusercontent.com"
  }
}
```

---

## 🚨 ACTION REQUIRED: DevOps Team

### AWS Secrets Manager Update

**Secret Name:** The existing Google authentication secret in AWS Secrets Manager

**Add the following keys:**

```json
{
  "clientId": "102252528656-3quqh29v8b7psntuo04r7duambcs1i0t.apps.googleusercontent.com",
  "clientSecret": "<your-client-secret>",
  "androidClientId": "102252528656-3l24ct9qqgrds6ugqf25rule07bg77md.apps.googleusercontent.com",
  "iosClientId": "102252528656-h2jf66f6ftikb8rdc7q263ml945fsrtm.apps.googleusercontent.com"
}
```

### Environment Configuration Mapping

Ensure the following environment variables are mapped from AWS Secrets:

```
Authentication__Google__ClientId         → clientId
Authentication__Google__ClientSecret     → clientSecret
Authentication__Google__AndroidClientId  → androidClientId
Authentication__Google__IosClientId      → iosClientId
```

---

## Verification Steps

After deployment:

1. **Test Web Login:** Users should still be able to log in via the web app
2. **Test Android Login:** Users should be able to log in via the Android app
3. **Test iOS Login:** Users should be able to log in via the iOS app

All three platforms should authenticate successfully and create/access the same user accounts based on email.

---

## Technical Details

### How It Works

1. User initiates Google Sign-In on any platform (Web/Android/iOS)
2. Google issues an ID token with the platform-specific client ID as the "audience"
3. Client sends the ID token to backend `/api/auth/google-login` endpoint
4. Backend validates the token using Google's JWT verification library
5. Backend checks if token audience matches ANY of the configured client IDs
6. If valid, user is authenticated and receives backend access tokens

### Why Multiple Client IDs Are Needed

Each platform (Web, Android, iOS) requires its own Google OAuth client ID:
- **Web Client ID:** Used by the Next.js frontend
- **Android Client ID:** Used by the native Android app
- **iOS Client ID:** Used by the native iOS app

Google issues tokens with different audience claims based on which client initiated the sign-in, so the backend must accept all three.

---

## Related Files Modified

- Backend: [`GoogleLoginCommandHandler.cs`](file:///Users/mahmutkaya/workspace/rumi-restaurant/backend/RestaurantSystem.Api/Features/Auth/Commands/LoginCommand/GoogleLoginCommandHandler.cs)
- Config: [`app-secrets.json`](file:///Users/mahmutkaya/workspace/rumi-restaurant/backend/RestaurantSystem.Api/app-secrets.json)

---

**Contact:** Mobile Dev Team → Backend Team → DevOps Team
**Priority:** High (blocks mobile app Google authentication)
**Date:** 2025-12-25
