"use client";

import { useState, useEffect, useCallback } from "react";
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";

export interface TrelloLinkedList {
  id: string;
  projectId: string;
  listId: string;
  listName: string | null;
  boardId: string | null;
  boardName: string | null;
  createdAt: string;
}

interface BoardList {
  id: string;
  name: string;
}

interface Board {
  id: string;
  name: string;
  lists: BoardList[];
}

interface TrelloListPickerProps {
  projectId: string;
  linkedLists: TrelloLinkedList[];
  onLinksChange: () => void;
}

export function TrelloListPicker({ projectId, linkedLists, onLinksChange }: TrelloListPickerProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError("");
    try {
      const res = await fetch("/api/trello/board");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to load Trello board");
      }
      const data = await res.json();
      setBoard(data);
    } catch (e) {
      setBoardError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const linkedIds = new Set(linkedLists.map((l) => l.listId));
  const availableLists = board?.lists.filter((l) => !linkedIds.has(l.id)) ?? [];

  const handleLink = async () => {
    if (!selectedListId) return;
    const boardList = board?.lists.find((l) => l.id === selectedListId);
    if (!boardList) return;
    setLinking(true);
    setLinkError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/trello-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: boardList.id,
          listName: boardList.name,
          boardId: board?.id ?? null,
          boardName: board?.name ?? null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to link list");
      }
      setSelectedListId("");
      onLinksChange();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Failed to link");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/trello-links/${linkId}`, {
        method: "DELETE",
      });
      onLinksChange();
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="space-y-3">
      {linkedLists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkedLists.map((link) => (
            <span
              key={link.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800"
            >
              <span>{link.listName ?? link.listId}</span>
              {link.boardName && (
                <span className="text-sky-500">({link.boardName})</span>
              )}
              <button
                type="button"
                onClick={() => handleUnlink(link.id)}
                className="ml-0.5 rounded-full p-0.5 text-sky-600 hover:bg-sky-100 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label={`Unlink ${link.listName ?? link.listId}`}
              >
                <XMarkIcon className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      {boardLoading ? (
        <p className="text-xs text-slate-500">Loading Trello board…</p>
      ) : boardError ? (
        <p className="text-xs text-rose-600">{boardError}</p>
      ) : availableLists.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="">Select a list to link…</option>
            {availableLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLink}
            disabled={!selectedListId || linking}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <PlusIcon className="h-4 w-4" aria-hidden />
            {linking ? "Linking…" : "Link"}
          </button>
        </div>
      ) : linkedLists.length === 0 ? (
        <p className="text-xs text-slate-500">No available lists found on the current board.</p>
      ) : (
        <p className="text-xs text-slate-500">All board lists are already linked.</p>
      )}

      {linkError && <p className="text-xs text-rose-600">{linkError}</p>}
    </div>
  );
}
