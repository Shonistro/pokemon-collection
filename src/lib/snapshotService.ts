import { supabase } from './supabase';

export interface Snapshot {
  captured_on: string; // YYYY-MM-DD (UTC)
  total_value: number;
}

/** Today's date in UTC as YYYY-MM-DD (matches the DB default). */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record (upsert) today's total portfolio value. Idempotent per day — calling
 * it repeatedly just overwrites today's value. Computed from cached prices, so
 * it never calls the TCG API.
 */
export async function recordSnapshot(totalValue: number): Promise<void> {
  const { error } = await supabase.from('portfolio_snapshots').upsert(
    { captured_on: todayUtc(), total_value: Number(totalValue.toFixed(2)) },
    { onConflict: 'user_id,captured_on' },
  );
  if (error) throw error;
}

/** All of the user's daily snapshots, oldest first. */
export async function fetchSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('captured_on, total_value')
    .order('captured_on', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
