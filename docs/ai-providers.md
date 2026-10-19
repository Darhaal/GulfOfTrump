# AI providers

The game master is a language model behind one small interface
([`src/server/llm.ts`](../src/server/llm.ts)): `complete()` returns text,
`completeJson()` parses and validates it against a zod schema with one repair
round. Alpha 0.1.0 ships one real provider — ChatGPT — and an offline mock.

## ChatGPT — Sign in with ChatGPT

OpenAI's [Sign in with ChatGPT](https://developers.openai.com/siwc) lets a user
connect their ChatGPT account to an app and, with explicit consent, let the app
spend their **ChatGPT plan** on the Responses API — no API key, no separate
billing. At launch OpenAI offers plan usage to **open-source projects and
personal projects that run locally**; paid or remotely hosted apps go through
an [interest form](https://openai.com/form/sign-in-with-chatgpt-interest/).

Gulf of Trump is open source and runs on the player's machine, which is the
case the program describes. Consequences:

- **Run it locally.** `npm run dev` binds to `127.0.0.1`. Each player signs in
  with their own account; usage counts against their own plan.
- **Do not host one copy for other people** on your plan — that is neither what
  OpenAI's terms cover nor what the server allows (it answers loopback only).
- **Limits are your plan's.** When they run out the API returns
  `subscription_sharing_usage_limit_exceeded`; the game says so. Usage and
  per-app caps: ChatGPT → Settings → Usage.

### How the client works

[`src/server/chatgpt/oauth.ts`](../src/server/chatgpt/oauth.ts) implements the
published protocol (it does not include OpenAI's DevKit code, which is under a
noncommercial licence):

1. Discovery at `https://auth.openai.com/.well-known/openid-configuration`;
   every endpoint must stay on that origin.
2. A one-shot HTTP listener on `127.0.0.1:<random port>/auth/callback`, fresh
   `state`, `nonce` and PKCE verifier.
3. The authorization URL asks for `openid profile email offline_access
   resource.invoke chatgpt.tokens.use.direct` with
   `resource=https://api.openai.com/v1`. The first sign-in uses
   `client_id=dynamic_agent_client` with `agent_name_hint=Gulf of Trump`; the
   callback returns the issued `client_id`, which is saved before the code is
   exchanged so a failed exchange does not register a second app.
4. Code exchange with the verifier; the ID token is verified (issuer,
   audience, nonce, RS256 via the published JWKS).
5. The game counts plan usage as granted only if the token response includes
   `chatgpt.tokens.use.direct`.
6. Access tokens are refreshed two minutes before expiry, one refresh at a
   time; a refreshed identity must be the same account.
7. Sign-out revokes the refresh token and deletes the local copy.

[`src/server/chatgpt/responses.ts`](../src/server/chatgpt/responses.ts) calls
`POST /v1/responses` with `store: false`, `stream: true`, system guidance in
`instructions` (the route rejects system-role messages), no sampling
parameters, and treats an answer as complete only on `response.completed`.
Models come from `GET /v1/models` (`models[]` with `visibility: "list"`); the
player can pick one in Settings, or the first listed is used.

## Claude — not in 0.1.0

Since early 2026 Anthropic's terms limit Claude Pro/Max subscription OAuth to
Claude Code and claude.ai, explicitly excluding third-party apps and the
Agent SDK, and enforce it server-side. Wiring a Claude subscription into this
game would break those terms, so it is not offered. The legitimate route is an
**Anthropic API key** (pay-as-you-go via the Claude Console); adding it as a
second provider is not done yet.

## Offline mock

`GOT_MOCK_AI=1` replaces the game master with
[`src/server/mock.ts`](../src/server/mock.ts): instant, deterministic, changes
almost nothing. For interface work and tests, not for playing.

## Adding a provider

Implement `complete(request)` for it in `src/server/llm.ts` (text in, text
out, honour `signal` and call `onDelta` while streaming), expose its
connection state through `/api/ai/status`, and keep its credentials in the
encrypted store. Everything above `complete()` — prompts, validation, the
engine — stays as it is.
