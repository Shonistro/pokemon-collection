import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSnapshots, recordSnapshot } from '../lib/snapshotService';

const SNAPSHOTS_KEY = ['snapshots'] as const;

/** The user's daily portfolio-value snapshots (for the chart). */
export function useSnapshots() {
  return useQuery({ queryKey: SNAPSHOTS_KEY, queryFn: fetchSnapshots });
}

/**
 * Persist today's portfolio total whenever it changes (after load, add, or
 * refresh). Upserts one row per day, then refreshes the chart. `enabled` lets
 * the caller wait until the collection has actually loaded.
 */
export function useRecordSnapshot(total: number, enabled: boolean) {
  const qc = useQueryClient();
  const lastRecorded = useRef<number | null>(null);

  const mutation = useMutation({
    mutationFn: (value: number) => recordSnapshot(value),
    onSuccess: () => qc.invalidateQueries({ queryKey: SNAPSHOTS_KEY }),
  });

  useEffect(() => {
    if (!enabled) return;
    const rounded = Number(total.toFixed(2));
    // Only write when the value actually changed (avoids redundant upserts).
    if (lastRecorded.current === rounded) return;
    lastRecorded.current = rounded;
    mutation.mutate(rounded);
    // mutation is stable enough for our purposes; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, enabled]);
}
