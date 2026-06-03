import { useMemo, useState } from 'react';
import type { Snapshot } from '../lib/snapshotService';
import { formatPrice } from '../lib/format';
import { ChevronDownIcon, ChevronUpIcon } from './icons';

const RANGES: { key: string; label: string; days: number }[] = [
  { key: '1D', label: '1D', days: 1 },
  { key: '7D', label: '7D', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: 'MAX', label: 'MAX', days: Infinity },
];

const W = 320;
const H = 110;
const PAD_Y = 8;

function daysAgoMs(days: number): number {
  return Date.now() - days * 86_400_000;
}

/**
 * Portfolio value over time. Reads from daily snapshots only (no API calls).
 * Draws a lightweight SVG area chart; the series fills in as snapshots
 * accumulate, so early on it may be flat or near-empty (that's expected).
 */
export function PortfolioChart({
  snapshots,
  hideValues,
}: {
  snapshots: Snapshot[];
  hideValues: boolean;
}) {
  const [rangeKey, setRangeKey] = useState('1M');
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[2];

  const pts = useMemo(() => {
    if (snapshots.length === 0) return [];
    const cutoff = range.days === Infinity ? -Infinity : daysAgoMs(range.days);
    const within = snapshots.filter(
      (s) => new Date(`${s.captured_on}T00:00:00Z`).getTime() >= cutoff,
    );
    // If nothing falls in-range, fall back to the latest point (flat line).
    return within.length > 0 ? within : snapshots.slice(-1);
  }, [snapshots, range.days]);

  const delta = pts.length >= 2 ? pts[pts.length - 1].total_value - pts[0].total_value : 0;
  const pct = pts.length >= 2 && pts[0].total_value > 0 ? (delta / pts[0].total_value) * 100 : 0;
  const trendColor = delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : '#2dd4bf';

  const { line, area } = useMemo(() => buildPaths(pts), [pts]);

  return (
    <div className="space-y-3">
      {/* Delta vs start of the selected range */}
      <div className="flex items-center gap-1.5 text-sm">
        {pts.length >= 2 && delta !== 0 ? (
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: trendColor }}
          >
            {delta > 0 ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
            {hideValues ? '••••' : `${delta >= 0 ? '+' : '-'}${formatPrice(Math.abs(delta))}`}
            <span className="text-white/40">({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
          </span>
        ) : (
          <span className="font-semibold text-accent">
            {hideValues ? '••••' : '+$0.00'}
          </span>
        )}
        <span className="text-white/40">
          {range.key === 'MAX' ? 'all time' : `last ${range.label}`}
        </span>
      </div>

      {/* Chart */}
      <div className="h-28 w-full">
        {pts.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/5 text-xs text-white/30">
            The value chart fills in as prices update.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#pf-fill)" />
            <path
              d={line}
              fill="none"
              stroke={trendColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {/* Range tabs */}
      <div className="flex items-center justify-between">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRangeKey(r.key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors ${
              r.key === rangeKey ? 'bg-white text-black' : 'text-white/50 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Build the line + filled-area SVG paths from the points. */
function buildPaths(pts: Snapshot[]): { line: string; area: string } {
  if (pts.length === 0) return { line: '', area: '' };

  const vals = pts.map((p) => p.total_value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    // Flat series — nudge the bounds so the line sits mid-height.
    const base = max || 1;
    min = base * 0.98;
    max = base * 1.02;
  }
  const span = max - min || 1;
  const n = pts.length;

  const xFor = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yFor = (v: number) => PAD_Y + (1 - (v - min) / span) * (H - 2 * PAD_Y);

  if (n === 1) {
    const y = yFor(pts[0].total_value);
    return {
      line: `M 0 ${y} L ${W} ${y}`,
      area: `M 0 ${y} L ${W} ${y} L ${W} ${H} L 0 ${H} Z`,
    };
  }

  const coords = pts.map((p, i) => `${xFor(i)} ${yFor(p.total_value)}`);
  const line = `M ${coords.join(' L ')}`;
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  return { line, area };
}
