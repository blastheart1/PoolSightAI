import {
  getList,
  getListCardsWithAllAttachments,
  isTrelloConfigured,
  isImageAttachment,
} from "../../../../../lib/trello";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  if (!isTrelloConfigured()) {
    return new Response(
      JSON.stringify({
        error: "Trello not configured",
        detail: "Set TRELLO_API_KEY and TRELLO_API_TOKEN in .env.local.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { listId } = await params;
  if (!listId) {
    return new Response(JSON.stringify({ error: "listId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [list, cards] = await Promise.all([
    getList(listId),
    getListCardsWithAllAttachments(listId),
  ]);

  if (!list) {
    return new Response(
      JSON.stringify({ error: "List not found", listId }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = cards.map((c) => ({
    id: c.id,
    name: c.name,
    desc: c.desc,
    shortUrl: c.shortUrl,
    url: c.url,
    dateLastActivity: c.dateLastActivity,
    attachments: c.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      mimeType: a.mimeType,
      date: a.date,
      isImage: isImageAttachment(a),
    })),
  }));

  return new Response(
    JSON.stringify({
      list: { id: list.id, name: list.name },
      cards: payload,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
