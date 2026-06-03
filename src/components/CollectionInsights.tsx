import { Link } from 'react-router-dom';
import type { CollectionItem } from '../types';
import {
  effectiveUnitPrice,
  formatPct,
  formatPrice,
  priceChange,
} from '../lib/format';
import { ImageIcon } from './icons';

/** Keep one representative row per distinct card. */
function distinctCards(items: CollectionItem[]): CollectionItem[] {
  const map = new Map<string, CollectionItem>();
  for (const i of items) if (!map.has(i.card.id)) map.set(i.card.id, i);
  return Array.from(map.values());
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-bg-surface">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        <ImageIcon className="h-4 w-4 text-white/15" />
      )}
    </div>
  );
}

function Row({
  item,
  right,
}: {
  item: CollectionItem;
  right: React.ReactNode;
}) {
  return (
    <Link
      to={`/card/${item.id}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5"
    >
      <Thumb url={item.card.image_url} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">{item.card.name}</p>
        <p className="line-clamp-1 text-xs text-white/40">
          {item.card.set_name ?? item.card.game.name}
        </p>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </Link>
  );
}

/** Top cards by current unit price. */
export function MostValuable({ items, limit = 4 }: { items: CollectionItem[]; limit?: number }) {
  const top = distinctCards(items)
    .map((item) => ({ item, unit: effectiveUnitPrice(item) }))
    .filter((x) => x.unit != null)
    .sort((a, b) => (b.unit as number) - (a.unit as number))
    .slice(0, limit);

  if (top.length === 0) return null;

  return (
    <section className="surface overflow-hidden">
      <h2 className="px-4 pb-1 pt-3 text-sm font-semibold text-white/80">Most Valuable</h2>
      {top.map(({ item, unit }) => (
        <Row key={item.id} item={item} right={<span className="font-semibold">{formatPrice(unit)}</span>} />
      ))}
    </section>
  );
}

/** Top cards by absolute % price change since the last refresh. */
export function MarketMovers({ items, limit = 4 }: { items: CollectionItem[]; limit?: number }) {
  const movers = distinctCards(items)
    .map((item) => ({ item, change: priceChange(item) }))
    .filter((x) => x.change != null && x.change.abs !== 0)
    .sort((a, b) => Math.abs(b.change!.pct) - Math.abs(a.change!.pct))
    .slice(0, limit);

  if (movers.length === 0) return null;

  return (
    <section className="surface overflow-hidden">
      <h2 className="px-4 pb-1 pt-3 text-sm font-semibold text-white/80">Market Movers</h2>
      {movers.map(({ item, change }) => {
        const up = change!.pct >= 0;
        return (
          <Row
            key={item.id}
            item={item}
            right={
              <div>
                <div className="font-semibold">{formatPrice(item.last_known_price)}</div>
                <div className={`text-xs font-medium ${up ? 'text-up' : 'text-down'}`}>
                  {formatPct(change!.pct)}
                </div>
              </div>
            }
          />
        );
      })}
    </section>
  );
}
