import { Link } from 'react-router-dom';
import type { CollectionItem } from '../types';
import { effectiveUnitPrice, formatPrice, itemValue } from '../lib/format';
import { useCollectionMutations } from '../hooks/useCollection';
import { ImageIcon, StarIcon } from './icons';

/** A single card in the collection gallery. Links to the detail screen. */
export function CardTile({ item }: { item: CollectionItem }) {
  const { card } = item;
  const unit = effectiveUnitPrice(item);
  const { favorite } = useCollectionMutations();

  function toggleFavorite(e: React.MouseEvent) {
    // Don't navigate to the detail page when tapping the star.
    e.preventDefault();
    e.stopPropagation();
    favorite.mutate({ id: item.id, value: !item.is_favorite });
  }

  return (
    <Link
      to={`/card/${item.id}`}
      className="surface group flex flex-col overflow-hidden transition-colors hover:border-accent/40"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-bg-surface">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/15">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        {item.quantity > 1 && (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold">
            ×{item.quantity}
          </span>
        )}
        <button
          onClick={toggleFavorite}
          className={`absolute left-2 top-2 rounded-full bg-black/60 p-1.5 transition-colors ${
            item.is_favorite ? 'text-amber-400' : 'text-white/60 hover:text-white'
          }`}
          aria-label={item.is_favorite ? 'Unfavorite' : 'Favorite'}
          title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <StarIcon filled={item.is_favorite} className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{card.name}</h3>
        <p className="line-clamp-1 text-xs text-white/40">
          {card.set_name ?? card.game.name}
          {card.number ? ` · ${card.number}` : ''}
        </p>
        <div className="mt-2 flex items-end justify-between">
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
            {item.condition}
          </span>
          <div className="text-right">
            <div className="text-sm font-bold">{formatPrice(itemValue(item))}</div>
            {item.quantity > 1 && unit != null && (
              <div className="text-[10px] text-white/40">{formatPrice(unit)} ea</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
