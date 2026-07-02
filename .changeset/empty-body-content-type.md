---
"@idevconn/api-client": patch
---

Fix: don't set `Content-Type: application/json` when a request has no body. Previously this was set on every request without an explicit `Content-Type`, including bodyless calls like `api('/items/1', { method: 'DELETE' })`. Strict JSON body parsers (e.g. Fastify's default) reject `Content-Type: application/json` on an empty body with a 400, which broke every bodyless DELETE for consumers of this client.
