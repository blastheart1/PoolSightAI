/**
 * Trello API client (server-only). Uses TRELLO_API_KEY and TRELLO_API_TOKEN.
 * Base: https://api.trello.com/1
 * Read-only: all requests are GET; nothing is created, updated, or deleted on Trello.
 */

const TRELLO_BASE = "https://api.trello.com/1";
/** Accepted board names (e.g. "Current Project" or "Current Production"). */
const CURRENT_PROJECT_BOARD_NAMES = ["Current Project", "Current Production"];

function getAuthParams(): { key: string; token: string } | null {
  const key = process.env.TRELLO_API_KEY?.trim();
  const token = process.env.TRELLO_API_TOKEN?.trim();
  if (!key || !token) return null;
  return { key, token };
}

function authQuery(): string {
  const auth = getAuthParams();
  if (!auth) return "";
  return `key=${encodeURIComponent(auth.key)}&token=${encodeURIComponent(auth.token)}`;
}

export type TrelloBoard = {
  id: string;
  name: string;
  url: string;
};

export type TrelloAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  date: string;
  isUpload?: boolean;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  shortUrl: string;
  url: string;
  dateLastActivity: string;
  idList: string;
  attachments: TrelloAttachment[];
};

export type TrelloList = {
  id: string;
  name: string;
};

/** True if attachment is an image (by mimeType or file extension). Used for Daily Photos and AI analysis. */
export function isImageAttachment(att: { mimeType?: string; name?: string }): boolean {
  const mime = (att.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const name = (att.name ?? "").toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(name);
}

function normalizeAttachment(raw: Record<string, unknown>): TrelloAttachment {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    url: String(raw.url ?? ""),
    mimeType: raw.mimeType != null ? String(raw.mimeType) : undefined,
    date: String(raw.date ?? ""),
    isUpload: raw.isUpload === true,
  };
}

/**
 * Returns the "Current Project" board or null if not found or Trello not configured.
 * If TRELLO_BOARD_ID is set in env (board id or shortLink, e.g. vsMJZfDD from trello.com/b/vsMJZfDD/...),
 * that board is fetched directly so the name does not need to match.
 */
export async function getCurrentProjectBoard(): Promise<TrelloBoard | null> {
  const q = authQuery();
  if (!q) return null;

  const boardIdFromEnv = process.env.TRELLO_BOARD_ID?.trim();
  if (boardIdFromEnv) {
    const url = `${TRELLO_BASE}/boards/${encodeURIComponent(boardIdFromEnv)}?${q}&fields=id,name,url`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const board = (await res.json()) as { id: string; name: string; url: string };
    return { id: board.id, name: board.name, url: board.url };
  }

  const url = `${TRELLO_BASE}/members/me/boards?${q}&fields=id,name,url`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const boards = (await res.json()) as Array<{ id: string; name: string; url: string }>;
  const board = boards.find((b) => CURRENT_PROJECT_BOARD_NAMES.includes(b.name));
  if (!board) return null;

  return { id: board.id, name: board.name, url: board.url };
}

/**
 * Returns lists (columns) for a board. Read-only GET.
 */
export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
  const q = authQuery();
  if (!q) return [];

  const url = `${TRELLO_BASE}/boards/${encodeURIComponent(boardId)}/lists?${q}&fields=id,name`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const lists = (await res.json()) as Array<{ id: string; name: string }>;
  return lists.map((l) => ({ id: l.id, name: l.name }));
}

/**
 * Returns a single list by id (id and name). Read-only GET.
 */
export async function getList(listId: string): Promise<TrelloList | null> {
  const q = authQuery();
  if (!q) return null;

  const url = `${TRELLO_BASE}/lists/${encodeURIComponent(listId)}?${q}&fields=id,name`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const list = (await res.json()) as { id: string; name: string };
  return { id: list.id, name: list.name };
}

/**
 * Returns cards for a board with attachments. Only image attachments are included.
 */
export async function getBoardCards(boardId: string): Promise<TrelloCard[]> {
  const q = authQuery();
  if (!q) return [];

  const url = `${TRELLO_BASE}/boards/${encodeURIComponent(boardId)}/cards?${q}&attachments=true&attachment_fields=id,name,url,date,mimeType,isUpload`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const cards = (await res.json()) as Array<{
    id: string;
    name: string;
    desc: string;
    shortUrl: string;
    url: string;
    dateLastActivity: string;
    idList: string;
    attachments?: Array<Record<string, unknown>>;
  }>;

  return cards.map((c) => {
    const attachments = (c.attachments ?? [])
      .map(normalizeAttachment)
      .filter(isImageAttachment);
    return {
      id: c.id,
      name: c.name,
      desc: c.desc ?? "",
      shortUrl: c.shortUrl,
      url: c.url,
      dateLastActivity: c.dateLastActivity ?? "",
      idList: c.idList,
      attachments,
    };
  });
}

/**
 * Returns cards for a single list with all attachments (images and documents).
 * Used by the list overview page for Daily Photos, Documents & renderings, and AI analysis.
 */
export async function getListCardsWithAllAttachments(listId: string): Promise<TrelloCard[]> {
  const q = authQuery();
  if (!q) return [];

  const url = `${TRELLO_BASE}/lists/${encodeURIComponent(listId)}/cards?${q}&attachments=true&attachment_fields=id,name,url,date,mimeType,isUpload`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const cards = (await res.json()) as Array<{
    id: string;
    name: string;
    desc: string;
    shortUrl: string;
    url: string;
    dateLastActivity: string;
    idList: string;
    attachments?: Array<Record<string, unknown>>;
  }>;

  return cards.map((c) => {
    const attachments = (c.attachments ?? []).map(normalizeAttachment);
    return {
      id: c.id,
      name: c.name,
      desc: c.desc ?? "",
      shortUrl: c.shortUrl,
      url: c.url,
      dateLastActivity: c.dateLastActivity ?? "",
      idList: c.idList,
      attachments,
    };
  });
}

/**
 * Returns attachments for a card. Only image attachments are included.
 */
export async function getCardAttachments(cardId: string): Promise<TrelloAttachment[]> {
  const q = authQuery();
  if (!q) return [];

  const url = `${TRELLO_BASE}/cards/${encodeURIComponent(cardId)}/attachments?${q}&fields=id,name,url,date,mimeType,isUpload`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const list = (await res.json()) as Array<Record<string, unknown>>;
  return list.map(normalizeAttachment).filter(isImageAttachment);
}

/**
 * Filter attachments to those whose date (ISO string) falls on the given date (YYYY-MM-DD).
 */
export function filterAttachmentsByDate(
  attachments: TrelloAttachment[],
  dateYmd: string
): TrelloAttachment[] {
  return attachments.filter((a) => {
    if (!a.date) return false;
    const d = a.date.slice(0, 10);
    return d === dateYmd;
  });
}

export function isTrelloConfigured(): boolean {
  return getAuthParams() != null;
}
