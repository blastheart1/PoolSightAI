"use client";

import { useState, useCallback, useEffect } from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";
import type { TrelloLinkedList } from "./TrelloListPicker";

export interface SelectedTrelloImage {
  url: string;
  cardName: string;
  mimeType?: string;
}

interface CardAttachment {
  url: string;
  mimeType?: string;
  name?: string;
}

function isTrelloHostedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === "api.trello.com" ||
      host === "trello.com" ||
      host.endsWith(".trello.com") ||
      host.includes("trello-attachments")
    );
  } catch {
    return false;
  }
}

interface TrelloCard {
  id: string;
  name: string;
  attachments: CardAttachment[];
}

interface TrelloImagePickerProps {
  linkedLists: TrelloLinkedList[];
  selectedImages: SelectedTrelloImage[];
  onSelectionChange: (images: SelectedTrelloImage[]) => void;
  maxImages?: number;
}

export function TrelloImagePicker({
  linkedLists,
  selectedImages,
  onSelectionChange,
  maxImages = 20,
}: TrelloImagePickerProps) {
  const [activeListId, setActiveListId] = useState<string>(linkedLists[0]?.listId ?? "");
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState("");
  const [page, setPage] = useState(0);

  const selectedUrls = new Set(selectedImages.map((i) => i.url));

  const loadCards = useCallback(async (listId: string) => {
    if (!listId) return;
    setCardsLoading(true);
    setCardsError("");
    setCards([]);
    try {
      const res = await fetch(`/api/trello/lists/${listId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to load list");
      }
      const data = await res.json();
      const rawCards: TrelloCard[] = Array.isArray(data.cards) ? data.cards : [];
      setCards(rawCards);
    } catch (e) {
      setCardsError(e instanceof Error ? e.message : "Failed to load images");
    } finally {
      setCardsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeListId) {
      loadCards(activeListId);
      setPage(0);
    }
  }, [activeListId, loadCards]);

  // Flatten all image attachments across all cards
  const allImages: SelectedTrelloImage[] = cards.flatMap((card) =>
    (card.attachments ?? [])
      .filter((a) => {
        if (!isTrelloHostedUrl(a.url)) return false;
        if (a.mimeType && a.mimeType.startsWith("image/")) return true;
        if (!a.mimeType) {
          const ext = a.url?.split("?")[0]?.split(".").pop()?.toLowerCase();
          return ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext ?? "");
        }
        return false;
      })
      .map((a) => ({ url: a.url, cardName: card.name, mimeType: a.mimeType }))
  );

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(allImages.length / PAGE_SIZE);
  const pagedImages = allImages.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleImage = (img: SelectedTrelloImage) => {
    if (selectedUrls.has(img.url)) {
      onSelectionChange(selectedImages.filter((i) => i.url !== img.url));
    } else {
      if (selectedImages.length >= maxImages) return;
      onSelectionChange([...selectedImages, img]);
    }
  };

  const clearAll = () => onSelectionChange([]);

  return (
    <div className="space-y-3">
      {linkedLists.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            List
          </label>
          <select
            value={activeListId}
            onChange={(e) => {
              setActiveListId(e.target.value);
              onSelectionChange([]);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            {linkedLists.map((l) => (
              <option key={l.listId} value={l.listId}>
                {l.listName ?? l.listId}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {selectedImages.length}/{maxImages} selected
        </p>
        {selectedImages.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-slate-500 underline hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Clear all
          </button>
        )}
      </div>

      {cardsLoading ? (
        <p className="text-sm text-slate-500">Loading images…</p>
      ) : cardsError ? (
        <p className="text-sm text-rose-600">{cardsError}</p>
      ) : allImages.length === 0 ? (
        <p className="text-sm text-slate-500">No images found in this list.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {pagedImages.map((img, idx) => {
              const isSelected = selectedUrls.has(img.url);
              const isDisabled = !isSelected && selectedImages.length >= maxImages;
              const thumbUrl = `/api/trello/proxy-image?url=${encodeURIComponent(img.url)}&thumb=1`;
              return (
                <button
                  key={`${img.url}-${idx}`}
                  type="button"
                  onClick={() => toggleImage(img)}
                  disabled={isDisabled}
                  title={img.cardName}
                  className={[
                    "relative aspect-square overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                    isSelected
                      ? "border-sky-500 ring-2 ring-sky-300"
                      : "border-slate-200 hover:border-slate-400",
                    isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl}
                    alt={img.cardName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Fallback icon if image fails */}
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 opacity-0 [img:not([src])~&]:opacity-100">
                    <PhotoIcon className="h-6 w-6 text-slate-400" aria-hidden />
                  </div>
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white shadow">
                      {selectedImages.findIndex((i) => i.url === img.url) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
