# Fix audit session-end load failure

## Goal
Stop the app from calling the intermittently failing `audit-session-end` worker while preserving reliable audit-session closure.

## Changes
- Extend the stable authenticated `audit-track` endpoint to accept a session-end request and close only the signed-in user's matching session.
- Route normal sign-out/session shutdown through `audit-track`.
- Route page-unload delivery through `audit-track` with authenticated keepalive delivery, and remove all client calls to `audit-session-end`.
- Deploy the updated endpoint and verify CORS, authentication, loading, and the app build.

## Safety
- No Finance or FIBU LIGHT behavior or data changes.
- No historical audit data changes.
- Session ownership remains validated server-side.
