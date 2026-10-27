/**
 * The name another page hands to /mint in the query string.
 *
 * Two spellings arrive here. The home page sends `?q=` after a visitor connects. The
 * embeddable widget (`widget/dist/widget.js`, `buildUrl`) sends `?label=`, beside
 * `?partner=` — and that one is already embedded on partners' sites and copied into
 * their own static folders, so /mint has to accept it rather than the widget changing.
 * `q` wins when both are present.
 */
export function handoffName(search: string): string {
  const params = new URLSearchParams(search);
  return params.get("q") ?? params.get("label") ?? "";
}
