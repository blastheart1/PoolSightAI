import {
  getCurrentProjectBoard,
  getBoardLists,
  getBoardCards,
  isTrelloConfigured,
} from "../../../../lib/trello";

export async function GET() {
  if (!isTrelloConfigured()) {
    return new Response(
      JSON.stringify({
        error: "Trello not configured",
        detail: "Set TRELLO_API_KEY and TRELLO_API_TOKEN in .env.local, then restart the dev server.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const board = await getCurrentProjectBoard();
  if (!board) {
    return new Response(
      JSON.stringify({
        error: "Current Project board not found",
        detail:
          "Set TRELLO_BOARD_ID in .env.local to your board id (e.g. vsMJZfDD from https://trello.com/b/vsMJZfDD/your-board-name). Restart the dev server after changing .env.local.",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const [lists, cards] = await Promise.all([
    getBoardLists(board.id),
    getBoardCards(board.id),
  ]);

  const cardPayload = (c: (typeof cards)[0]) => ({
    id: c.id,
    name: c.name,
    shortUrl: c.shortUrl,
    dateLastActivity: c.dateLastActivity,
    attachments: c.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      mimeType: a.mimeType,
      date: a.date,
    })),
  });

  const listsWithCards = lists.map((list) => ({
    id: list.id,
    name: list.name,
    cards: cards
      .filter((c) => c.idList === list.id)
      .map(cardPayload),
  }));

  return new Response(
    JSON.stringify({
      board: { id: board.id, name: board.name, url: board.url },
      lists: listsWithCards,
      cards: cards.map(cardPayload),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
