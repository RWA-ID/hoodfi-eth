/**
 * TEMPORARY — delete when Reown fixes `eth_chainId` in the embedded wallet.
 *
 * An email or social login cannot send a transaction on Robinhood Chain. The mint fails
 * with `ContractFunctionExecutionError: An unknown error occurred`, whose real cause is
 *
 *     TypeError: Cannot convert eip155:4663 to a BigInt
 *
 * AppKit's auth connector builds its provider with the CAIP-2 *string*:
 *
 *     chainId: getActiveCaipNetwork()?.caipNetworkId     // "eip155:4663"
 *
 * the frame echoes it back, and W3mFrameProvider.setLastUsedChainId stores it verbatim —
 * `String(chainId)`, with no check that it is a number. From then on
 * `provider.request({ method: 'eth_chainId' })` returns that same string, because the
 * provider answers GET_CHAIN_ID straight from storage. viem then calls BigInt() on it and
 * throws. Reads are unaffected: they go through our own transport with a numeric id, so
 * only signing breaks, which is why login and lookups look perfectly healthy.
 *
 * `eth_chainId` is specified to return a hex quantity, so a CAIP-2 identifier there is an
 * EIP-1193 violation, not a preference. Verified on www.hoodfi.name 2026-09-04:
 * localStorage held "eip155:4663" and `BigInt(that)` threw the exact message above.
 *
 * Rewriting the key to the bare chain id is enough — `BigInt("4663")` is valid, and that
 * is the form the same key holds when the flow happens to work. This is AppKit's private
 * storage, so treat it as a splint: it is scoped to the one key, only ever narrows a
 * CAIP-2 eip155 id to the number already inside it, and is safe to delete outright.
 */

const LAST_USED_CHAIN_KEY = "@appkit-wallet/LAST_USED_CHAIN_KEY";
const EIP155_PREFIX = "eip155:";

/**
 * Narrows the embedded wallet's stored chain id from `eip155:N` to `N`.
 *
 * Call before anything that signs. AppKit rewrites this key on every connect and user
 * fetch, so normalising once at startup is not enough — it comes back.
 */
export function normalizeAuthChainId(): void {
  try {
    const raw = window.localStorage.getItem(LAST_USED_CHAIN_KEY);
    // Only the eip155 CAIP form is touched. A bare number is already correct, and any
    // other namespace belongs to a chain this app does not serve — leave both alone.
    if (!raw?.startsWith(EIP155_PREFIX)) return;

    const id = raw.slice(EIP155_PREFIX.length);
    if (!/^\d+$/.test(id)) return;

    window.localStorage.setItem(LAST_USED_CHAIN_KEY, id);
  } catch {
    // Private mode, or storage refused. The mint fails the same way it does today;
    // nothing here is worth throwing over.
  }
}
