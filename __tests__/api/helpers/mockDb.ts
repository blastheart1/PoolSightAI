/**
 * Drizzle ORM chainable mock.
 *
 * Every awaitable step in the chain (where, orderBy, returning, bare values(),
 * set().where(), delete().where()) flows through `querySpy`. Tests configure
 * return values with `mockResolvedValueOnce` or the helper shortcuts below.
 *
 * Design rule: `where()` / `orderBy()` / `values()` / `returning()` are LAZY
 * — they return a thenable object, not a Promise. The Promise is created only
 * when the consumer does `await` (or calls `.then()`). This lets us count each
 * `await` as exactly ONE querySpy call regardless of intermediate chain steps.
 */

import { vi } from "vitest";

export const querySpy = vi.fn<[], Promise<unknown>>();

/** Returns an object that looks like a Promise to `await` and also exposes
 *  the next chain methods Drizzle users typically reach for. */
function thenable(nextSteps?: Record<string, unknown>): Record<string, unknown> {
  const invoke = () => querySpy();

  return {
    // Make this awaitable
    then:    (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => invoke().then(res, rej),
    catch:   (rej: (e: unknown) => unknown) => invoke().catch(rej),
    finally: (cb: () => void) => invoke().finally(cb),
    // Common next steps
    orderBy: () => thenable(),       // .where().orderBy()
    returning: () => thenable(),     // .values().returning()
    ...nextSteps,
  };
}

function buildChain(): Record<string, unknown> {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    from:    () => chain,
    where:   () => thenable({ orderBy: () => thenable() }),
    orderBy: () => thenable({ where: () => thenable() }),
    values:  () => thenable({ returning: () => thenable() }),
    set:     () => ({ where: () => thenable() }),
  };
  return chain;
}

export const mockDb = {
  select:  (): unknown => buildChain(),
  insert:  (): unknown => buildChain(),
  update:  (): unknown => buildChain(),
  delete:  (): unknown => ({ where: () => thenable() }),

  // ── Test helpers ───────────────────────────────────────────────────────────

  /** Reset all spy state. Call in beforeEach. */
  __reset() {
    querySpy.mockReset();
    querySpy.mockResolvedValue([]); // safe default
  },

  /** Queue result values in order — one per awaited query in the route. */
  __queue(...results: unknown[]) {
    for (const r of results) querySpy.mockResolvedValueOnce(r);
  },
};
