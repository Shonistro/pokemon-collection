import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCollection, useCollectionMutations } from '../hooks/useCollection';
import { useAuth } from '../context/AuthContext';
import { uploadCardImage } from '../lib/storage';
import {
  effectiveUnitPrice,
  formatPrice,
  itemValue,
  timeAgo,
} from '../lib/format';
import { CONDITION_LABELS, type CollectionItem } from '../types';
import { Spinner } from '../components/Spinner';
import {
  ChevronLeftIcon,
  ImageIcon,
  RefreshIcon,
  TrashIcon,
} from '../components/icons';

/** Wrapper: resolves the collection item, then renders the loaded view. */
export function CardDetail() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const { data: items, isLoading } = useCollection();
  const item = items?.find((i) => i.id === collectionId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <BackBtn onClick={() => navigate('/')} />
        <p className="text-white/60">Card not found.</p>
      </div>
    );
  }

  return <CardDetailView item={item} />;
}

function CardDetailView({ item }: { item: CollectionItem }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateQuantity, remove, refresh, updateImage, updatePrice } =
    useCollectionMutations();

  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const { card } = item;
  const isManual = card.source === 'manual';
  const unit = effectiveUnitPrice(item);
  const acquired = item.acquired_price;
  const totalValue = itemValue(item);
  const totalCost = acquired != null ? acquired * item.quantity : null;
  const pnl = totalCost != null ? totalValue - totalCost : null;

  async function handleUpload(file: File) {
    if (!user) return;
    setUploading(true);
    setBusyMsg(null);
    try {
      const url = await uploadCardImage(file, user.id);
      await updateImage.mutateAsync({ cardId: card.id, imageUrl: url });
    } catch (err) {
      setBusyMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleRefresh() {
    setBusyMsg(null);
    // Force-refresh just this card (staleHours 0 = always).
    const res = await refresh.mutateAsync({ items: [item] });
    setBusyMsg(res.updated ? 'Price refreshed.' : 'No price update available.');
  }

  async function handleSavePrice() {
    const p = priceInput ? Number(priceInput) : null;
    await updatePrice.mutateAsync({ id: item.id, price: p });
    setPriceInput('');
    setBusyMsg('Price saved.');
  }

  async function handleDelete() {
    if (!confirm('Remove this card from your collection?')) return;
    await remove.mutateAsync(item.id);
    navigate('/');
  }

  return (
    <div className="space-y-5">
      <BackBtn onClick={() => navigate('/')} />

      {/* Image */}
      <div className="mx-auto w-full max-w-xs">
        <div className="surface relative aspect-[3/4] overflow-hidden">
          {card.image_url ? (
            <img src={card.image_url} alt={card.name} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/15">
              <ImageIcon className="h-12 w-12" />
            </div>
          )}
        </div>
        <label className="btn-ghost mt-2 w-full cursor-pointer">
          {uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          {card.image_url ? 'Replace photo' : 'Upload photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">{card.name}</h1>
        <p className="text-sm text-white/50">
          {[card.game.name, card.set_name, card.number].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Price summary */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Current price (each)" value={formatPrice(unit)}>
          <span className="text-xs text-white/40">
            updated {timeAgo(item.price_updated_at)}
          </span>
        </Stat>
        <Stat label="Total value" value={formatPrice(totalValue)}>
          <span className="text-xs text-white/40">
            {item.quantity} × {formatPrice(unit)}
          </span>
        </Stat>
        <Stat label="Acquired (each)" value={formatPrice(acquired)} />
        <Stat
          label="Profit / Loss"
          value={pnl == null ? '—' : formatPrice(pnl)}
          valueClass={pnl == null ? '' : pnl >= 0 ? 'text-up' : 'text-down'}
        />
      </div>

      {/* Copies + condition */}
      <div className="surface flex items-center justify-between p-4">
        <div>
          <p className="label mb-0">Condition</p>
          <p className="font-semibold">
            {item.condition} — {CONDITION_LABELS[item.condition]}
          </p>
        </div>
        <div className="text-right">
          <p className="label mb-0">Copies</p>
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost px-3 py-1"
              onClick={() =>
                updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })
              }
            >
              −
            </button>
            <span className="w-6 text-center text-lg font-bold">{item.quantity}</span>
            <button
              className="btn-ghost px-3 py-1"
              onClick={() =>
                updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })
              }
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Price actions */}
      {isManual ? (
        <div className="surface space-y-2 p-4">
          <label className="label">Update price (each)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min={0}
              className="input"
              placeholder={unit != null ? String(unit) : 'Enter price'}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={handleSavePrice}
              disabled={updatePrice.isPending || !priceInput}
            >
              Save
            </button>
          </div>
          <p className="text-xs text-white/40">
            Manual cards aren't priced by the API — set the value yourself.
          </p>
        </div>
      ) : (
        <button onClick={handleRefresh} className="btn-ghost w-full" disabled={refresh.isPending}>
          {refresh.isPending ? <Spinner className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
          Refresh price (1 API request)
        </button>
      )}

      {busyMsg && <p className="text-center text-sm text-white/50">{busyMsg}</p>}

      {/* Danger zone */}
      <button
        onClick={handleDelete}
        className="btn w-full border border-down/30 text-down hover:bg-down/10"
        disabled={remove.isPending}
      >
        <TrashIcon className="h-4 w-4" /> Remove from collection
      </button>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"
    >
      <ChevronLeftIcon className="h-5 w-5" /> Collection
    </button>
  );
}

function Stat({
  label,
  value,
  valueClass = '',
  children,
}: {
  label: string;
  value: string;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="surface p-4">
      <p className="label mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {children}
    </div>
  );
}
