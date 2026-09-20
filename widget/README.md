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
