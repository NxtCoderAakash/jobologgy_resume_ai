/**
 * Verify a Supabase JWT and return the user id — a plain function, not middleware,
 * so it drops into any Node server.
 */
import "./wsPolyfill.js";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// An admin client is only used here to validate the bearer token.
const admin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export async function verifySupabaseJwt(
  authorizationHeader: string | undefined,
): Promise<string> {
  const token = (authorizationHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Missing bearer token");
  if (!admin) throw new HttpError(500, "Supabase is not configured on the server");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session");
  return data.user.id;
}
