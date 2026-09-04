import { BaseError, ContractFunctionRevertedError, formatEther, formatUnits } from "viem";

/**
 * Wallet errors, said plainly.
 *
 * Every one of these paths used to fail silently: `switchChainAsync` rejects when
 * someone declines the network prompt, and the rejection escaped an async onClick
 * handler as an unhandled promise — the button simply did nothing and the page said
 * nothing about why.
 *
 * The second failure was quieter and worse. This used to end in
 * `raw.split("\n")[0]`, and viem puts the interesting half of a contract revert on
 * the *second* line:
 *
 *     The contract function "register" reverted with the following reason:
 *     InsufficientPayment(...)
 *
 * So a failed mint reached the user as a sentence ending in a colon and nothing
 * after it. Reverts are now decoded by name — which needs the `error` entries in
 * `lib/contracts.ts`, without which viem only has a four-byte selector — and the
 * fallback never returns a line that trails off.
 */

const ETH = (wei: bigint) => `${formatEther(wei)} ETH`;
const USDG = (units: bigint) => `${formatUnits(units, 6)} USDG`;

/** A revert this app can explain, keyed by the error name in the ABI. */
function contractRevertMessage(name: string, args: readonly unknown[]): string | null {
  const arg = (i: number) => args[i];
  switch (name) {
    // ---- HoodfiRegistrar ----
    case "MintingPaused":
      return "Minting is paused right now. Try again shortly.";
    case "InvalidLabel":
      return `"${arg(0)}" isn't a usable name. Use lowercase letters, digits and hyphens only.`;
    case "LabelBlocked":
      return `"${arg(0)}" is reserved and can't be registered.`;
    case "ShortNameLocked":
      return `"${arg(0)}" is 1-3 characters, which stays reserved for donors holding short-name credits until the 100-year goal is reached.`;
    case "NotAShortName":
      return `"${arg(0)}" is 4 characters or longer, so it can't be claimed with a credit. Register it at the normal price instead.`;
    case "InsufficientPayment":
      return `The price moved while you were minting: it now costs ${ETH(
        arg(0) as bigint
      )} and the transaction offered ${ETH(arg(1) as bigint)}. Reload the page and try again.`;
    case "UsdcNotConfigured":
      return "Paying in USDG isn't switched on for the registrar. Pay in ETH instead.";
    case "NoCreditsLeft":
      return `You've spent all ${arg(0)} of your short-name credits. Donate more years to earn another.`;
    case "VoucherExpired":
      return "Your short-name credit expired before the transaction landed. Reload the page for a fresh one.";
    case "BadVoucher":
      return "Your short-name credit wasn't accepted. Reload the page to fetch a new one.";
    case "SignerNotConfigured":
      return "Short-name credits can't be verified at the moment. Try again shortly.";
    case "RefundFailed":
      return "Your wallet refused the refund of the overpayment, so the mint was rolled back.";

    // ---- L2Registry, reached through the registrar ----
    case "NotAvailable":
      return `"${arg(0)}" is already registered — someone may have taken it just now.`;
    case "LabelTooShort":
      return "That name is too short to register.";
    case "LabelTooLong":
      return `"${arg(0)}" is too long to register.`;
    case "Unauthorized":
      return "That name isn't owned by the connected wallet, so it can't be changed from here.";
    case "ERC721InvalidReceiver":
      return "Your wallet can't receive an NFT, and a hoodfi name is one. Mint from a wallet that accepts ERC-721 tokens.";

    // ---- USDG ----
    case "ERC20InsufficientBalance":
      return `Not enough USDG: the mint needs ${USDG(arg(2) as bigint)} and the wallet holds ${USDG(
        arg(1) as bigint
      )}.`;
    case "ERC20InsufficientAllowance":
      return `The registrar is approved for only ${USDG(
        arg(1) as bigint
      )} of USDG but needs ${USDG(arg(2) as bigint)}. Approve again and retry.`;

    // ---- HoodfiDonations ----
    case "AlreadyFinalized":
      return "The donation drive is closed.";
    case "GoalNotReached":
      return "The 100-year goal hasn't been reached yet.";
    case "InvalidYears":
      return "Choose at least one year to donate.";

    default:
      return null;
  }
}

/**
 * viem stacks the useful sentence on the line after a heading that ends in a colon.
 * Take the heading *with* its continuation, never the heading alone.
 */
function firstMeaningfulLine(raw: string): string {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "The transaction failed.";
  const [head, next] = lines;
  if (head.endsWith(":") && next) return `${head} ${next}`;
  return head;
}

/**
 * Replaces every URL with just its host.
 *
 * viem puts the transport URL into `details` and `metaMessages` on most errors, and the
 * mainnet transport carries an Alchemy key in its path. Logging a raw viem error would
 * therefore print that key into the console of every person it happened to. The host is
 * the useful half for diagnosis and carries no secret.
 */
function redactUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s"'`)\]]+/gi, (url) => {
    try {
      return `<${new URL(url).host}>`;
    } catch {
      return "<url>";
    }
  });
}

/**
 * A structured, redacted view of a wallet error, for the console.
 *
 * `walletErrorMessage` deliberately throws away everything except a sentence, which is
 * right for the page and wrong for diagnosis: a mint that failed on 2026-09-04 rendered
 * as "add Robinhood Chain manually", and the real exception — never seen, because nothing
 * kept it — sent the investigation through a CORS theory, a proxy worker and most of a
 * day before anyone could say what had actually been thrown. This keeps the original
 * where support can read it, without putting a key in anyone's console.
 */
export function describeWalletError(error: unknown): Record<string, string> {
  const e = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
    details?: unknown;
    cause?: { name?: unknown; message?: unknown };
  } | null;

  const out: Record<string, string> = { name: String(e?.name ?? typeof error) };
  const put = (key: string, value: unknown, limit = 400) => {
    if (value === undefined || value === null || value === "") return;
    out[key] = redactUrls(String(value)).slice(0, limit);
  };

  put("code", e?.code, 40);
  put("shortMessage", e?.shortMessage);
  put("details", e?.details);
  put("causeName", e?.cause?.name, 80);
  put("causeMessage", e?.cause?.message);
  // Last, and longest: the full message often repeats the above, but when a wrapper
  // carries no shortMessage it is the only thing that says what happened.
  put("message", e?.message, 800);
  return out;
}

export function walletErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/user rejected|user denied|rejected the request|\b4001\b/i.test(raw)) {
    return "Request declined in your wallet.";
  }
  if (/chain|network/i.test(raw) && /unrecognized|unsupported|not configured|add/i.test(raw)) {
    return "Your wallet couldn't switch to Robinhood Chain. Add it manually (chain id 4663) and try again.";
  }
  // A named revert beats any prose viem assembles around it, and beats the funds
  // check below: a contract that says why it refused is more use than a guess at
  // the balance.
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name) {
        const said = contractRevertMessage(name, revert.data?.args ?? []);
        if (said) return said;
        return `The transaction was rejected by the contract (${name}).`;
      }
      // Undecodable — an error the ABI doesn't carry. Say the selector rather than
      // the empty heading viem leads with, so the failure is at least reportable.
      const selector = /0x[0-9a-f]{8}/i.exec(revert.message)?.[0];
      if (selector) {
        return `The contract rejected the transaction with an unrecognised error (${selector}).`;
      }
      // No revert payload at all. Some wallets — Brave among them — drop the data
      // on the floor and hand the page a bare sentence, so that sentence is every
      // clue there is. Do not swallow it.
      const reason = revert.reason?.trim();
      if (reason && !/^execution reverted\.?$/i.test(reason)) return reason;
      return "The contract rejected the transaction and your wallet didn't say why.";
    }
  }

  if (/insufficient funds/i.test(raw)) {
    return "Not enough ETH on Robinhood Chain to cover this transaction.";
  }

  if (error instanceof BaseError && error.shortMessage) {
    return firstMeaningfulLine(error.shortMessage);
  }
  return firstMeaningfulLine(raw);
}
