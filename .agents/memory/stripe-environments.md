---
name: Stripe environment constraints
description: Connection boundaries and environment-specific Stripe integration behavior.
---

Agent access to a live Stripe account does not mean the website runtime is connected to it. The website integration was provisioned as a separate sandbox. Connect the live account through Publishing before enabling real sales; never infer live readiness from a successful agent-side Stripe query.

**Why:** The existing live Stripe MCP connection and newly connected website API integration resolved to different accounts. Both were valid, but only the sandbox authenticated website requests during development.

**How to apply:** Check account identity, live-mode prices and payment capability separately in production. Use sandbox checkout for testing; do not submit live test charges. Consult current Replit docs for Publishing's managed Stripe connection rather than combining manual API keys with the managed connector.

The current connectors integration uses authenticated proxy transport rather than exposing a secret key. Stripe sync supports a public Stripe-client property, allowing sync operations to share that proxy without extracting credentials.

**Why:** Generic Stripe setup examples expecting directly available API keys describe a different integration path.

**How to apply:** Follow the connected integration's own skill for runtime authentication instead of substituting older credential-fetch examples.

Stripe API and sync behavior must be verified against installed versions: the installed API rejects the former payment-method-types checkout parameter, and synced JSON null is not necessarily SQL NULL. Incremental product backfill follows creation time and can miss edits to older product metadata.

**Why:** These behaviors caused valid products or checkout requests to be rejected during integration.

**How to apply:** Use current Stripe API capabilities, distinguish price modes using their explicit type, and explicitly resync modified existing entities rather than relying only on incremental backfill.
