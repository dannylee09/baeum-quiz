import "server-only";
import { getSupabaseSecretKey } from "@/lib/supabase/admin";

export function getServerSigningSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() || getSupabaseSecretKey();
  if (!secret) throw new Error("A server signing secret is required.");
  return secret;
}
