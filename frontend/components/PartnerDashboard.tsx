"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, isAddress } from "viem";

import { robinhoodChain } from "@/lib/chains";
import {
  PARTNER_ROUTER_ADDRESS,
  ZERO_ADDRESS,
  partnerRouterAbi,
} from "@/lib/contracts";
import { PARTNER_SALES_URL, WIDGET_DOCS_URL } from "@/lib/site";
import { useWriteContractCompat } from "@/lib/useWriteContractCompat";
import { walletErrorMessage } from "@/lib/errors";
import { ArrowNE } from "./ArrowNE";

type Sale = {
  label: string;
  buyer: string;
  pricePaid: string;
  baseFee: string;
  partnerShare: string;
  txHash: string;
  blockNumber: string;
};
type SalesPayload = {
  sales: Sale[];
  totals: { count: number; gross: string; earned: string };
};

const EXPLORER = "https://robinhoodchain.blockscout.com";

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** USDG is 6dp everywhere in this contract. One place converts, so nothing drifts. */
function usdg(raw: bigint | string | undefined): string {
  if (raw === undefined) return "—";
  return (Number(BigInt(raw)) / 1e6).toFixed(2);
}

function toUsdg(input: string): bigint | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return null;
  // Round rather than truncate: "9.999" entered by hand should not silently become 9.99.
  return BigInt(Math.round(n * 1e6));
}

export function PartnerDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { open } = useAppKit();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending } = useWriteContractCompat();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SalesPayload | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Settings form
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");
  const [payout, setPayout] = useState("");
  const [confirmPayout, setConfirmPayout] = useState(false);

  // Embed builder
  const [accent, setAccent] = useState("#c6f702");
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [copied, setCopied] = useState(false);

  const configured = Boolean(PARTNER_ROUTER_ADDRESS);

  const { data: info, refetch: refetchInfo } = useReadContract({
    address: PARTNER_ROUTER_ADDRESS,
    abi: partnerRouterAbi,
    functionName: "partnerInfo",
    args: [address ?? ZERO_ADDRESS],
    chainId: robinhoodChain.id,
    query: { enabled: configured && Boolean(address) },
  });

  /**
   * What this wallet can actually withdraw.
   *
   * Read straight from `earnings`, not from `partnerInfo(...).accrued`. Those are not the
   * same thing: partnerInfo reports what is owed to *that partner's payout address*, so a
   * payout address connecting to collect its own money read zero and found the Withdraw
   * button disabled — the one wallet that could withdraw was the one told it had nothing.
   * `withdraw()` spends `earnings[msg.sender]`, so that is the number to show.
   */
  const { data: withdrawable, refetch: refetchEarnings } = useReadContract({
    address: PARTNER_ROUTER_ADDRESS,
    abi: partnerRouterAbi,
    functionName: "earnings",
    args: [address ?? ZERO_ADDRESS],
    chainId: robinhoodChain.id,
    query: { enabled: configured && Boolean(address), refetchInterval: 15_000 },
  });

  const currentPrice = info?.[0];
  const currentName = info?.[1];
  const currentPayout = info?.[2];
  const baseFee = info?.[3];
  const accrued = info?.[4];
  const active = (currentPrice ?? 0n) > 0n;

  // Seed the form from chain once, so an existing partner edits rather than retypes.
  useEffect(() => {
    if (currentPrice === undefined) return;
    if (currentPrice > 0n) {
      setPrice(usdg(currentPrice));
      setName(currentName ?? "");
      setPayout(currentPayout && currentPayout !== ZERO_ADDRESS ? currentPayout : "");
    } else if (address) {
      // A first-time partner almost always wants paying where they already are.
      setPayout((p) => p || address);
    }
  }, [currentPrice, currentName, currentPayout, address]);

  // Sales come from the gateway: the browser cannot read Robinhood Chain logs itself.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setSalesError(null);
    fetch(`${PARTNER_SALES_URL}/${address}/sales`)
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          // Never render zero rows on a failure — "no sales yet" is the believable lie.
          setSalesError(json?.message ?? "Could not load sales");
          return;
        }
        setSales(json);
      })
      .catch(() => {
        if (!cancelled) setSalesError("Could not reach the sales service");
      });
    return () => {
      cancelled = true;
    };
  }, [address, receipt.isSuccess]);

  useEffect(() => {
    if (receipt.isSuccess) {
      void refetchInfo();
      void refetchEarnings();
      setConfirmPayout(false);
    }
  }, [receipt.isSuccess, refetchInfo, refetchEarnings]);

  /**
   * Earned here, but payable elsewhere.
   *
   * `withdrawable` is what the connected wallet can pull; `accrued` is what this listing
   * has earned and not yet collected, which sits against its payout address. When those
   * are different wallets the managing key saw "$1.00 earned, lifetime" above "$0.00
   * ready to withdraw" — both true, and together they read as money that went missing.
   * Show the balance where it was earned and say which wallet collects it.
   */
  const payoutElsewhere =
    active &&
    Boolean(currentPayout) &&
    Boolean(address) &&
    currentPayout !== ZERO_ADDRESS &&
    getAddress(currentPayout as string) !== getAddress(address as string);

  const payoutChanged =
    isAddress(payout) &&
    currentPayout !== undefined &&
    getAddress(payout) !== getAddress(currentPayout === ZERO_ADDRESS ? payout : currentPayout);

  const priceWei = toUsdg(price);
  const priceTooLow =
    priceWei !== null && baseFee !== undefined && priceWei > 0n && priceWei < baseFee;

  const canSave =
    isConnected &&
    priceWei !== null &&
    !priceTooLow &&
    isAddress(payout) &&
    (!payoutChanged || confirmPayout);

  async function ensureChain() {
    if (!isConnected) {
      open();
      return false;
    }
    if (chainId !== robinhoodChain.id) {
      await switchChainAsync({ chainId: robinhoodChain.id });
    }
    return true;
  }

  async function save() {
    setError(null);
    if (!PARTNER_ROUTER_ADDRESS || priceWei === null || !isAddress(payout)) return;
    try {
      if (!(await ensureChain())) return;
      await writeContractAsync({
        address: PARTNER_ROUTER_ADDRESS,
        abi: partnerRouterAbi,
        functionName: "setPartner",
        // Checksum a pasted address rather than trusting its casing.
        args: [priceWei, name, getAddress(payout)],
        chainId: robinhoodChain.id,
      });
    } catch (e) {
      setError(walletErrorMessage(e));
    }
  }

  /** Price 0 takes the widget offline; earnings already credited stay withdrawable. */
  async function deactivate() {
    setError(null);
    if (!PARTNER_ROUTER_ADDRESS || !isAddress(payout)) return;
    try {
      if (!(await ensureChain())) return;
      await writeContractAsync({
        address: PARTNER_ROUTER_ADDRESS,
        abi: partnerRouterAbi,
        functionName: "setPartner",
        args: [0n, name, getAddress(payout)],
        chainId: robinhoodChain.id,
      });
      setPrice("0");
    } catch (e) {
      setError(walletErrorMessage(e));
    }
  }

  async function withdraw() {
    setError(null);
    if (!PARTNER_ROUTER_ADDRESS) return;
    try {
      if (!(await ensureChain())) return;
      await writeContractAsync({
        address: PARTNER_ROUTER_ADDRESS,
        abi: partnerRouterAbi,
        functionName: "withdraw",
        args: [],
        chainId: robinhoodChain.id,
      });
    } catch (e) {
      setError(walletErrorMessage(e));
    }
  }

  const snippet = useMemo(() => {
    const lines = [
      "<script",
      '  src="https://unpkg.com/@hoodfi/widget/dist/widget.js"',
      `  data-partner="${address ?? "0xYourWallet"}"`,
    ];
    if (accent.toLowerCase() !== "#c6f702") lines.push(`  data-accent="${accent}"`);
    if (theme !== "auto") lines.push(`  data-theme="${theme}"`);
    if (active) lines.push(`  data-price="$${usdg(currentPrice)}"`);
    lines.push("></script>");
    return lines.join("\n");
  }, [address, accent, theme, active, currentPrice]);

  function copySnippet() {
    navigator.clipboard?.writeText(snippet).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false)
    );
  }

  function downloadCsv() {
    if (!sales?.sales.length) return;
    const rows = [
      ["name", "buyer", "price_usdg", "base_fee_usdg", "your_share_usdg", "tx"],
      ...sales.sales.map((s) => [
        `${s.label}.hoodfi.eth`,
        s.buyer,
        usdg(s.pricePaid),
        usdg(s.baseFee),
        usdg(s.partnerShare),
        s.txHash,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoodfi-sales-${address}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!configured) {
    return (
      <p className="lede max-w-[52ch]">
        The partner router isn&apos;t configured on this deployment yet.
      </p>
    );
  }

  if (!isConnected) {
    return (
      <div className="panel p-8">
        <div className="label">connect to continue</div>
        <p className="lede mt-4 max-w-[46ch]">
          Your dashboard is keyed to your wallet. Nothing here is stored by us — the price,
          the payout address and every sale live on the router.
        </p>
        <button className="btn btn-ink btn-lg mt-6" onClick={() => open()} type="button">
          Connect Wallet <ArrowNE />
        </button>
      </div>
    );
  }

  const busy = isPending || receipt.isLoading;

  return (
    <div className="flex flex-col gap-12">
      {/* ── earnings ─────────────────────────────────────────────── */}
      <section>
        <div className="eyebrow">01 / your earnings</div>
        {/* Sales are indexed by the managing key, so a payout address has none of its own.
            Showing it "0 names sold" beside a real balance reads as a contradiction rather
            than as the two halves of one arrangement, so those cells only appear for the
            wallet they are actually about. */}
        <div className="cells mt-8 border-l border-t border-[var(--line)]">
          <Cell
            label={payoutElsewhere ? "earned, not yet collected" : "ready to withdraw"}
            value={`$${usdg(payoutElsewhere ? accrued : withdrawable)}`}
            note={
              payoutElsewhere
                ? `held for ${shortAddr(currentPayout as string)} — connect that wallet to withdraw`
                : undefined
            }
          />
          {active && (
            <>
              <Cell label="names sold" value={sales ? String(sales.totals.count) : "—"} />
              <Cell
                label="earned, lifetime"
                value={sales ? `$${usdg(sales.totals.earned)}` : "—"}
              />
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="btn btn-ink btn-sm"
            onClick={withdraw}
            disabled={busy || (withdrawable ?? 0n) === 0n}
            type="button"
          >
            {busy ? "Confirm in wallet…" : "Withdraw USDG"}
          </button>
          {(withdrawable ?? 0n) === 0n &&
            (payoutElsewhere ? (
              <span className="data text-[12px] text-[var(--dim)]">
                payable to{" "}
                <a
                  className="link"
                  href={`${EXPLORER}/address/${currentPayout}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {currentPayout}
                </a>
              </span>
            ) : (
              <span className="data text-[12px] text-[var(--dim)]">
                nothing owed right now
              </span>
            ))}
        </div>
      </section>

      {/* ── settings ─────────────────────────────────────────────── */}
      <section>
        <div className="eyebrow">02 / your listing</div>
        {/* Two roles, one contract: the key that manages the listing and the address the
            money goes to are deliberately allowed to differ. Connecting as the latter and
            being shown an empty listing reads as data loss unless it says otherwise. */}
        {!active && (withdrawable ?? 0n) > 0n && (
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[var(--dim)]">
            This wallet is a payout address: it has ${usdg(withdrawable)} to collect above
            and can withdraw it here, but it does not own a listing. Sales and the embed
            belong to whichever wallet called <span className="data">setPartner</span> —
            connect that one to see them or to change the price.
          </p>
        )}
        <h2 className="h-sub mt-4">
          {active ? "Update your price" : "Set your price to go live"}
        </h2>
        <div className="mt-6 grid max-w-[640px] gap-5">
          <Field
            label={`your price in USD${baseFee !== undefined ? ` · minimum $${usdg(baseFee)}` : ""}`}
            value={price}
            onChange={setPrice}
            placeholder="10.00"
            inputMode="decimal"
          />
          {priceTooLow && (
            <p className="data text-[12px] text-[var(--status-bad)]">
              below the base fee — the router would reject it
            </p>
          )}
          <Field
            label="display name"
            value={name}
            onChange={setName}
            placeholder="Your Platform"
          />
          <Field
            label="payout address"
            value={payout}
            onChange={(v) => {
              setPayout(v);
              setConfirmPayout(false);
            }}
            placeholder="0x…"
            mono
          />
          {payout && !isAddress(payout) && (
            <p className="data text-[12px] text-[var(--status-bad)]">not an address</p>
          )}
          {/* A wrong payout address sends every future margin somewhere unrecoverable, so
              changing it takes a deliberate second action rather than a single keystroke. */}
          {payoutChanged && isAddress(payout) && (
            <label className="flex items-start gap-3 border border-[var(--line)] p-4">
              <input
                type="checkbox"
                checked={confirmPayout}
                onChange={(e) => setConfirmPayout(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm leading-relaxed text-[var(--dim)]">
                I have checked this address. Every future payout goes here, and a wrong
                address cannot be recovered.
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn btn-lime btn-sm"
              onClick={save}
              disabled={!canSave || busy}
              type="button"
            >
              {busy ? "Confirm in wallet…" : active ? "Save changes" : "Go live"}
            </button>
            {active && (
              // Deactivates in one action. Filling the field with 0 and leaving the user
              // to notice they must still press Save is the "looks done but isn't" shape
              // — and the version of it that quietly keeps selling.
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void deactivate()}
                disabled={busy}
                type="button"
              >
                Deactivate
              </button>
            )}
          </div>
          <p className="text-sm leading-relaxed text-[var(--dim)]">
            Setting the price to 0 takes your widget offline. Earnings already credited stay
            withdrawable.
          </p>
        </div>
      </section>

      {/* ── embed ────────────────────────────────────────────────── */}
      <section>
        <div className="eyebrow">03 / your embed</div>
        <h2 className="h-sub mt-4">Paste this where you want it.</h2>
        <div className="duo mt-7 items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2.5">
                <span className="label">accent</span>
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-8 w-12 cursor-pointer border border-[var(--line)] bg-transparent"
                  aria-label="Accent colour"
                />
              </label>
              <label className="flex items-center gap-2.5">
                <span className="label">theme</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as typeof theme)}
                  className="data border border-[var(--line)] bg-transparent px-2.5 py-1.5 text-[12px]"
                >
                  <option value="auto">auto</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
              </label>
            </div>
            <pre className="panel panel-ink on-ink data mt-5 overflow-x-auto p-5 text-[12.5px] leading-[1.75] text-[var(--fg)]">
              <code>{snippet}</code>
            </pre>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button className="btn btn-ink btn-sm" onClick={copySnippet} type="button">
                {copied ? "Copied" : "Copy snippet"}
              </button>
              <a
                href={`/mint/?partner=${address}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
              >
                Open my checkout <ArrowNE />
              </a>
              <a
                href={WIDGET_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
              >
                All options <ArrowNE />
              </a>
            </div>
            {!active && (
              <p className="data mt-4 text-[12px] text-[var(--status-warn)]">
                set a price above before embedding — until then the widget has nothing to sell
              </p>
            )}
          </div>
          <WidgetPreview accent={accent} theme={theme} address={address} />
        </div>
      </section>

      {/* ── sales ────────────────────────────────────────────────── */}
      <section className={active ? "" : "hidden"}>
        <div className="eyebrow">04 / your sales</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-sub m-0">
            {sales ? `${sales.totals.count} sold` : "Loading…"}
          </h2>
          {Boolean(sales?.sales.length) && (
            <button className="btn btn-ghost btn-sm" onClick={downloadCsv} type="button">
              Download CSV
            </button>
          )}
        </div>
        {salesError ? (
          <p className="data mt-5 text-[12px] text-[var(--status-bad)]">{salesError}</p>
        ) : sales && sales.sales.length === 0 ? (
          <p className="mt-5 max-w-[60ch] text-sm leading-relaxed text-[var(--dim)]">
            Nothing yet. Every sale through your widget appears here, and on the explorer —
            these rows are read from the router&apos;s own logs, not from a database of ours.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="data border-b border-[var(--line)] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--label)]">
                  <th className="py-3 pr-4 font-normal">name</th>
                  <th className="py-3 pr-4 font-normal">paid</th>
                  <th className="py-3 pr-4 font-normal">your share</th>
                  <th className="py-3 font-normal">tx</th>
                </tr>
              </thead>
              <tbody>
                {sales?.sales
                  .slice()
                  .reverse()
                  .map((s) => (
                    <tr key={s.txHash} className="border-b border-[var(--line)]">
                      <td className="py-3 pr-4">{s.label}.hoodfi.eth</td>
                      <td className="data py-3 pr-4">${usdg(s.pricePaid)}</td>
                      <td className="data py-3 pr-4">${usdg(s.partnerShare)}</td>
                      <td className="py-3">
                        <a
                          className="link data text-[12px]"
                          href={`${EXPLORER}/tx/${s.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.txHash.slice(0, 10)}…
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && <p className="data text-[12px] text-[var(--status-bad)]">{error}</p>}
      {receipt.isSuccess && (
        <p className="data text-[12px] text-[var(--status-ok)]">saved on-chain</p>
      )}
    </div>
  );
}

function Cell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex-[1_1_200px] border-b border-r border-[var(--line)] p-7">
      <div className="label">{label}</div>
      <div className="mt-3 text-[clamp(26px,4vw,38px)] font-bold leading-none tracking-[-0.02em]">
        {value}
      </div>
      {note && (
        <div className="data mt-3 text-[11.5px] leading-[1.5] text-[var(--dim)]">{note}</div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal";
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className={`mt-2 w-full border border-[var(--line)] bg-transparent px-4 py-3 text-[var(--fg)] outline-none focus:border-[var(--accent)] ${mono ? "data text-[13px]" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        spellCheck={false}
      />
    </label>
  );
}

/**
 * The real widget, mounted from unpkg — not a mock of it.
 *
 * A hand-drawn preview is a second implementation that drifts from the published package
 * the first time either changes, and the whole point of this panel is that a partner sees
 * what their visitors will see before they paste anything.
 */
function WidgetPreview({
  accent,
  theme,
  address,
}: {
  accent: string;
  theme: string;
  address?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = "hoodfi-widget-script";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "https://unpkg.com/@hoodfi/widget/dist/widget.js";
    s.onerror = () => setFailed(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const slot = document.getElementById("hoodfi-widget-preview");
    const api = (window as unknown as { HoodFiWidget?: { mount: (el: Element, o: object) => void } })
      .HoodFiWidget;
    if (!slot) return;
    slot.replaceChildren();
    if (!api || !address) return;
    try {
      api.mount(slot, { partner: address, accent, theme });
    } catch {
      setFailed(true);
    }
  }, [accent, theme, address]);

  return (
    <div className="min-w-0">
      <div className="label mb-3">live preview</div>
      {failed ? (
        <p className="data text-[12px] text-[var(--dim)]">
          preview unavailable — the snippet is still correct
        </p>
      ) : (
        <div id="hoodfi-widget-preview" />
      )}
    </div>
  );
}
