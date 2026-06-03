import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection, useCollectionMutations } from '../hooks/useCollection';
import { useAuth } from '../context/AuthContext';
import { collectionTotal, formatPrice, itemValue, priceChange } from '../lib/format';
import { distinctStalePricedCards } from '../lib/collectionService';
import { CardTile } from '../components/CardTile';
import { PortfolioChart } from '../components/PortfolioChart';
import { MarketMovers, MostValuable } from '../components/CollectionInsights';
import { QuotaIndicator } from '../components/QuotaIndicator';
import { useQuota } from '../hooks/useQuota';
import { useRecordSnapshot, useSnapshots } from '../hooks/usePortfolio';
import { Spinner } from '../components/Spinner';
import { LogoutIcon, PlusIcon, RefreshIcon, SearchIcon, StarIcon } from '../components/icons';
import { CONDITIONS, type Condition } from '../types';

// Skip cards whose price was refreshed within this many hours (saves quota).
const STALE_HOURS = 12;

type SortKey = 'recent' | 'value_desc' | 'value_asc' | 'name' | 'mover';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'value_desc', label: 'Value: high → low' },
  { key: 'value_asc', label: 'Value: low → high' },
  { key: 'name', label: 'Name A → Z' },
  { key: 'mover', label: 'Biggest movers' },
];

export function Collection() {
  const { signOut } = useAuth();
  const { data: items, isLoading, error } = useCollection();
  const { refresh } = useCollectionMutations();
  const { data: snapshots } = useSnapshots();
  const quota = useQuota();

  const [gameSlug, setGameSlug] = useState('');
  const [setName, setSetName] = useState('');
  const [condition, setCondition] = useState<Condition | ''>('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [search, setSearch] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [hideValues, setHideValues] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const all = items ?? [];
  const fullTotal = collectionTotal(all); // whole portfolio (ignores filters)
  const hasFilter = Boolean(gameSlug || setName || condition || favOnly || search.trim());
  const favCount = all.filter((i) => i.is_favorite).length;

  // Persist today's portfolio value once the collection has loaded / changed.
  useRecordSnapshot(fullTotal, !isLoading && items !== undefined);

  // Distinct games / sets for the filter dropdowns (derived from the data).
  const gameOptions = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((i) => map.set(i.card.game.slug, i.card.game.name));
    return Array.from(map, ([slug, name]) => ({ slug, name }));
  }, [all]);

  const setOptions = useMemo(() => {
    const set = new Set<string>();
    all
      .filter((i) => !gameSlug || i.card.game.slug === gameSlug)
      .forEach((i) => i.card.set_name && set.add(i.card.set_name));
    return Array.from(set).sort();
  }, [all, gameSlug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = all.filter((i) => {
      if (favOnly && !i.is_favorite) return false;
      if (gameSlug && i.card.game.slug !== gameSlug) return false;
      if (setName && i.card.set_name !== setName) return false;
      if (condition && i.condition !== condition) return false;
      if (q && !i.card.name.toLowerCase().includes(q)) return false;
      return true;
    });

    const pct = (i: (typeof arr)[number]) => priceChange(i)?.pct ?? 0;
    switch (sort) {
      case 'value_desc':
        arr.sort((a, b) => itemValue(b) - itemValue(a));
        break;
      case 'value_asc':
        arr.sort((a, b) => itemValue(a) - itemValue(b));
        break;
      case 'name':
        arr.sort((a, b) => a.card.name.localeCompare(b.card.name));
        break;
      case 'mover':
        arr.sort((a, b) => Math.abs(pct(b)) - Math.abs(pct(a)));
        break;
      // 'recent' = default order (created_at desc from the query)
    }
    // Pin favorites to the top (stable: keeps the chosen sort within each group).
    arr.sort((a, b) => Number(!!b.is_favorite) - Number(!!a.is_favorite));
    return arr;
  }, [all, gameSlug, setName, condition, favOnly, search, sort]);

  const total = collectionTotal(filtered);

  // Smart refresh: only stale cards (refreshed > STALE_HOURS ago), capped to the
  // remaining daily quota so a big collection can't blow the budget in one tap.
  const staleCount = useMemo(
    () => distinctStalePricedCards(filtered, STALE_HOURS),
    [filtered],
  );
  const remaining = quota?.remaining ?? null;
  const budget = remaining != null ? Math.max(0, remaining) : Infinity;
  const willRefresh = Math.min(staleCount, budget);
  const canRefresh = willRefresh > 0 && !refresh.isPending;

  async function handleRefresh() {
    setRefreshMsg(null);
    const res = await refresh.mutateAsync({
      items: filtered,
      opts: { staleHours: STALE_HOURS, maxRequests: budget },
    });
    const parts = [`Updated ${res.updated}`];
    if (res.skippedFresh) parts.push(`${res.skippedFresh} already fresh`);
    if (res.deferred) parts.push(`${res.deferred} deferred (quota)`);
    if (res.errors.length) parts.push(`${res.errors.length} failed`);
    setRefreshMsg(parts.join(' · '));
  }

  return (
    <div className="space-y-5">
      {/* Header: title, value, sign out */}
      <header className="space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/50">
              Portfolio <span className="font-semibold text-accent">Main</span>
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-extrabold tracking-tight">
                {hideValues ? '••••' : formatPrice(fullTotal)}
              </h1>
              <button
                onClick={() => setHideValues((v) => !v)}
                className="text-white/40 hover:text-white/70"
                aria-label="Toggle value visibility"
                title="Hide/show values"
              >
                {/* simple eye */}
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-white/40">
              {hasFilter
                ? `Filtered: ${hideValues ? '••••' : formatPrice(total)} · ${filtered.length} shown`
                : `${all.length} card${all.length === 1 ? '' : 's'} · cached prices`}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Portfolio value chart (cached snapshots; no API calls) */}
      <PortfolioChart snapshots={snapshots ?? []} hideValues={hideValues} />

      {/* Insights (whole portfolio, from cached prices) */}
      {!hideValues && all.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MostValuable items={all} />
          <MarketMovers items={all} />
        </div>
      )}

      {/* Action row: add, refresh, quota */}
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/add" className="btn-primary">
          <PlusIcon className="h-4 w-4" /> Add card
        </Link>
        <button
          onClick={handleRefresh}
          disabled={!canRefresh}
          className="btn-ghost"
          title={
            staleCount === 0
              ? 'Prices are up to date (refreshed within 12h)'
              : budget === 0
                ? 'No daily TCG API quota left'
                : `Refresh ${willRefresh} stale price${willRefresh === 1 ? '' : 's'}, oldest first`
          }
        >
          {refresh.isPending ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <RefreshIcon className="h-4 w-4" />
          )}
          Refresh prices{willRefresh > 0 ? ` (${willRefresh})` : ''}
        </button>
        {favCount > 0 && (
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`btn-ghost ${favOnly ? 'border-amber-400/40 text-amber-400' : ''}`}
            title="Show favorites only"
          >
            <StarIcon filled={favOnly} className="h-4 w-4" />
            {favOnly ? 'Favorites only' : `Favorites (${favCount})`}
          </button>
        )}
        <QuotaIndicator />
        {refreshMsg && <span className="text-xs text-white/50">{refreshMsg}</span>}
      </div>
      {staleCount === 0 && all.length > 0 ? (
        <p className="text-xs text-white/40">
          Prices are up to date — refreshing only re-fetches cards older than 12h, to save your
          100/day quota.
        </p>
      ) : staleCount > willRefresh ? (
        <p className="text-xs text-amber-400">
          {staleCount} cards are stale but only {willRefresh} fit today's remaining quota — the
          oldest go first; the rest stay cached.
        </p>
      ) : null}

      {/* Filters & sort */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            className="input py-2.5"
            value={gameSlug}
            onChange={(e) => {
              setGameSlug(e.target.value);
              setSetName('');
            }}
          >
            <option value="">All games</option>
            {gameOptions.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            className="input py-2.5"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            disabled={setOptions.length === 0}
          >
            <option value="">All sets</option>
            {setOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="input py-2.5"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition | '')}
          >
            <option value="">All conditions</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} — {c.label}
              </option>
            ))}
          </select>

          <select
            className="input py-2.5"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            className="input py-2.5 pl-9"
            placeholder="Search your collection"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Gallery */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : error ? (
        <p className="rounded-lg bg-down/10 px-3 py-2 text-sm text-down">
          {(error as Error).message}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={all.length > 0} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item) => (
            <CardTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-white/60">
        {hasAny ? 'No cards match your filters.' : 'Your collection is empty.'}
      </p>
      {!hasAny && (
        <Link to="/add" className="btn-primary">
          <PlusIcon className="h-4 w-4" /> Add your first card
        </Link>
      )}
    </div>
  );
}
