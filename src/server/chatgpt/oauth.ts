import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AiError, fromApiError } from "../errors";
import { clearConnection, hostId, loadClientId, loadConnection, saveClientId, saveConnection, type StoredConnection } from "./store";

/**
 * Sign in with ChatGPT, written against OpenAI's published protocol
 * (developers.openai.com/siwc): OpenID Connect with PKCE, a loopback redirect
 * on 127.0.0.1, dynamic client registration on the first sign-in, and the
 * `chatgpt.tokens.use.direct` scope that lets the access token spend the
 * user's ChatGPT plan on the Responses API.
 *
 * OpenAI offers plan usage to open-source projects that run on the user's
 * own machine — which is what this game is. A hosted copy serving other
 * people needs OpenAI's approval first (see docs/ai-providers.md).
 */

const ISSUER = "https://auth.openai.com";
export const API_BASE = "https://api.openai.com/v1";
const SCOPES = ["openid", "profile", "email", "offline_access", "resource.invoke", "chatgpt.tokens.use.direct"];
const PLAN_SCOPE = "chatgpt.tokens.use.direct";
const APP_NAME = "Gulf of Trump";
const CALLBACK_PATH = "/auth/callback";
const SIGN_IN_TIMEOUT_MS = 10 * 60_000;
/** Refresh this long before the access token actually expires. */
const REFRESH_MARGIN_MS = 2 * 60_000;

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  jwks_uri: string;
}

const random = () => randomBytes(32).toString("base64url");

/** Module state survives hot reloads in dev by living on globalThis. */
interface OAuthGlobals {
  discovery?: Promise<Discovery>;
  jwks?: ReturnType<typeof createRemoteJWKSet>;
  pending?: PendingSignIn;
  refreshing?: Promise<StoredConnection>;
  lastError?: { code: string; message: string };
}
const globals = ((globalThis as { __gotOAuth?: OAuthGlobals }).__gotOAuth ??= {});

async function discovery(): Promise<Discovery> {
  globals.discovery ??= (async () => {
    const response = await fetch(`${ISSUER}/.well-known/openid-configuration`, { redirect: "error" });
    const data = (await response.json().catch(() => null)) as Partial<Discovery> | null;
    const sameOrigin = (url: unknown) => typeof url === "string" && new URL(url).origin === ISSUER;
    if (
      !response.ok || !data || data.issuer !== ISSUER ||
      !sameOrigin(data.authorization_endpoint) || !sameOrigin(data.token_endpoint) || !sameOrigin(data.jwks_uri) ||
      (data.revocation_endpoint !== undefined && !sameOrigin(data.revocation_endpoint))
    ) {
      throw new AiError("discovery_failed", "Could not verify ChatGPT's sign-in configuration.", true);
    }
    return data as Discovery;
  })().catch((error) => {
    globals.discovery = undefined;
    throw error;
  });
  return globals.discovery;
}

async function verifyIdToken(idToken: string, clientId: string, nonce?: string) {
  const config = await discovery();
  globals.jwks ??= createRemoteJWKSet(new URL(config.jwks_uri));
  try {
    const { payload } = await jwtVerify(idToken, globals.jwks, {
      issuer: ISSUER,
      audience: clientId,
      algorithms: ["RS256"],
      clockTolerance: 5,
      requiredClaims: ["sub", "exp", "iat"],
    });
    if (nonce !== undefined && payload.nonce !== nonce) throw new Error("nonce");
    if (payload.azp !== undefined && payload.azp !== clientId) throw new Error("azp");
    return {
      subject: String(payload.sub),
      identity: {
        ...(typeof payload.name === "string" ? { name: payload.name } : {}),
        ...(typeof payload.email === "string" ? { email: payload.email } : {}),
      },
    };
  } catch {
    throw new AiError("invalid_id_token", "ChatGPT's identity could not be verified. Sign in again.");
  }
}

async function tokenRequest(params: Record<string, string>) {
  const config = await discovery();
  const response = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(params),
    redirect: "error",
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !data) throw fromApiError(data, response.status);
  return data;
}

function credentials(data: Record<string, unknown>, previousScopes?: string[]) {
  const scopes = typeof data.scope === "string" ? data.scope.split(/\s+/).filter(Boolean) : previousScopes;
  if (!scopes || typeof data.access_token !== "string" || typeof data.expires_in !== "number" || data.expires_in <= 0) {
    throw new AiError("invalid_token_response", "ChatGPT returned incomplete credentials. Sign in again.");
  }
  return {
    scopes,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    ...(typeof data.refresh_token === "string" && data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  };
}

interface PendingSignIn {
  server: Server;
  state: string;
  timer: NodeJS.Timeout;
}

function closePending() {
  const pending = globals.pending;
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.server.close();
  pending.server.closeAllConnections?.();
  globals.pending = undefined;
}

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Starts a sign-in: opens a one-shot listener on a free loopback port and
 * returns the authorization URL for the browser. When ChatGPT redirects back,
 * the listener finishes the exchange, stores the connection and sends the
 * browser on to `returnTo` (the game's settings page).
 */
export async function startSignIn(returnTo: string): Promise<{ authUrl: string }> {
  closePending();
  globals.lastError = undefined;
  const config = await discovery();
  const [savedClientId, host] = await Promise.all([loadClientId(), hostId()]);
  const state = random();
  const nonce = random();
  const verifier = random();
  const back = new URL(returnTo);

  const finish = (response: ServerResponse, result: "connected" | string) => {
    const target = new URL(back);
    if (result === "connected") target.searchParams.set("chatgpt", "connected");
    else target.searchParams.set("chatgpt", "error");
    response.writeHead(302, { location: target.toString(), "cache-control": "no-store", "referrer-policy": "no-referrer" });
    // Close the listener only after the redirect has left, or the browser
    // gets a reset connection instead of the way back.
    response.end(() => closePending());
  };

  let redirectUri = "";
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", redirectUri);
    if (request.method !== "GET" || url.pathname !== CALLBACK_PATH) {
      response.writeHead(404).end();
      return;
    }
    // Requests that do not carry this sign-in's state (a stray tab, a probe)
    // must not cancel the sign-in that is waiting.
    const returnedState = url.searchParams.get("state") ?? "";
    if (!sameSecret(returnedState, state)) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Sign-in state mismatch. Start again from the game.");
      return;
    }
    void (async () => {
      try {
        if (url.searchParams.has("error")) {
          throw new AiError(url.searchParams.get("error") ?? "access_denied", "Sign-in was cancelled or refused.");
        }
        const code = url.searchParams.get("code");
        const clientId = url.searchParams.get("client_id") ?? savedClientId;
        if (!code || !clientId || !/^[A-Za-z0-9_-]{1,200}$/.test(clientId) || clientId === "dynamic_agent_client") {
          throw new AiError("registration_incomplete", "ChatGPT did not finish registering the app. Try again.");
        }
        // Keep the issued client id before the one-time code is spent, so a
        // failed exchange does not register yet another app next time.
        await saveClientId(clientId);
        const data = await tokenRequest({
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          resource: API_BASE,
        });
        if (typeof data.id_token !== "string") throw new AiError("invalid_id_token", "ChatGPT returned no identity.");
        const identity = await verifyIdToken(data.id_token, clientId, nonce);
        await saveConnection({
          version: 1,
          clientId,
          ...identity,
          ...credentials(data),
          savedAt: new Date().toISOString(),
        });
        finish(response, "connected");
      } catch (error) {
        const e = error instanceof AiError ? error : new AiError("sign_in_failed", "Sign-in failed. Try again.", true);
        globals.lastError = { code: e.code, message: e.message };
        finish(response, e.code);
      }
    })();
  });
  server.requestTimeout = 15_000;

  await new Promise<void>((resolve, reject) => {
    server.once("error", () => reject(new AiError("callback_port_unavailable", "Could not open a local port for sign-in.")));
    server.listen({ host: "127.0.0.1", port: 0 }, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new AiError("callback_port_unavailable", "Could not open a local port for sign-in.");
  redirectUri = `http://127.0.0.1:${address.port}${CALLBACK_PATH}`;

  globals.pending = { server, state, timer: setTimeout(closePending, SIGN_IN_TIMEOUT_MS) };

  const authUrl = new URL(config.authorization_endpoint);
  authUrl.search = new URLSearchParams({
    client_id: savedClientId ?? "dynamic_agent_client",
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    resource: API_BASE,
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ext_agent_host_id: host,
    ...(savedClientId ? {} : { agent_name_hint: APP_NAME }),
  }).toString();
  return { authUrl: authUrl.toString() };
}

async function refresh(connection: StoredConnection): Promise<StoredConnection> {
  if (!connection.refreshToken) throw new AiError("invalid_grant", "Your ChatGPT connection has expired. Sign in again.");
  const data = await tokenRequest({
    grant_type: "refresh_token",
    client_id: connection.clientId,
    refresh_token: connection.refreshToken,
    resource: API_BASE,
  });
  let identity = { subject: connection.subject, identity: connection.identity };
  if (typeof data.id_token === "string") {
    identity = await verifyIdToken(data.id_token, connection.clientId);
    if (identity.subject !== connection.subject) {
      throw new AiError("account_mismatch", "The refreshed ChatGPT account does not match. Sign in again.");
    }
  }
  const updated: StoredConnection = {
    ...connection,
    ...identity,
    ...credentials(data, connection.scopes),
    // A refresh that does not rotate the refresh token keeps the old one.
    refreshToken: typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : connection.refreshToken,
    savedAt: new Date().toISOString(),
  };
  await saveConnection(updated);
  return updated;
}

/** A valid access token that may spend the ChatGPT plan, refreshed when due. */
export async function accessToken(): Promise<string> {
  const connection = await loadConnection();
  if (!connection) throw new AiError("not_connected", "Connect your ChatGPT account in Settings first.");
  if (!connection.scopes.includes(PLAN_SCOPE)) {
    throw new AiError("plan_not_shared", "This ChatGPT sign-in did not grant plan usage. Sign in again and allow it.");
  }
  if (connection.expiresAt - REFRESH_MARGIN_MS > Date.now()) return connection.accessToken;
  // One refresh at a time: a second request waits for the first.
  globals.refreshing ??= refresh(connection).finally(() => {
    globals.refreshing = undefined;
  });
  try {
    return (await globals.refreshing).accessToken;
  } catch (error) {
    if (error instanceof AiError && (error.code === "invalid_grant" || error.code === "account_mismatch")) {
      globals.lastError = { code: error.code, message: error.message };
    }
    throw error;
  }
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reauth_required";

export interface StatusReport {
  provider: "chatgpt";
  status: ConnectionStatus;
  sharing: boolean;
  identity?: { name?: string; email?: string };
  error?: { code: string; message: string };
}

export async function connectionStatus(): Promise<StatusReport> {
  const connection = await loadConnection();
  const error = globals.lastError;
  if (globals.pending) return { provider: "chatgpt", status: "connecting", sharing: false, ...(error ? { error } : {}) };
  if (!connection) return { provider: "chatgpt", status: "disconnected", sharing: false, ...(error ? { error } : {}) };
  const expired = error?.code === "invalid_grant" || error?.code === "account_mismatch";
  return {
    provider: "chatgpt",
    status: expired ? "reauth_required" : "connected",
    sharing: connection.scopes.includes(PLAN_SCOPE),
    identity: connection.identity,
    ...(error ? { error } : {}),
  };
}

/** Signs out: revokes the refresh token at OpenAI (best effort) and deletes the local copy. */
export async function disconnect(): Promise<{ revoked: boolean }> {
  closePending();
  globals.lastError = undefined;
  const connection = await loadConnection();
  await clearConnection();
  if (!connection?.refreshToken) return { revoked: true };
  try {
    const config = await discovery();
    if (!config.revocation_endpoint) return { revoked: false };
    const response = await fetch(config.revocation_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: connection.refreshToken, token_type_hint: "refresh_token", client_id: connection.clientId }),
      redirect: "error",
    });
    await response.body?.cancel().catch(() => undefined);
    return { revoked: response.ok };
  } catch {
    return { revoked: false };
  }
}
