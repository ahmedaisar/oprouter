# User and API flows

## Account and workspace
1. Visitor opens `/login` and signs in/up through Supabase Auth.
2. Auth callback establishes the server-side session.
3. Authenticated user lands on `/` and can view models, playground, activity and settings.

## API key creation and revocation
1. Signed-in user submits a key name, optional model allowlist and monthly token cap in Settings.
2. Server creates cryptographically random `opk_live_` secret, stores only SHA-256 hash and short prefix.
3. Raw secret is displayed once. It cannot be retrieved later.
4. User can list metadata and revoke only keys owned by their account.

## Gateway request
1. Caller sends `Authorization: Bearer opk_live_...` and an OpenAI-style JSON body.
2. Server resolves the prefix and verifies the hash, active state and ownership.
3. Server consumes a persistent per-key rate-limit slot; rejected requests return 429 with Retry-After.
4. Server validates body/model and checks the key's model allowlist.
5. If a monthly cap applies, server atomically reserves estimated prompt + max output tokens.
6. Server forwards request to OpenRouter using server-side provider credentials.
7. Non-stream response is returned as JSON; stream response is forwarded as SSE.
8. Usage metadata is persisted; reservation is finalized/released on terminal paths.

## Failure handling
- Missing/invalid/revoked key: 401; no provider request.
- Invalid body: 400; disallowed model: 403.
- Rate limit or monthly quota exceeded: 429.
- Rate-limit/quota database dependency failure: 503 (fail closed).
- Provider failure: provider status or 502 for invalid upstream response.
- Upstream timeout before headers: 504; after SSE begins: terminal SSE timeout error and stream close (pending review).
- Client disconnect: cancel upstream reader and release uncommitted reservation.