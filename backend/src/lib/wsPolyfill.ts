/**
 * Node.js < 22 has no global WebSocket. @supabase/supabase-js eagerly builds a
 * Realtime client (which we never use) and throws on construction without one.
 * Registering `ws` as the global satisfies that check. Import this module BEFORE
 * creating any Supabase client.
 */
import ws from "ws";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = ws;
}
