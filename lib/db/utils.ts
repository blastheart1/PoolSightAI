export function toDec(s: number | string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return String(s);
}
