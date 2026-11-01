/**
 * The buy panel: an MCP Apps view. Paste an OpenSea URL, see the NFT and price from
 * GET /listing, press Buy. Buy posts `ui/message`, because only the model can reach PayBox.
 * That message is built from pattern-checked hex and digits, never a token's name, and
 * the server re-checks the order against those values.
 */
export const BUY_URI = 'ui://hoodfi/nft-buy.html'

const API_ORIGIN = 'https://hoodfi-mcp.com'

export const BUY_CSP = {
  connectDomains: [API_ORIGIN],
  resourceDomains: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://www.hoodfi.name', 'https://*.seadn.io'],
}

export const BUY_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--paper:#f1f1ea;--paper-alt:#e9eae1;--ink:#0b0e08;--lime:#c6f702;--olive:#4a5a18;--dim:rgba(11,14,8,.66);--label:rgba(11,14,8,.55);--line:rgba(11,14,8,.18);--bad:#b03a1a}
*{box-sizing:border-box}html,body{margin:0;background:transparent}
body{font-family:Archivo,system-ui,sans-serif;color:var(--ink);padding:4px}
.card{background:var(--paper);border:1.5px solid var(--ink)}
.head{background:var(--ink);color:var(--paper);padding:14px 18px 20px;border-bottom:5px solid var(--lime)}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;font:500 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:rgba(241,241,234,.6)}
.brand{display:flex;align-items:center;gap:8px;color:var(--paper)}.brand img{width:22px;height:22px;display:block}
.action{background:var(--lime);color:var(--ink);padding:5px 9px;font-weight:600}
.title{margin-top:18px;font:800 clamp(24px,7.5vw,40px)/1.04 Archivo,sans-serif;letter-spacing:-.02em}
.body{padding:16px 18px 18px}
label{display:block;margin:0 0 7px;font:500 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--label)}
.row{display:flex;gap:8px}
input{flex:1;min-width:0;height:44px;padding:0 12px;background:#fff;border:1.5px solid var(--ink);border-radius:0;color:var(--ink);font:500 13px/1 "IBM Plex Mono",ui-monospace,monospace}
input:focus{outline:2px solid var(--olive);outline-offset:1px}
button{cursor:pointer;height:44px;padding:0 16px;font:700 13px/1 Archivo,sans-serif;letter-spacing:.04em;text-transform:uppercase;border:1.5px solid var(--ink);color:var(--ink);background:transparent}
button:disabled{cursor:default;background:var(--paper-alt);color:var(--label);border-color:var(--line)}
.hint{margin:10px 0 0;font-size:13px;line-height:1.5;color:var(--label)}.hint.bad{color:var(--bad)}
.nft{display:flex;gap:14px;margin-top:16px;flex-wrap:wrap}
.art{flex:0 0 180px;width:180px;height:180px;object-fit:cover;background:var(--ink);display:block}
.noart{flex:0 0 180px;height:180px;display:flex;align-items:center;justify-content:center;background:var(--ink);color:rgba(241,241,234,.55);font:500 11px "IBM Plex Mono",monospace}
.info{flex:1 1 220px;min-width:0}
.nm{font:800 22px/1.15 Archivo,sans-serif;letter-spacing:-.01em;overflow-wrap:anywhere}
.col{margin-top:5px;font-size:13.5px;color:var(--dim);overflow-wrap:anywhere}
.flag{display:inline-block;margin-top:8px;padding:4px 7px;font:600 10.5px/1 "IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.06em}
.flag.ok{background:var(--lime)}.flag.no{background:#fbe9e3;color:var(--bad);border:1px solid var(--bad)}
dl{margin:12px 0 0;background:var(--paper-alt);border:1px solid var(--line);padding:10px 12px;font:500 12px/1.45 "IBM Plex Mono",ui-monospace,monospace}
dl div{display:flex;justify-content:space-between;gap:14px;padding:2px 0}
dt{color:var(--label);flex:none}dd{margin:0;text-align:right;overflow-wrap:anywhere}
dl div:last-child{border-top:1px solid var(--line);margin-top:6px;padding-top:8px;font-weight:600;font-size:14px}
.warn{margin-top:12px;border:1px solid var(--bad);background:#fbe9e3;color:var(--bad);padding:10px 13px;font-size:13px;line-height:1.5}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.go{flex:1 1 220px;background:var(--lime);height:46px}.go:hover:not(:disabled){background:#d6ff3a}
.foot{margin:12px 0 0;font-size:11.5px;line-height:1.5;color:var(--label)}
</style></head>
<body><div class="card">
<div class="head"><div class="top"><span class="brand"><img id="icon" src="https://www.hoodfi.name/icon-192.png" alt=""><span>HoodFi Names</span></span><span class="action">Buy NFT</span></div>
<div class="title">Buy from OpenSea</div></div>
<div class="body">
<label for="url">OpenSea link</label>
<div class="row"><input id="url" placeholder="https://opensea.io/item/robinhood/0x…/123" autocomplete="off" autocapitalize="off" spellcheck="false"><button id="look">Look up</button></div>
<p class="hint" id="hint">Robinhood Chain NFTs listed in ETH. You'll see the NFT and the price before anything happens.</p>
<div id="out"></div>
</div></div>
<script>
(function(){
  var API = ${JSON.stringify(API_ORIGIN)};
  var ADDR = /^0x[0-9a-fA-F]{40}$/, HASH = /^0x[0-9a-fA-F]{64}$/, DIGITS = /^[0-9]+$/;
  var seq = 0, pending = {}, buyer = null, sent = false;
  var $ = function(id){ return document.getElementById(id); };
  function post(m){ try { window.parent.postMessage(m, "*"); } catch (e) {} }
  function rpc(method, params){ var id = ++seq; post({ jsonrpc: "2.0", id: id, method: method, params: params });
    return new Promise(function(res){ pending[id] = res; setTimeout(function(){ if (pending[id]) { delete pending[id]; res(null); } }, 8000); }); }
  function notify(method, params){ post({ jsonrpc: "2.0", method: method, params: params }); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function size(){ notify("ui/notifications/size-changed", { height: Math.ceil(document.documentElement.getBoundingClientRect().height) }); }
  function hint(text, bad){ $("hint").className = "hint" + (bad ? " bad" : ""); $("hint").textContent = text; size(); }
  function short(a){ return a.slice(0, 6) + "…" + a.slice(-4); }
  $("icon").onerror = function(){ this.remove(); };
  function open(url){
    if (window.openai && window.openai.openExternal) { window.openai.openExternal({ href: url }); return; }
    rpc("ui/open-link", { url: url }).then(function(r){ if (!r || r.isError) { try { window.open(url, "_blank", "noopener"); } catch (e) {} } });
  }

  function show(n){
    var out = $("out"); out.textContent = ""; sent = false;
    var box = el("div", "nft");
    if (n.image) { var img = document.createElement("img"); img.className = "art"; img.alt = ""; img.src = n.image;
      img.onerror = function(){ img.replaceWith(el("div", "noart", "No image")); }; box.appendChild(img); }
    else box.appendChild(el("div", "noart", "No image"));
    var info = el("div", "info");
    info.appendChild(el("div", "nm", n.name || "Token #" + (n.tokenId.length > 12 ? n.tokenId.slice(0, 6) + "…" + n.tokenId.slice(-4) : n.tokenId)));
    info.appendChild(el("div", "col", n.collection));
    info.appendChild(el("span", "flag " + (n.verified ? "ok" : "no"), n.verified ? "Verified collection" : "Not verified by OpenSea"));
    var dl = el("dl");
    function row(k, v){ var d = el("div"); d.appendChild(el("dt", "", k)); d.appendChild(el("dd", "", v)); dl.appendChild(d); }
    row("Contract", short(n.contract));
    if (n.listed) { row("Seller", short(n.seller)); if (n.endTime) row("Listing ends", new Date(n.endTime * 1000).toLocaleString()); row("You pay", n.priceEth + " ETH"); }
    info.appendChild(dl); box.appendChild(info); out.appendChild(box);
    if (!n.verified) out.appendChild(el("div", "warn", "Anyone can make a collection that copies a famous one. Check the contract on OpenSea is the collection you mean before buying."));
    var btns = el("div", "btns");
    if (n.listed) {
      var go = el("button", "go", "Buy for " + n.priceEth + " ETH");
      go.onclick = function(){ buy(n, go); }; btns.appendChild(go);
    } else out.appendChild(el("p", "hint bad", n.reason));
    var view = el("button", "", "View on OpenSea"); view.onclick = function(){ open(n.url); }; btns.appendChild(view);
    out.appendChild(btns);
    out.appendChild(el("p", "foot", "Network fees are extra. HoodFi adds no fee and doesn't vouch for this NFT. PayBox asks you to approve before anything is signed. Purchases can't be undone."));
    hint("Check this is the NFT you want."); size();
  }

  function buy(n, go){
    if (sent || !buyer || !ADDR.test(n.contract) || !DIGITS.test(n.tokenId) || !HASH.test(n.orderHash) || !DIGITS.test(n.priceWei)) return;
    sent = true; go.disabled = true; go.textContent = "Sent to chat — approve in PayBox"; size();
    var text = "Buy this NFT with PayBox. I confirmed it and the price (" + n.priceEth.replace(/[^0-9.]/g, "") + " ETH) in the HoodFi buy panel. Call hoodfi_build_nft_purchase_tx with address " + buyer +
      ", contract " + n.contract + ", token_id " + n.tokenId + ", order_hash " + n.orderHash + ", max_price_wei " + n.priceWei +
      ", from_panel true. Tell me the price and any warnings, sign the step's transaction exactly as given with PayBox request_wallet_sign, broadcast it with hoodfi_send_transaction, and report the result.";
    if (window.openai && window.openai.sendFollowUpMessage) { window.openai.sendFollowUpMessage({ prompt: text }); return; }
    rpc("ui/message", { role: "user", content: [{ type: "text", text: text }] }).then(function(r){ if (r && r.isError) { sent = false; go.disabled = false; go.textContent = "Buy for " + n.priceEth + " ETH"; } });
  }

  function lookup(){
    var u = $("url").value.trim(); if (!u) return;
    $("out").textContent = ""; $("look").disabled = true; hint("Looking it up…");
    fetch(API + "/listing?url=" + encodeURIComponent(u)).then(function(r){ return r.json().then(function(b){ if (!r.ok) throw new Error(b && b.error || "Lookup failed. Try again."); return b; }); })
      .then(function(n){ $("look").disabled = false; show(n); })
      .catch(function(e){ $("look").disabled = false; hint(e && e.message || "Lookup failed. Try again.", true); });
  }
  $("look").onclick = lookup;
  $("url").addEventListener("keydown", function(e){ if (e.key === "Enter") lookup(); });

  function start(p){
    if (!p || !ADDR.test(p.address || "") || buyer) return;
    buyer = p.address;
    if (p.url) { $("url").value = p.url; lookup(); }
  }
  window.addEventListener("message", function(e){
    if (e.source !== window.parent) return;
    var m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && !m.method && pending[m.id]) { var f = pending[m.id]; delete pending[m.id]; f(m.result || (m.error ? { isError: true } : null)); return; }
    if (m.method === "ui/notifications/tool-result" && m.params) start((m.params.structuredContent || {}).buy);
    if (m.method === "ui/resource-teardown" && m.id != null) post({ jsonrpc: "2.0", id: m.id, result: {} });
  });
  function fromOpenAI(){ var o = window.openai && window.openai.toolOutput; if (o && o.buy) start(o.buy); }
  window.addEventListener("openai:set_globals", fromOpenAI); fromOpenAI();
  rpc("ui/initialize", { protocolVersion: "2026-01-26", appInfo: { name: "hoodfi", version: "1.2.0" }, appCapabilities: {} })
    .then(function(){ notify("ui/notifications/initialized", {}); });
  if (window.ResizeObserver) new ResizeObserver(size).observe(document.body);
})();
</script></body></html>`
