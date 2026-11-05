export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Keep the first value of each search param. */
export function flattenSearchParams(sp: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) out[key] = v;
  }
  return out;
}
