import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// A stable ID cursor avoids offset shifts. A cutoff excludes newly arriving rows.
export async function readAllRows<T>(client: SupabaseClient, table: string, columns: string, cutoff: string, filters?: { inColumn: string; values: string[] }) {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 250; page++) {
    let query = client.from(table).select(columns).lte("created_at", cutoff).order("id").limit(1000);
    if (filters) query = query.in(filters.inColumn, filters.values);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to read ${table}`);
    const batch = (data ?? []) as unknown as Array<T & { id: string }>;
    rows.push(...batch);
    if (batch.length < 1000) return rows;
    cursor = batch[batch.length - 1].id;
  }
  throw new Error("Too many rows to read safely");
}
