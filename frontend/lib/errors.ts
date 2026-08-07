/**
 * Wallet errors, said plainly.
 *
 * Every one of these paths used to fail silently: `switchChainAsync` rejects when
 * someone declines the network prompt, and the rejection escaped an async onClick
 * handler as an unhandled promise — the button simply did nothing and the page said
 * nothing about why.
 */
export function walletErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/user rejected|user denied|rejected the request|\b4001\b/i.test(raw)) {
    return "Request declined in your wallet.";
  }
  if (/chain|network/i.test(raw) && /unrecognized|unsupported|not configured|add/i.test(raw)) {
    return "Your wallet couldn't switch to Robinhood Chain. Add it manually (chain id 4663) and try again.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Not enough ETH on Robinhood Chain to cover this transaction.";
  }
  return raw.split("\n")[0];
}
