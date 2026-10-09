# @hoodfi/widget

Sell `*.hoodfi.eth` names from your own site, at your own price, and keep the margin.

Your users get a real ENS name on Robinhood Chain. You set the price; the difference
between it and the base fee accrues to you on-chain and you withdraw whenever you like.
No approval from us, no revenue-share agreement, no integration call.

**Names of 4 characters and up only.** Names of 1–3 characters are reserved for the donors
funding hoodfi.eth's registration and cannot be sold through a partner — the router rejects
them, and it will keep rejecting them even after those tiers open to the public.

## 1. Set your price

| | |
| --- | --- |
| `HoodfiPartnerRouter` | `0xb7bd5f2c7c445ddc5d55ebd9b8f6a20c2e6e4b5d` |
| Chain | Robinhood Chain (`4663`) |
| Payment token | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

Call `setPartner` once, from the wallet you want to manage the integration with:

```solidity
router.setPartner(
  10_000_000,        // your price in USDG (6 decimals) — 10_000_000 = $10.00
  "Your Platform",   // display name
  0xYourTreasury     // where your margin accrues — can be a Safe, not the managing key
);
```

Your price must be at least the base fee. `router.partnerInfo(you)` returns it alongside
your own settings, and `router.quote(label, you)` answers for one specific name — including
whether it can be sold at all. Read the fee rather than hardcoding it: it lives on the
registrar and this contract forwards whatever it says.

Setting the price to `0` deactivates the integration without touching money already earned.

## 2. Embed

```html
<script
  src="https://unpkg.com/@hoodfi/widget/dist/widget.js"
  data-partner="0xYourManagingWallet"
  data-accent="#ff6a00"
  data-price="$10"
></script>
```

That renders the full registration panel — the same design as the HoodFi homepage, with a
light/dark toggle the visitor can flip. It lives in a shadow root, so your site's CSS
cannot leak into it and its styles cannot leak out.

| attribute      | default                         | notes                                          |
| -------------- | ------------------------------- | ---------------------------------------------- |
| `data-partner` | — (required)                    | The address you called `setPartner` from       |
| `data-accent`  | `#c6f702`                       | Any hex. Contrast is derived, see below        |
| `data-theme`   | `auto`                          | `auto` follows the visitor's OS, or `light`/`dark` |
| `data-price`   | —                               | What you charge, e.g. `$10`. Shown as a dash if omitted |
| `data-mode`    | `card`                          | `button` for a plain button, `inline` for an iframe |
| `data-label`   | —                               | Pre-fill the name box                          |
| `data-text`    | auto                            | Override the CTA label                         |
| `data-eyebrow` | `Check a name`                  | Override the heading                           |
| `data-target`  | the script's parent             | CSS selector to mount into                     |
| `data-fonts`   | `true`                          | `false` skips the Google Fonts import          |
| `data-url`     | `https://www.hoodfi.name/mint/` | Override the origin                            |

### Accent colours

Give it your brand colour and it derives the rest. Text placed *on* the accent is picked as
black or white by luminance, and the accent used *as* text is walked toward the background
until it clears 4.5:1 — so a pale accent stays readable on the light theme instead of
vanishing, and a dark one stays readable on the dark theme. You supply one colour, not five.

Or mount it yourself:

```js
HoodFiWidget.mount(document.querySelector("#slot"), {
  partner: "0xYourManagingWallet",
  accent: "#2563eb",
  theme: "dark",
  price: "$10",
});
```

### Headless — the mode to use if you have a wallet

**If your site already connects a wallet, use this one.** Sending a signed-in visitor to
hoodfi.name to connect a second wallet is where most of them stop. Pass `onSubmit`
and the widget stops being a link: it keeps the card, the charset rules and the 4+
character floor, and hands you the name to buy with your own signer.

```js
HoodFiWidget.mount(el, {
  partner: "0xYourManagingWallet",
  connected: Boolean(account),              // you own the wallet state
  onConnect: () => openYourWalletModal(),
  onCheck: async (label) => {               // your RPC answers availability
    const [, , sellable] = await read(router, "quote", [label, partner]);
    return { sellable, reason: sellable ? undefined : "already taken" };
  },
  onSubmit: async ({ label }) => {          // TWO transactions, your signer
    // 1. Approve USDG, only if the allowance is short, and wait until it is ON-CHAIN:
    //    registerViaPartner pulls the USDG, so sending it early just reverts.
    const covered = async () => (await read(usdg, "allowance", [account, router])) >= price;
    if (!(await covered())) {
      await untilOnChain(() => write(usdg, "approve", [router, price]), covered);
    }
    // 2. Register, done when the buyer owns the name.
    await untilOnChain(() => write(router, "registerViaPartner", [label, partner]),
                       () => owns(label, account));
  },
});
```

A purchase is **two wallet prompts** for a buyer with no allowance yet, and one for a buyer
who already has one. Read [the two-transaction notes](#a-purchase-is-two-transactions--say-so)
before you ship.

`mount` returns `{ update, destroy }`. Call `update({ connected: true })` when a wallet
connects rather than remounting — an update carries the half-typed name across.

`onSubmit` rejecting shows the error on the card; resolving shows the name as claimed. A
thrown `shortMessage` (viem) is used when present.

### Payment

Partner sales settle in **USDG**. The homepage offers ETH as well, but a partner price is
stored in USDG and a wei price would drift against it, so the router has no ETH path and the
panel states the method rather than offering a choice.

## 3. Get paid

Margin accrues to the payout address you set. Withdraw it in USDG at any time:

```solidity
router.withdraw();   // called from the payout address
```

It is a pull-payment, so a payout address that reverts on receipt can never block a sale.

## Things that will bite you

Every one of these came out of the first real integration. None is visible from the API.

### A purchase is two transactions — say so

The buyer approves USDG to the router, then confirms `registerViaPartner`. While
`onSubmit` runs, the card's button reads **"Confirm in wallet…"** for the whole flow; the
widget cannot tell which prompt is open. A second prompt nobody mentioned reads as a
repeat, or as the first one having failed, and people reject it.

Show the step yourself, **outside the card**:

```
Step 1 of 2 · Approve USDG in your wallet
Step 2 of 2 · Confirm the registration in your wallet
```

Drop the "of 2" when the allowance already covers the price — that buyer only gets step 2.

Do **not** call `handle.update()` while `onSubmit` is pending. An update re-renders the
card and resets its busy state, so the button comes back live mid-purchase and invites a
second click. Keep the step in your own UI and update the card once `onSubmit` settles.

### A wallet that signed may never answer — settle from the chain

The widget waits on your `onSubmit` promise with **no timeout**. If that promise never
settles, the card sits on "Confirm in wallet…" forever.

That happens after a *successful* signature. Over WalletConnect the reply travels back
over a relay; if the socket drops between the wallet signing and the reply arriving
(backgrounded tab, phone asleep), the wallet has broadcast the transaction but
`writeContract` never resolves. Our first live partner sale did exactly this: the approval
was mined, the registration was never prompted, and no USDG was spent.

So don't make each step depend only on the wallet's reply. Race the send against a poll of
the state the step is meant to produce, and let whichever proves it first win:

```js
function untilOnChain(send, done, ms = 180_000) {
  return new Promise((resolve, reject) => {
    const finish = (err) => { clearInterval(poll); clearTimeout(timer); err ? reject(err) : resolve(); };
    const poll = setInterval(() => done().then((ok) => ok && finish(), () => {}), 3000);
    const timer = setTimeout(() => finish(new Error(
      "Still waiting on Robinhood Chain — it may still land. Check back before trying again.")), ms);
    send().then(async (hash) => {
      const r = await client.waitForTransactionReceipt({ hash, timeout: ms }).catch(() => null);
      if (r && r.status !== "success") finish(new Error("The transaction reverted"));
    }, finish);                    // a rejection in the wallet still rejects
  });
}
```

The `done` checks are **allowance ≥ price** for step 1 and **`ownerOf` = buyer** for
step 2. Both are already wired up in the headless example above.

A timeout is not a failure. The transaction may still be in the mempool, so say it may
still land rather than "payment failed", which is how somebody pays twice. A retry is safe
either way: an approval that landed is skipped by the allowance check, and a name that
landed comes back from `quote` as not sellable.

### Two wallets, two jobs

`setPartner` is called by your **managing key**. The **payout address** is a separate
argument and can be a Safe. That split is the point — configure from a hot wallet, get paid
into a cold one — but it means the two wallets see different things:

| | managing key | payout address |
| --- | --- | --- |
| `data-partner` in the embed | this one | — |
| Sales history, price, embed builder | this one | — |
| Money | credited to the payout | withdraws it |

A sale by the managing key credits the payout address, so the managing key's own
withdrawable balance stays at zero. That is correct, not a missing payment.

### Your CSP probably blocks the CDN

If your `script-src` is `'self'`, the unpkg one-liner will not load — and a site with
wallet auth should think twice before opening `script-src` to a CDN, because a compromised
package would then execute in the origin holding your sessions. Copy `dist/widget.js` into
your own static directory and serve it yourself. Re-copy it when you upgrade.

Pass `fonts: false` while you are there: the widget otherwise `@import`s Archivo and IBM
Plex Mono from Google, which needs `style-src` and `font-src` opened too. It falls back to
the system stack.

CSP violations **do not appear in console-reading tools**. Verify with a
`securitypolicyviolation` listener *and* a control request the policy must block — a
listener that catches nothing proves nothing until you have seen it catch something.

### On mobile, the page may not be there when the wallet comes back

Signing means switching to the wallet app. That backgrounds the browser, and the OS is free
to discard the page. The transactions still land — the wallet broadcast them — but the
promise awaiting the receipt does not survive, so nothing is left to show a success state.
The buyer pays and sees nothing happen.

Write the label down **before** you open the wallet, and check on the way back:

```js
// before writeContract
localStorage.setItem("pending", JSON.stringify({ label, owner: address }));

// on mount, and on visibilitychange / pageshow
const owner = await registry.read.ownerOf([tokenId]);    // reverts if never minted
if (owner.toLowerCase() === pending.owner.toLowerCase()) {
  handle.update({ claimed: pending.label });
}
```

Check **ownership, not the receipt**. Ownership is what the buyer cares about and it is
still true after a reload that threw the transaction hash away.

### A receipt is not a success

`waitForTransactionReceipt` resolves just as happily for a reverted transaction. Check
`receipt.status === "success"` on both the approval and the registration, or a failed
registration reports as a completed sale.

### Approve only when the allowance is short

Read `allowance` first and skip the approval when it already covers the price. Two wallet
popups for one purchase is where people give up.

## How it works

The widget is a link. The real flow is the HoodFi mint page, which reads `?partner=` and
routes the registration through `HoodfiPartnerRouter` instead of the registrar directly.
The router takes your price in USDG, forwards our base fee, re-points the name's address
records at the buyer, and hands them the NFT in the same transaction — so a partner sale
produces exactly the same name as a direct one.

The router is not a privileged contract. It calls the same public `registerWithUsdc` anyone
can call, so the blocklist, the tier prices and the short-name lock all still apply.

## Without JavaScript

The widget only builds a URL, so you can hard-code one instead:

```
https://www.hoodfi.name/mint/?partner=0xYourManagingWallet
```

MIT.
