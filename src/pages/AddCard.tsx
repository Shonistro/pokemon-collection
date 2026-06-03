import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGames, type GameOption } from '../hooks/useGames';
import { useFavoriteGames } from '../hooks/useFavoriteGames';
import { useCollectionMutations } from '../hooks/useCollection';
import { getProviderForGame } from '../providers/registry';
import { fetchPokeWalletImageUrl } from '../providers/PokeWalletProvider';
import { uploadCardImage } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../lib/format';
import { CONDITIONS, type CardResult, type Condition } from '../types';
import { Spinner } from '../components/Spinner';
import { ChevronLeftIcon, ImageIcon, SearchIcon, StarIcon } from '../components/icons';

/** What the user is about to add — drives how we build the DB write. */
type Draft =
  | { type: 'catalog-tcg'; result: CardResult }
  | { type: 'local-manual'; result: CardResult }
  | { type: 'new-manual' };

export function AddCard() {
  const { games, isLoading: gamesLoading } = useGames();
  const [game, setGame] = useState<GameOption | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Step 1: pick a game.
  if (!game) {
    return (
      <GamePicker
        games={games}
        loading={gamesLoading}
        onPick={(g) => {
          setGame(g);
          setDraft(null);
        }}
      />
    );
  }

  // Step 3: confirm details for the chosen draft.
  if (draft) {
    return (
      <ConfirmAddForm
        game={game}
        draft={draft}
        onBack={() => setDraft(null)}
      />
    );
  }

  // Step 2: find a card (search) or start a manual entry.
  return (
    <FindCard
      game={game}
      onBack={() => setGame(null)}
      onSelect={setDraft}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — game picker                                                       */
/* -------------------------------------------------------------------------- */
function GamePicker({
  games,
  loading,
  onPick,
}: {
  games: GameOption[];
  loading: boolean;
  onPick: (g: GameOption) => void;
}) {
  const [q, setQ] = useState('');
  const { isFavorite, toggle } = useFavoriteGames();

  const filtered = games
    .filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))
    // Favorites first, then alphabetical.
    .sort((a, b) => {
      const fa = isFavorite(a.slug) ? 0 : 1;
      const fb = isFavorite(b.slug) ? 0 : 1;
      return fa - fb || a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add a card</h1>
      <p className="text-sm text-white/50">
        Choose a game. Tap the ★ to pin your games to the top.
      </p>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9"
          placeholder="Filter games"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((g) => {
            const fav = isFavorite(g.slug);
            return (
              <div
                key={g.slug}
                className="surface flex items-center gap-1 pr-3 hover:border-accent/40"
              >
                <button
                  onClick={() => toggle(g.slug)}
                  className={`shrink-0 rounded-full p-3 transition-colors ${
                    fav ? 'text-amber-400' : 'text-white/30 hover:text-white'
                  }`}
                  aria-label={fav ? 'Unpin game' : 'Pin game to top'}
                  title={fav ? 'Unpin' : 'Pin to top'}
                >
                  <StarIcon filled={fav} className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onPick(g)}
                  className="flex flex-1 items-center justify-between py-3 text-left"
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs uppercase tracking-wide text-white/40">
                    {g.source === 'tcgapi' ? 'TCG API' : 'Manual'}
                  </span>
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-white/40">No games match.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — find a card (provider search) or manual new                       */
/* -------------------------------------------------------------------------- */
function FindCard({
  game,
  onBack,
  onSelect,
}: {
  game: GameOption;
  onBack: () => void;
  onSelect: (d: Draft) => void;
}) {
  const provider = useMemo(() => getProviderForGame(game), [game]);
  const isManual = game.source === 'manual';

  const [q, setQ] = useState('');
  const [results, setResults] = useState<CardResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    try {
      // Explicit, user-triggered search — the only time we spend an API call.
      setResults(await provider.searchCards(query, game.slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} title={game.name} />

      <form onSubmit={doSearch} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            className="input pl-9"
            placeholder={
              isManual ? 'Search your manual cards' : 'Name or number — e.g. Charizard or 040'
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={searching || !q.trim()}>
          {searching ? <Spinner className="h-4 w-4 border-black/30 border-t-black" /> : 'Search'}
        </button>
      </form>

      {!isManual && (
        <p className="text-xs text-white/40">
          Search by card name or collector number. Use the full number for an exact match —
          e.g. <span className="text-white/60">098/088</span> — or a bare number like{' '}
          <span className="text-white/60">098</span> to see all matches. Each search uses 1 of
          your 100 daily TCG API requests.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
      )}

      {/* Any game can add a card by hand — needed for cards missing from the
          API (e.g. German printings) or for fully manual games. */}
      <button onClick={() => onSelect({ type: 'new-manual' })} className="btn-ghost w-full">
        + {isManual ? 'Enter a new card manually' : "Can't find it? Add manually"}
      </button>
      {!isManual && (
        <p className="text-[11px] text-white/30">
          German cards aren't in the catalog — add them here by hand. Japanese cards: pick the
          "Pokemon Japan" game instead. You'll set the price yourself for manual cards.
        </p>
      )}

      {results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">No results.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.externalId}
                onClick={() =>
                  onSelect(
                    isManual
                      ? { type: 'local-manual', result: r }
                      : { type: 'catalog-tcg', result: r },
                  )
                }
                className="surface flex w-full items-center gap-3 p-3 text-left hover:border-accent/40"
              >
                <Thumb url={r.imageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium">{r.name}</p>
                  <p className="line-clamp-1 text-xs text-white/40">
                    {[r.setName, r.rarity, r.printing].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {formatPrice(r.marketPrice)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — confirm condition / quantity / price, then write to DB            */
/* -------------------------------------------------------------------------- */
function ConfirmAddForm({
  game,
  draft,
  onBack,
}: {
  game: GameOption;
  draft: Draft;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { add } = useCollectionMutations();

  const fromResult = draft.type !== 'new-manual' ? draft.result : null;

  // Shared fields.
  const [condition, setCondition] = useState<Condition>('NM');
  const [quantity, setQuantity] = useState(1);
  const [acquiredPrice, setAcquiredPrice] = useState('');

  // Manual-entry fields (new card) / optional manual price override.
  const [name, setName] = useState('');
  const [setNameField, setSetNameField] = useState('');
  const [number, setNumber] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewManual = draft.type === 'new-manual';
  const isLocalManual = draft.type === 'local-manual';
  const isTcg = draft.type === 'catalog-tcg';

  async function handleUpload(file: File) {
    if (!user) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadCardImage(file, user.id);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const acquired = acquiredPrice ? Number(acquiredPrice) : null;
    const manual = manualPrice ? Number(manualPrice) : null;

    try {
      if (isTcg && fromResult) {
        // PokéWallet results have no image URL — cache one via the proxy on add.
        let imageUrl = fromResult.imageUrl;
        if (fromResult.source === 'pokewallet' && !imageUrl) {
          imageUrl = await fetchPokeWalletImageUrl(fromResult.externalId);
        }
        await add.mutateAsync({
          game: { slug: game.slug, name: game.name, source: game.source },
          card: {
            kind: 'catalog',
            externalId: fromResult.externalId,
            name: fromResult.name,
            setName: fromResult.setName,
            number: fromResult.number,
            imageUrl,
            // tcgapi or pokewallet — drives which provider refreshes the price.
            source: fromResult.source,
          },
          condition,
          quantity,
          acquiredPrice: acquired,
          marketPrice: fromResult.marketPrice,
          manualPrice: null,
        });
      } else if (isLocalManual && fromResult) {
        // Adding another copy of an existing manual card.
        await add.mutateAsync({
          game: { slug: game.slug, name: game.name, source: game.source },
          card: { kind: 'local', id: fromResult.externalId },
          condition,
          quantity,
          acquiredPrice: acquired,
          marketPrice: null,
          manualPrice: manual,
        });
      } else {
        // Brand new manual card (works under any game; the CARD is manual even
        // if the game itself is a TCG-API game like Pokémon).
        if (!name.trim()) {
          setError('Name is required.');
          return;
        }
        await add.mutateAsync({
          game: { slug: game.slug, name: game.name, source: game.source },
          card: {
            kind: 'catalog',
            externalId: null,
            name: name.trim(),
            setName: setNameField.trim() || null,
            number: number.trim() || null,
            imageUrl: imageUrl.trim() || null,
            source: 'manual',
          },
          condition,
          quantity,
          acquiredPrice: acquired,
          marketPrice: null,
          manualPrice: manual,
        });
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add card');
    }
  }

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} title="Add to collection" />

      {/* Card preview */}
      <div className="surface flex gap-3 p-3">
        <Thumb url={isNewManual ? imageUrl || null : fromResult?.imageUrl ?? null} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold">
            {isNewManual ? name || 'New manual card' : fromResult?.name}
          </p>
          <p className="text-xs text-white/40">{game.name}</p>
          {isTcg && (
            <p className="mt-1 text-sm">
              Market: <span className="font-semibold">{formatPrice(fromResult?.marketPrice)}</span>
              <span className="ml-1 text-xs text-white/40">→ cached on add</span>
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New manual card details */}
        {isNewManual && (
          <div className="surface space-y-3 p-4">
            <div>
              <label className="label">Card name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Set</label>
                <input
                  className="input"
                  value={setNameField}
                  onChange={(e) => setSetNameField(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Number</label>
                <input
                  className="input"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Image</label>
              <div className="flex items-center gap-3">
                <label className="btn-ghost cursor-pointer">
                  {uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
                {imageUrl && <span className="text-xs text-up">Image attached ✓</span>}
              </div>
            </div>
          </div>
        )}

        <div className="surface space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Condition</label>
              <select
                className="input"
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} — {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                type="number"
                min={1}
                className="input"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Acquired price (each)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                placeholder="What you paid"
                value={acquiredPrice}
                onChange={(e) => setAcquiredPrice(e.target.value)}
              />
            </div>
            {!isTcg && (
              <div>
                <label className="label">
                  {isNewManual ? 'Price (each) *' : 'Update price (each)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  placeholder="Current value"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={add.isPending}>
          {add.isPending ? <Spinner className="h-5 w-5 border-black/30 border-t-black" /> : null}
          Add to collection
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small shared bits                                                          */
/* -------------------------------------------------------------------------- */
function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onBack}
        className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
        aria-label="Back"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-surface">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        <ImageIcon className="h-6 w-6 text-white/15" />
      )}
    </div>
  );
}
