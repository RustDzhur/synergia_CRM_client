/*! Synergia CRM — онлайн-чат для сайта.
 *  Подключение: <script src="https://ВАШ-САЙТ/widget.js" data-token="ТОКЕН" async></script>
 *  Токен и готовый код — в CRM: Settings → Integration → Online Chat. */
(function () {
  var script = document.currentScript;
  if (!script || window.__synergiaChat) return;
  var token = script.getAttribute("data-token");
  if (!token) return console.warn("[Synergia chat] data-token is missing");
  window.__synergiaChat = true;

  var api = new URL(script.src).origin + "/api/webchat/" + encodeURIComponent(token);
  var lang = (navigator.language || "en").slice(0, 2);
  var T = {
    de: { ph: "Nachricht schreiben…", send: "Senden", err: "Nachricht nicht gesendet. Bitte erneut versuchen.", close: "Schließen" },
    uk: { ph: "Напишіть повідомлення…", send: "Надіслати", err: "Не вдалося надіслати. Спробуйте ще раз.", close: "Закрити" },
  }[lang] || { ph: "Type a message…", send: "Send", err: "Message was not sent. Try again.", close: "Close" };

  var storeKey = "synergia_visitor_" + token;
  var visitor = null;
  try { visitor = localStorage.getItem(storeKey); } catch (e) {}
  if (!visitor) {
    var bytes = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    visitor = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    try { localStorage.setItem(storeKey, visitor); } catch (e) {}
  }

  var cfg = { title: "Chat with us", greeting: "Hello! How can we help?", color: "#5EA8F5" };
  var open = false, messages = [], seen = 0, timer = null;

  var host = document.createElement("div");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  root.innerHTML =
    "<style>" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
    ".btn{width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.25);position:relative;display:flex;align-items:center;justify-content:center}" +
    ".dot{position:absolute;top:2px;right:2px;min-width:14px;height:14px;border-radius:7px;background:#e5484d;border:2px solid #fff;display:none}" +
    ".panel{display:none;flex-direction:column;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 100px);margin-bottom:12px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.25);overflow:hidden}" +
    ".panel.on{display:flex}" +
    ".head{padding:14px 16px;color:#fff;font-weight:600;font-size:16px;display:flex;justify-content:space-between;align-items:center}" +
    ".head button{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer}" +
    ".list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f6f8fb}" +
    ".m{max-width:80%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word}" +
    ".me{align-self:flex-end;color:#fff;border-bottom-right-radius:4px}" +
    ".ag{align-self:flex-start;background:#fff;color:#333;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.08)}" +
    ".err{align-self:center;font-size:12px;color:#e5484d}" +
    "form{display:flex;gap:8px;padding:10px;border-top:1px solid #e6e6e6}" +
    "input{flex:1;min-width:0;height:40px;border:1px solid #e0e0e0;border-radius:20px;padding:0 14px;font-size:14px;outline:none}" +
    "input:focus{border-color:#5ea8f5}" +
    "form button{border:0;border-radius:20px;padding:0 16px;color:#fff;font-weight:600;cursor:pointer}" +
    "</style>" +
    '<div class="panel" role="dialog"><div class="head"><span class="title"></span><button type="button" class="x" aria-label="' + T.close + '">×</button></div>' +
    '<div class="list"></div><form><input maxlength="1000" placeholder="' + T.ph + '" aria-label="' + T.ph + '"><button type="submit">' + T.send + "</button></form></div>" +
    '<button class="btn" type="button" aria-label="Chat"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg><span class="dot"></span></button>';

  var $ = function (s) { return root.querySelector(s); };
  var panel = $(".panel"), list = $(".list"), input = $("input"), btn = $(".btn"), dot = $(".dot");

  function paint() {
    $(".head").style.background = cfg.color;
    btn.style.background = cfg.color;
    $("form button").style.background = cfg.color;
    $(".title").textContent = cfg.title;
  }

  function render() {
    list.textContent = "";
    var add = function (cls, text, bg) {
      var d = document.createElement("div");
      d.className = "m " + cls;
      if (bg) d.style.background = bg;
      d.textContent = text;
      list.appendChild(d);
    };
    add("ag", cfg.greeting);
    messages.forEach(function (m) { m.direction === "in" ? add("me", m.text, cfg.color) : add("ag", m.text); });
    list.scrollTop = list.scrollHeight;
  }

  function request(path, init) {
    return fetch(api + path, init).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function poll() {
    request("/messages?visitor=" + visitor).then(function (d) {
      var agentCount = d.messages.filter(function (m) { return m.direction === "out"; }).length;
      var changed = d.messages.length !== messages.length;
      messages = d.messages;
      if (open) { seen = agentCount; if (changed) render(); dot.style.display = "none"; }
      else if (agentCount > seen) dot.style.display = "block";
    }).catch(function () {});
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { poll(); schedule(); }, open ? 3000 : 20000);
  }

  function toggle(v) {
    open = v;
    panel.classList.toggle("on", open);
    if (open) { render(); poll(); input.focus(); }
    schedule();
  }

  btn.addEventListener("click", function () { toggle(!open); });
  $(".x").addEventListener("click", function () { toggle(false); });
  root.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    messages.push({ direction: "in", text: text });
    render();
    request("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor: visitor, text: text }),
    }).catch(function () {
      var d = document.createElement("div");
      d.className = "m err";
      d.textContent = T.err;
      list.appendChild(d);
    });
  });

  request("").then(function (c) { cfg = { title: c.title || cfg.title, greeting: c.greeting || cfg.greeting, color: c.color || cfg.color }; paint(); }).catch(function () { paint(); });
  paint();
  document.body.appendChild(host);
  poll();
  schedule();
})();
