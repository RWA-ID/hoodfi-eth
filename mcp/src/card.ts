/**
 * The in-chat card: an MCP Apps view (ui:// resource) that Claude and ChatGPT render
 * in an iframe under a write tool's result.
 *
 * A preview, not a wallet. The sandboxed iframe cannot reach PayBox — only the model
 * can call PayBox's tools — so "Complete with PayBox" posts `ui/message` back into the
 * chat and the model runs the steps, with PayBox asking before every signature.
 *
 * The bridge is a handful of JSON-RPC messages over postMessage (MCP Apps spec
 * 2026-01-26), written out by hand for the same reason the server speaks MCP by hand:
 * @modelcontextprotocol/ext-apps would pull in the SDK this worker deliberately avoids.
 * The same card ships on the yournames.io and Bot Names connectors, each in its own look.
 *
 * Every value is written with textContent. The card shows only what this server
 * computed — never a name's text records, which a stranger may have written.
 */

export const CARD_URI = 'ui://hoodfi/action-card.html'
export const CARD_MIME = 'text/html;profile=mcp-app'
export const CARD_CSP = {
  resourceDomains: [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://www.hoodfi.name',
  ],
}

export type CardAction =
  | 'register'
  | 'records'
  | 'website'
  | 'subnames'
  | 'transfer'
  | 'primary'

export interface Card {
  action: CardAction
  name: string
  wallet: string
  /** [label, value] rows; the last is emphasised. */
  rows: [string, string][]
  steps: string[]
  warnings: string[]
  url: string
}

export const CARD_HTML = `<!doctype html>
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
.name{margin-top:18px;font:800 clamp(24px,7.5vw,40px)/1.04 Archivo,sans-serif;letter-spacing:-.02em;overflow-wrap:anywhere}
.name .tld{color:rgba(241,241,234,.45)}
.body{padding:16px 18px 18px}
dl{margin:0;background:var(--paper-alt);border:1px solid var(--line);padding:12px 14px;font:500 12.5px/1.45 "IBM Plex Mono",ui-monospace,monospace}
dl div{display:flex;justify-content:space-between;gap:14px;padding:3px 0}
dt{color:var(--label);flex:none}dd{margin:0;text-align:right;overflow-wrap:anywhere}
dl div:last-child{border-top:1px solid var(--line);margin-top:6px;padding-top:9px;font-weight:600}
dl div:only-child{border-top:0;margin-top:0;padding-top:3px}
h3{margin:16px 0 8px;font:500 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--label)}
ol{margin:0;padding:0;list-style:none;counter-reset:s}
ol li{counter-increment:s;display:flex;gap:10px;padding:6px 0;font-size:13.5px;line-height:1.45;color:var(--dim)}
ol li:before{content:counter(s,decimal-leading-zero);flex:none;font:600 11px/1.75 "IBM Plex Mono",monospace;color:var(--olive)}
.warn{margin-top:14px;border:1px solid var(--bad);background:#fbe9e3;color:var(--bad);padding:10px 13px;font-size:13px;line-height:1.5}
.warn p{margin:0}.warn p+p{margin-top:6px}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
button{cursor:pointer;height:44px;padding:0 18px;font:700 13px/1 Archivo,sans-serif;letter-spacing:.04em;text-transform:uppercase;border:1.5px solid var(--ink)}
.go{flex:1 1 220px;background:var(--lime);color:var(--ink)}
.go:hover{background:#d6ff3a}.go:disabled{opacity:.55;cursor:default}
.view{flex:0 1 auto;background:transparent;color:var(--ink)}
.foot{margin:12px 0 0;font-size:11.5px;line-height:1.5;color:var(--label)}
.wallet{font-family:"IBM Plex Mono",monospace;color:var(--dim);overflow-wrap:anywhere}
.empty{padding:28px 18px;font-size:14px;color:var(--label)}
</style></head>
<body><div class="card" id="card"><div class="empty">Preparing…</div></div>
<script>
(function(){
  var seq = 0, pending = {}, data = null, sent = false;
  var VERB = { register: "Register", records: "Set records", website: "Publish site", subnames: "Create subnames", transfer: "Transfer", primary: "Primary name" };
  function post(m){ try { window.parent.postMessage(m, "*"); } catch (e) {} }
  function rpc(method, params){ var id = ++seq; post({ jsonrpc: "2.0", id: id, method: method, params: params });
    return new Promise(function(res){ pending[id] = res; setTimeout(function(){ if (pending[id]) { delete pending[id]; res(null); } }, 8000); }); }
  function notify(method, params){ post({ jsonrpc: "2.0", method: method, params: params }); }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }

  function render(c){
    if (!c || !c.action || !c.name) return;
    data = c;
    var card = document.getElementById("card"); card.textContent = "";
    var head = el("div", "head"), top = el("div", "top"), brand = el("span", "brand");
    var icon = document.createElement("img"); icon.src = "https://www.hoodfi.name/icon-192.png"; icon.alt = "";
    icon.onerror = function(){ icon.remove(); };
    brand.appendChild(icon); brand.appendChild(el("span", "", "HoodFi Names"));
    top.appendChild(brand); top.appendChild(el("span", "action", VERB[c.action] || c.action)); head.appendChild(top);
    var nm = el("div", "name"), full = String(c.name), cut = full.lastIndexOf(".hoodfi.eth");
    nm.appendChild(document.createTextNode(cut > 0 ? full.slice(0, cut) : full));
    if (cut > 0) nm.appendChild(el("span", "tld", ".hoodfi.eth"));
    head.appendChild(nm); card.appendChild(head);

    var body = el("div", "body");
    if (c.rows && c.rows.length) {
      var dl = el("dl");
      c.rows.forEach(function(r){ var d = el("div"); d.appendChild(el("dt", "", r[0])); d.appendChild(el("dd", "", r[1])); dl.appendChild(d); });
      body.appendChild(dl);
    }
    if (c.steps && c.steps.length) {
      body.appendChild(el("h3", "", "What PayBox will ask you to approve"));
      var ol = el("ol"); c.steps.forEach(function(s){ ol.appendChild(el("li", "", s)); }); body.appendChild(ol);
    }
    if (c.warnings && c.warnings.length) {
      var w = el("div", "warn"); c.warnings.forEach(function(t){ w.appendChild(el("p", "", t)); }); body.appendChild(w);
    }
    var btns = el("div", "btns"), go = el("button", "go", sent ? "Sent to chat — approve in PayBox" : "Complete with PayBox");
    go.disabled = sent; go.onclick = complete;
    var view = el("button", "view", "View");
    view.onclick = function(){ open(c.url); };
    btns.appendChild(go); btns.appendChild(view); body.appendChild(btns);
    var foot = el("p", "foot", "Only your wallet signs, and you approve every step. HoodFi never holds keys or funds. Wallet ");
    foot.appendChild(el("span", "wallet", c.wallet || "")); body.appendChild(foot);
    card.appendChild(body);
    size();
  }

  function complete(){
    if (!data || sent) return;
    var text = "Complete this HoodFi step (" + (VERB[data.action] || data.action).toLowerCase() + " for " + data.name +
      ") with my PayBox wallet: sign each prepared transaction exactly as given, broadcast it with hoodfi_send_transaction, and show me each one before it is signed.";
    sent = true; render(data);
    if (window.openai && window.openai.sendFollowUpMessage) { window.openai.sendFollowUpMessage({ prompt: text }); return; }
    rpc("ui/message", { role: "user", content: [{ type: "text", text: text }] }).then(function(r){ if (r && r.isError) { sent = false; render(data); } });
  }
  function open(url){
    if (!url) return;
    if (window.openai && window.openai.openExternal) { window.openai.openExternal({ href: url }); return; }
    rpc("ui/open-link", { url: url }).then(function(r){ if (!r || r.isError) { try { window.open(url, "_blank", "noopener"); } catch (e) {} } });
  }
  function size(){ notify("ui/notifications/size-changed", { height: Math.ceil(document.documentElement.getBoundingClientRect().height) }); }

  window.addEventListener("message", function(e){
    if (e.source !== window.parent) return;
    var m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && !m.method && pending[m.id]) { var f = pending[m.id]; delete pending[m.id]; f(m.result || (m.error ? { isError: true } : null)); return; }
    if (m.method === "ui/notifications/tool-result" && m.params) render((m.params.structuredContent || {}).card);
    if (m.method === "ui/resource-teardown" && m.id != null) post({ jsonrpc: "2.0", id: m.id, result: {} });
  });
  function fromOpenAI(){ var o = window.openai && window.openai.toolOutput; if (o && o.card) render(o.card); }
  window.addEventListener("openai:set_globals", fromOpenAI); fromOpenAI();
  rpc("ui/initialize", { protocolVersion: "2026-01-26", appInfo: { name: "hoodfi", version: "1.1.0" }, appCapabilities: {} })
    .then(function(){ notify("ui/notifications/initialized", {}); });
  if (window.ResizeObserver) new ResizeObserver(size).observe(document.body);
})();
</script></body></html>`
