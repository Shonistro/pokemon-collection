import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addToCollection,
  fetchCollection,
  refreshPrices,
  removeItem,
  setFavorite,
  setQuantity,
  updateCardImage,
  updateManualPrice,
  type AddToCollectionParams,
  type RefreshOptions,
} from '../lib/collectionService';
import type { CollectionItem } from '../types';

const COLLECTION_KEY = ['collection'] as const;

/** The current user's collection (cached prices included). No API calls. */
export function useCollection() {
  return useQuery({
    queryKey: COLLECTION_KEY,
    queryFn: fetchCollection,
  });
}

/** Mutations for modifying the collection; all invalidate the collection query. */
export function useCollectionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: COLLECTION_KEY });

  const add = useMutation({
    mutationFn: (params: AddToCollectionParams) => addToCollection(params),
    onSuccess: invalidate,
  });

  const updateQuantity = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      setQuantity(id, quantity),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeItem(id),
    onSuccess: invalidate,
  });

  const refresh = useMutation({
    mutationFn: (vars: { items: CollectionItem[]; opts?: RefreshOptions }) =>
      refreshPrices(vars.items, vars.opts),
    onSuccess: invalidate,
  });

  const updateImage = useMutation({
    mutationFn: ({ cardId, imageUrl }: { cardId: string; imageUrl: string }) =>
      updateCardImage(cardId, imageUrl),
    onSuccess: invalidate,
  });

  const updatePrice = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number | null }) =>
      updateManualPrice(id, price),
    onSuccess: invalidate,
  });

  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => setFavorite(id, value),
    onSuccess: invalidate,
  });

  return { add, updateQuantity, remove, refresh, updateImage, updatePrice, favorite };
}
