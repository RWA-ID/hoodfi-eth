/**
 * The NFT picker: an MCP Apps view that shows a wallet's NFTs on Robinhood Chain.
 *
 * It fetches them itself from this worker (GET /nfts/:address) so that names and images,
 * which any airdropper can write, reach the iframe without passing through the model.
 * Everything is written with textContent. Send posts `ui/message` back into the chat,
 * because only the model can reach PayBox. That message is assembled from the
 * contract, the token id and the recipient, each pattern-checked here, and never from a
 * token's name. The server re-checks all of it on chain.
 */

export const PICKER_URI = 'ui://hoodfi/nft-picker.html'

const API_ORIGIN = 'https://hoodfi-mcp.com'

export const PICKER_CSP = {
  connectDomains: [API_ORIGIN],
  resourceDomains: [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://www.hoodfi.name',
    'https://*.seadn.io',
  ],
}

export const PICKER_HTML = `<!doctype html>
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
.brand{display:flex;align-items:center;gap:8px;color:var(--paper)}
.brand img{width:22px;height:22px;display:block}
.action{background:var(--lime);color:var(--ink);padding:5px 9px;font-weight:600}
.title{margin-top:18px;font:800 clamp(24px,7.5vw,40px)/1.04 Archivo,sans-serif;letter-spacing:-.02em}
.sub{margin-top:8px;font:500 11.5px/1.4 "IBM Plex Mono",ui-monospace,monospace;color:rgba(241,241,234,.6);overflow-wrap:anywhere}
.body{padding:16px 18px 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;max-height:420px;overflow-y:auto;padding:3px}
.tile{all:unset;box-sizing:border-box;display:block;cursor:pointer;background:var(--paper-alt);border:1px solid var(--line);min-width:0;position:relative}
.tile:hover{border-color:var(--ink)}
.tile:focus-visible{outline:2px solid var(--olive);outline-offset:1px}
.tile[aria-pressed=true]{border-color:var(--ink);box-shadow:0 0 0 3px var(--lime)}
.art{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:var(--ink)}
.noart{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1;background:var(--ink);color:rgba(241,241,234,.55);font:500 10.5px/1.3 "IBM Plex Mono",monospace;text-align:center;padding:8px}
.meta{display:block;padding:8px 9px 9px}
.nm{display:block;font-size:13px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col{display:block;margin-top:3px;font:500 10.5px/1.3 "IBM Plex Mono",monospace;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qty{position:absolute;top:6px;right:6px;background:var(--lime);padding:3px 6px;font:600 10.5px/1 "IBM Plex Mono",monospace}
.more{width:100%;margin-top:10px;height:38px;background:transparent}
.state{padding:26px 4px;font-size:14px;line-height:1.5;color:var(--label)}
.state.bad{color:var(--bad)}
label{display:block;margin:16px 0 7px;font:500 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--label)}
input{width:100%;height:44px;padding:0 12px;background:#fff;border:1.5px solid var(--ink);border-radius:0;color:var(--ink);font:500 13.5px/1 "IBM Plex Mono",ui-monospace,monospace}
input:focus{outline:2px solid var(--olive);outline-offset:1px}
.row{display:flex;gap:10px}.row .grow{flex:1;min-width:0}.row .q{flex:0 0 84px}
.hint{min-height:18px;margin:6px 0 0;font-size:12px;line-height:1.5;color:var(--label)}
.hint.bad{color:var(--bad)}
button{cursor:pointer;font:700 13px/1 Archivo,sans-serif;letter-spacing:.04em;text-transform:uppercase;border:1.5px solid var(--ink);color:var(--ink)}
.go{display:block;width:100%;height:46px;margin-top:8px;background:var(--lime)}
.go:hover:not(:disabled){background:#d6ff3a}.go:disabled{background:var(--paper-alt);color:var(--label);border-color:var(--line);cursor:default}
.foot{margin:12px 0 0;font-size:11.5px;line-height:1.5;color:var(--label)}
</style></head>
<body><div class="card">
<div class="head"><div class="top"><span class="brand"><img id="icon" src="https://www.hoodfi.name/icon-192.png" alt=""><span>HoodFi Names</span></span><span class="action">Send NFT</span></div>
<div class="title">Your NFTs</div><div class="sub" id="sub">Robinhood Chain</div></div>
<div class="body">
<div id="list"><div class="state">Loading your NFTs…</div></div>
<div id="form" hidden>
<div class="row"><div class="grow"><label for="to">Send to</label><input id="to" placeholder="0x… or name.hoodfi.eth" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
<div class="q" id="qbox" hidden><label for="q">Qty</label><input id="q" inputmode="numeric" value="1"></div></div>
<p class="hint" id="hint"></p>
<button class="go" id="go" disabled>Select an NFT</button>
<p class="foot">Sending is irreversible. PayBox asks you to approve before anything is signed, and HoodFi never holds keys or NFTs. Anyone can airdrop an NFT into a wallet, so a name or image here proves nothing about who made it.</p>
</div></div></div>
<script>
(function(){
  var API = ${JSON.stringify(API_ORIGIN)};
  var ADDR = /^0x[0-9a-fA-F]{40}$/, NAME = /^[a-z0-9-]+(\\.[a-z0-9-]+)*$/, DIGITS = /^[0-9]+$/;
  var seq = 0, pending = {}, address = null, items = [], next = null, picked = null, sentKey = null, loading = false;
  var $ = function(id){ return document.getElementById(id); };
  function post(m){ try { window.parent.postMessage(m, "*"); } catch (e) {} }
  function rpc(method, params){ var id = ++seq; post({ jsonrpc: "2.0", id: id, method: method, params: params });
    return new Promise(function(res){ pending[id] = res; setTimeout(function(){ if (pending[id]) { delete pending[id]; res(null); } }, 8000); }); }
  function notify(method, params){ post({ jsonrpc: "2.0", method: method, params: params }); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function size(){ notify("ui/notifications/size-changed", { height: Math.ceil(document.documentElement.getBoundingClientRect().height) }); }
  function shortId(s){ return s.length > 12 ? s.slice(0, 6) + "…" + s.slice(-4) : s; }
  $("icon").onerror = function(){ this.remove(); };

  function state(text, bad, retry){
    var list = $("list"); list.textContent = "";
    var s = el("div", "state" + (bad ? " bad" : ""), text); list.appendChild(s);
    if (retry) { var b = el("button", "more", "Try again"); b.onclick = function(){ load(false); }; list.appendChild(b); }
    size();
  }

  function tile(n){
    var t = el("button", "tile"); t.type = "button"; t.setAttribute("aria-pressed", picked === n ? "true" : "false");
    var title = n.name || ("#" + shortId(n.tokenId));
    t.title = title;
    var noart = function(text){ return el("span", "noart", text); };
    if (n.image) {
      var img = document.createElement("img"); img.className = "art"; img.alt = ""; img.loading = "lazy"; img.src = n.image;
      img.onerror = function(){ img.replaceWith(noart("No image")); };
      t.appendChild(img);
    } else t.appendChild(noart(n.hidden ? "Image hidden" : "No image"));
    if (n.erc1155 && n.quantity !== "1") t.appendChild(el("span", "qty", "×" + n.quantity));
    var m = el("span", "meta"); m.appendChild(el("span", "nm", title)); m.appendChild(el("span", "col", n.collection || shortId(n.contract)));
    t.appendChild(m);
    t.onclick = function(){ picked = picked === n ? null : n; draw(); };
    return t;
  }

  function draw(){
    var list = $("list"); list.textContent = "";
    if (!items.length) { state("This wallet holds no NFTs on Robinhood Chain."); $("form").hidden = true; return; }
    var grid = el("div", "grid"); items.forEach(function(n){ grid.appendChild(tile(n)); }); list.appendChild(grid);
    if (next) { var b = el("button", "more", loading ? "Loading…" : "Load more"); b.disabled = loading; b.onclick = function(){ load(true); }; list.appendChild(b); }
    $("form").hidden = false;
    $("qbox").hidden = !(picked && picked.erc1155 && picked.quantity !== "1");
    check(); size();
  }

  // Returns what Send would send, or sets the reason it can't.
  function check(){
    var go = $("go"), hint = $("hint"), to = $("to").value.trim(), q = $("qbox").hidden ? "1" : $("q").value.trim();
    var lower = to.toLowerCase(), bad = "", ok = null;
    hint.className = "hint"; hint.textContent = "";
    if (to) {
      if (to.indexOf("0x") === 0) { if (!ADDR.test(to)) bad = "That isn't a complete 0x address."; }
      else if (!NAME.test(lower) || lower.length > 200) bad = "Enter a 0x address or a hoodfi name.";
      else if (/\\.eth$/.test(lower) && !/\\.hoodfi\\.eth$/.test(lower)) bad = "Only hoodfi.eth names can be sent to here. Use a 0x address for anything else.";
      else if (to.toLowerCase() === (address || "").toLowerCase()) bad = "That is this wallet.";
    }
    if (!bad && picked && !$("qbox").hidden && (!DIGITS.test(q) || q === "0" || (q.length < 16 && picked.quantity.length < 16 && Number(q) > Number(picked.quantity))))
      bad = "Enter a quantity from 1 to " + picked.quantity + ".";
    if (bad) { hint.className = "hint bad"; hint.textContent = bad; }
    var key = picked ? [picked.contract, picked.tokenId, q, lower].join("|") : "";
    if (!picked) go.textContent = "Select an NFT";
    else if (!to) go.textContent = "Enter a recipient";
    else if (bad) go.textContent = "Send";
    else if (key === sentKey) go.textContent = "Sent to chat — approve in PayBox";
    else { go.textContent = "Send " + (picked.name || "NFT #" + shortId(picked.tokenId)).slice(0, 34); ok = { to: to.indexOf("0x") === 0 ? to : lower, q: q, key: key }; }
    go.disabled = !ok;
    return ok;
  }

  function send(){
    var ok = check(); if (!ok || !picked || !address) return;
    if (!ADDR.test(picked.contract) || !DIGITS.test(picked.tokenId)) return;
    var text = "Send my NFT with PayBox. I pressed Send in the HoodFi NFT picker. Call hoodfi_build_nft_transfer_tx with address " + address +
      ", contract " + picked.contract + ", token_id " + picked.tokenId + ", to " + ok.to + (ok.q !== "1" ? ", quantity " + ok.q : "") +
      ", from_picker true. Tell me the recipient address it resolved and any warnings, sign the step's transaction exactly as given with PayBox request_wallet_sign, broadcast it with hoodfi_send_transaction, and report the result.";
    sentKey = ok.key; check();
    if (window.openai && window.openai.sendFollowUpMessage) { window.openai.sendFollowUpMessage({ prompt: text }); return; }
    rpc("ui/message", { role: "user", content: [{ type: "text", text: text }] }).then(function(r){ if (r && r.isError) { sentKey = null; check(); } });
  }

  function load(more){
    if (!address || loading) return;
    loading = true; if (more) draw(); else state("Loading your NFTs…");
    var url = API + "/nfts/" + address + (more && next ? "?cursor=" + encodeURIComponent(next) : "");
    fetch(url).then(function(r){ return r.json().then(function(b){ if (!r.ok) throw new Error(b && b.error); return b; }); }).then(function(b){
      loading = false; items = more ? items.concat(b.nfts) : b.nfts; next = b.next; draw();
    }).catch(function(){
      loading = false;
      if (more && items.length) { draw(); $("hint").className = "hint bad"; $("hint").textContent = "Couldn't load more. Try again."; }
      else state("Couldn't load this wallet's NFTs. That doesn't mean it holds none.", true, true);
    });
  }

  function start(p){
    if (!p || !ADDR.test(p.address || "") || address) return;
    address = p.address; $("sub").textContent = "Robinhood Chain · " + address; load(false);
  }

  $("to").addEventListener("input", check); $("q").addEventListener("input", check); $("go").onclick = send;
  window.addEventListener("message", function(e){
    if (e.source !== window.parent) return;
    var m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && !m.method && pending[m.id]) { var f = pending[m.id]; delete pending[m.id]; f(m.result || (m.error ? { isError: true } : null)); return; }
    if (m.method === "ui/notifications/tool-result" && m.params) start((m.params.structuredContent || {}).picker);
    if (m.method === "ui/resource-teardown" && m.id != null) post({ jsonrpc: "2.0", id: m.id, result: {} });
  });
  function fromOpenAI(){ var o = window.openai && window.openai.toolOutput; if (o && o.picker) start(o.picker); }
  window.addEventListener("openai:set_globals", fromOpenAI); fromOpenAI();
  rpc("ui/initialize", { protocolVersion: "2026-01-26", appInfo: { name: "hoodfi", version: "1.2.0" }, appCapabilities: {} })
    .then(function(){ notify("ui/notifications/initialized", {}); });
  if (window.ResizeObserver) new ResizeObserver(size).observe(document.body);
})();
</script></body></html>`
