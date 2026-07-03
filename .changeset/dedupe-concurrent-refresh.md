---
"@idevconn/api-client": patch
---

Fix: deduplicate concurrent token refreshes. Previously, if multiple requests hit a 401 around the same time (e.g. several in-flight queries when the access token expires), each one independently called the refresh endpoint. Backends that rotate refresh tokens (invalidate the old one on each use) would reject every refresh attempt after the first, causing `onUnauthorized()` to fire and the user to be logged out even though the token refresh actually succeeded moments earlier. Concurrent 401s now share a single in-flight refresh call and all resolve against the same result.
