import { config } from "wasp/client";

// The /platform/* endpoints are raw Wasp `api` routes (src/server/platform/),
// called via plain fetch() since PlatformOperator never flows through Wasp's
// typed operations client. A relative fetch("/platform/...") resolves against
// the CLIENT's own origin (e.g. localhost:3002 in dev), not the server
// (localhost:3011) -- they're different origins in dev because 3000/3001
// were already taken (Build Step 01). config.apiUrl is Wasp's own resolved
// server URL (REACT_APP_API_URL), same value its generated operations client uses.
export function platformApiUrl(path: string): string {
  return `${config.apiUrl}${path}`;
}
