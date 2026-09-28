/*! Firmspace CRM — онлайн-чат для сайта.
 *  Подключение: <script src="https://ВАШ-САЙТ/widget.js" data-token="ТОКЕН" async></script>
 *  Токен и готовый код — в CRM: Settings → Integration → Online Chat. */
(function () {
  var script = document.currentScript;
  if (!script || window.__synergiaChat) return;
  var token = script.getAttribute("data-token");
  if (!token) return console.warn("[Firmspace chat] data-token is missing");
  window.__synergiaChat = true;

  var api = new URL(script.src).origin + "/api/webchat/" + encodeURIComponent(token);
  var lang = (navigator.language || "en").slice(0, 2);
  var T = {
    de: {
      ph: "Nachricht schreiben…", send: "Senden", err: "Nachricht nicht gesendet. Bitte erneut versuchen.", close: "Schließen",
      quick: "Häufige Fragen", write: "Oder schreiben Sie uns — wir antworten persönlich.", more: "Auch erreichbar über",
      cta: "Kostenlos starten", offline: "Gerade ist niemand im Dienst. Hinterlassen Sie Ihren Kontakt — wir melden uns.",
      contactTitle: "Wie erreichen wir Sie?", contactHint: "E-Mail oder Telefonnummer — wir melden uns, falls es im Chat nicht klappt.",
      contactSend: "Senden", contactBad: "Bitte prüfen Sie die E-Mail oder Nummer.", contactThanks: "Danke! Wir melden uns bei Ihnen.",
      rateUp: "Hat geholfen", rateDown: "Hat nicht geholfen",
      file: "Datei anhängen", fileBad: "Die Datei konnte nicht gesendet werden (max. 4 MB).",
    },
    uk: {
      ph: "Напишіть повідомлення…", send: "Надіслати", err: "Не вдалося надіслати. Спробуйте ще раз.", close: "Закрити",
      quick: "Часті питання", write: "Або напишіть нам — відповімо особисто.", more: "Також пишіть у",
      cta: "Почати безкоштовно", offline: "Зараз неробочий час. Залиште контакт — ми звʼяжемося.",
      contactTitle: "Як з вами звʼязатися?", contactHint: "Пошта або телефон — напишемо, якщо не встигнемо в чаті.",
      contactSend: "Надіслати", contactBad: "Перевірте пошту або номер.", contactThanks: "Дякуємо! Ми звʼяжемося з вами.",
      rateUp: "Допомогло", rateDown: "Не допомогло",
      file: "Прикріпити файл", fileBad: "Не вдалося надіслати файл (до 4 МБ).",
    },
  }[lang] || {
    ph: "Type a message…", send: "Send", err: "Message was not sent. Try again.", close: "Close",
    quick: "Common questions", write: "Or write to us — a person will answer.", more: "Also reachable in",
    cta: "Start free", offline: "Nobody is online right now. Leave your contact — we will get back to you.",
    contactTitle: "How can we reach you?", contactHint: "E-mail or phone — we will write back if the chat does not work out.",
    contactSend: "Send", contactBad: "Please check the e-mail or number.", contactThanks: "Thank you! We will get in touch.",
    rateUp: "It helped", rateDown: "It did not help",
    file: "Attach a file", fileBad: "The file could not be sent (max 4 MB).",
  };

  var storeKey = "synergia_visitor_" + token;
  var visitor = null;
  try { visitor = localStorage.getItem(storeKey); } catch (e) {}
  if (!visitor) {
    var bytes = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    visitor = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    try { localStorage.setItem(storeKey, visitor); } catch (e) {}
  }

  var cfg = { title: "Chat with us", greeting: "Hello! How can we help?", color: "#5EA8F5", quick: [], links: {}, hours: null, cta: null };
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
    ".quick{padding:0 12px 10px;display:none;flex-direction:column;gap:6px}" +
    ".quick.on{display:flex}" +
    ".quick i{font-style:normal;font-size:12px;color:#8a8a8a}" +
    ".quick button{text-align:left;border:1px solid #e0e0e0;background:#fff;border-radius:10px;padding:8px 10px;font-size:13px;color:#333;cursor:pointer}" +
    ".quick button:hover{border-color:#bbb}" +
    ".links{padding:8px 12px 0;display:none;flex-wrap:wrap;gap:6px;align-items:center;border-top:1px solid #e6e6e6}" +
    ".links.on{display:flex}" +
    ".links i{font-style:normal;font-size:12px;color:#8a8a8a;width:100%}" +
    ".links a{display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;color:#555;border:1px solid #e6e6e6;border-radius:99px;padding:5px 10px}" +
    ".links a:hover{border-color:#bbb;color:#111}" +
    ".note{display:none;padding:8px 12px;background:#fff7e6;color:#8a6a1f;font-size:12px;line-height:1.4}" +
    ".note.on{display:block}" +
    ".cta{display:none;margin:0 12px 10px;padding:10px;border-radius:10px;text-align:center;font-size:14px;font-weight:600;text-decoration:none}" +
    ".cta.on{display:block}" +
    ".ask{display:none;flex-direction:column;gap:6px;padding:10px 12px;border-top:1px solid #e6e6e6}" +
    ".ask.on{display:flex}" +
    ".ask b{font-size:12px;color:#333}" +
    ".ask i{font-style:normal;font-size:11px;color:#8a8a8a}" +
    ".ask div{display:flex;gap:6px}" +
    ".ask input{flex:1;min-width:0;height:34px;border:1px solid #e0e0e0;border-radius:8px;padding:0 10px;font-size:13px;outline:none}" +
    ".ask button{border:0;border-radius:8px;padding:0 12px;font-size:13px;font-weight:600;color:#fff;cursor:pointer}" +
    ".rate{display:flex;gap:6px;margin-top:4px}" +
    ".rate button{border:0;background:none;cursor:pointer;font-size:14px;opacity:.45;padding:0 2px}" +
    ".rate button.on{opacity:1}" +
    "form{display:flex;gap:8px;padding:10px;border-top:1px solid #e6e6e6}" +
    "input{flex:1;min-width:0;height:40px;border:1px solid #e0e0e0;border-radius:20px;padding:0 14px;font-size:14px;outline:none}" +
    "input:focus{border-color:#5ea8f5}" +
    "form button{border:0;border-radius:20px;padding:0 16px;color:#fff;font-weight:600;cursor:pointer}" +
    "form .clip{background:none;border:0;font-size:18px;line-height:1;cursor:pointer;padding:0 2px;border-radius:0}" +
    "</style>" +
    '<div class="panel" role="dialog"><div class="head"><span class="title"></span><button type="button" class="x" aria-label="' + T.close + '">×</button></div>' +
    '<div class="note"></div><div class="list"></div><div class="quick"></div>' +
    '<div class="ask"><b>' + T.contactTitle + "</b><i>" + T.contactHint + '</i><div><input maxlength="120" aria-label="' + T.contactTitle + '"><button type="button">' + T.contactSend + "</button></div></div>" +
    '<div class="links"></div><a class="cta" target="_blank" rel="noopener"></a>' +
    '<form><button class="clip" type="button" aria-label="' + T.file + '" title="' + T.file + '">📎</button>' +
    '<input class="text" maxlength="1000" placeholder="' + T.ph + '" aria-label="' + T.ph + '"><input class="file" type="file" hidden>' +
    '<button type="submit">' + T.send + "</button></form></div>" +
    '<button class="btn" type="button" aria-label="Chat"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg><span class="dot"></span></button>';

  var $ = function (s) { return root.querySelector(s); };
  var panel = $(".panel"), list = $(".list"), input = $("input.text"), btn = $(".btn"), dot = $(".dot");

  function paint() {
    $(".head").style.background = cfg.color;
    btn.style.background = cfg.color;
    $("form button").style.background = cfg.color;
    $(".title").textContent = cfg.title;

    // быстрые вопросы бота: готовые ответы приходят с сервера теми же текстами, что и раньше на лендинге
    var quick = $(".quick");
    quick.textContent = "";
    (cfg.quick || []).forEach(function (item) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = item.text;
      b.addEventListener("click", function () { send(item.text); });
      quick.appendChild(b);
    });
    if (quick.childNodes.length) {
      var qLabel = document.createElement("i");
      qLabel.textContent = T.quick;
      quick.insertBefore(qLabel, quick.firstChild);
    }

    // кнопки мессенджеров — только те каналы, что фирма действительно подключила
    var links = $(".links");
    links.textContent = "";
    [["telegram", "Telegram"], ["viber", "Viber"], ["whatsapp", "WhatsApp"]].forEach(function (ch) {
      var url = (cfg.links || {})[ch[0]];
      if (!url) return;
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = ch[1];
      links.appendChild(a);
    });
    if (links.childNodes.length) {
      var lLabel = document.createElement("i");
      lLabel.textContent = T.more;
      links.insertBefore(lLabel, links.firstChild);
    }

    // кнопка действия: «начать бесплатно» и подобное — чтобы её не искали на странице
    var cta = $(".cta");
    if (cfg.cta && cfg.cta.url) {
      cta.href = cfg.cta.url;
      cta.textContent = cfg.cta.label || T.cta;
      cta.style.background = cfg.color;
      cta.style.color = "#fff";
      cta.classList.add("on");
    } else {
      cta.classList.remove("on");
    }
  }

  // Часы работы фирмы: время считаем в её поясе (сдвиг приходит с сервера), а не в поясе посетителя,
  // иначе ночной посетитель из другого города увидел бы «мы на связи» в закрытое время
  function isOffline() {
    var h = cfg.hours;
    if (!h) return false;
    var now = new Date(Date.now() + (Number(h.tzOffset) || 0) * 60000);
    var range = String(h.days || "1-5").split("-");
    var first = Number(range[0]);
    var last = Number(range[1] === undefined ? range[0] : range[1]);
    var day = now.getUTCDay();
    var inDays = first <= last ? day >= first && day <= last : day >= first || day <= last;
    if (!inDays) return true;
    var from = String(h.from || "00:00").split(":");
    var to = String(h.to || "23:59").split(":");
    var minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return minutes < Number(from[0]) * 60 + Number(from[1]) || minutes >= Number(to[0]) * 60 + Number(to[1]);
  }

  function showOffline() {
    var note = $(".note");
    var off = isOffline();
    note.textContent = off ? T.offline : "";
    note.classList.toggle("on", off);
  }

  // Форма контакта: показываем, когда человек нужен, — вне рабочих часов или когда бот не нашёл ответа
  var contactWanted = false;
  function revealContact(show) {
    if (show) contactWanted = true;
    $(".ask").classList.toggle("on", !!show || contactWanted);
  }

  function sendContact() {
    var field = $(".ask input");
    var value = (field.value || "").trim();
    if (!value) return;
    request("/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor: visitor, value: value }),
    }).then(function (r) {
      if (r && r.ok) {
        $(".ask").classList.remove("on");
        addBubble("ag", T.contactThanks);
      } else {
        addBubble("err", T.contactBad);
      }
    }).catch(function () { addBubble("err", T.contactBad); });
  }

  // Оценка ответа бота: «не помогло» уходит команде вместе с вопросом — видно, какую тему дописать
  function rate(messageId, value, row) {
    var buttons = row.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove("on");
    (value === "up" ? buttons[0] : buttons[1]).classList.add("on");
    request("/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor: visitor, messageId: messageId, rating: value }),
    }).catch(function () {});
  }

  // Быстрые вопросы показываем, пока посетитель сам ничего не написал: дальше начинается живая переписка
  function showQuick() {
    var hasOwn = messages.some(function (m) { return m.direction === "in"; });
    $(".quick").classList.toggle("on", !hasOwn);
    $(".links").classList.toggle("on", true);
  }

  // Пузырь в списке сообщений. Объявлен снаружи отрисовки: им пользуется и форма контакта
  function addBubble(cls, text, bg) {
    var d = document.createElement("div");
    d.className = "m " + cls;
    if (bg) d.style.background = bg;
    d.textContent = text;
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
    return d;
  }

  function render() {
    list.textContent = "";
    var add = addBubble;
    add("ag", cfg.greeting);
    messages.forEach(function (m) {
      if (m.direction === "in") return add("me", m.text, cfg.color);
      add("ag", m.text);
      // под ответом бота — оценка: по ней видно, каких тем не хватает в базе знаний
      if (m.meta && m.meta.bot) {
        var row = document.createElement("div");
        row.className = "rate";
        row.style.alignSelf = "flex-start";
        [["up", "👍", T.rateUp], ["down", "👎", T.rateDown]].forEach(function (r) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = r[1];
          b.title = r[2];
          b.setAttribute("aria-label", r[2]);
          if (m.meta.rating === r[0]) b.classList.add("on");
          b.addEventListener("click", function () { rate(m.id, r[0], row); });
          row.appendChild(b);
        });
        list.appendChild(row);
      }
    });
    list.scrollTop = list.scrollHeight;
    showQuick();
    showOffline();
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
    if (open) { render(); poll(); input.focus(); revealContact(isOffline()); }
    schedule();
  }

  // Отправка сообщения: и из поля ввода, и кнопкой быстрого вопроса. Язык передаём, чтобы бот ответил
  // на языке посетителя (готовые ответы лежат на трёх языках, см. app/content/chatbotFaq.ts).
  function send(text) {
    text = String(text || "").trim();
    if (!text) return;
    messages.push({ direction: "in", text: text });
    render();
    request("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor: visitor, text: text, lang: lang, page: location.href }),
    }).then(function (r) {
      // готового ответа нет — значит нужен человек: сразу предлагаем оставить контакт, чтобы не потерять
      if (r && !r.reply) revealContact(true);
      poll();
    }).catch(function () {
      var d = document.createElement("div");
      d.className = "m err";
      d.textContent = T.err;
      list.appendChild(d);
    });
  }

  btn.addEventListener("click", function () { toggle(!open); });
  $(".x").addEventListener("click", function () { toggle(false); });
  $(".ask button").addEventListener("click", sendContact);
  $(".ask input").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendContact(); } });

  // Вложение: файл уходит в хранилище фирмы, в переписке появляется сообщением с файлом
  var clip = $(".clip"), fileInput = $("input.file");
  clip.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    fileInput.value = "";
    if (file.size > 4 * 1024 * 1024) return addBubble("err", T.fileBad);
    var form = new FormData();
    form.append("visitor", visitor);
    form.append("file", file);
    addBubble("me", "📎 " + file.name, cfg.color);
    fetch(api + "/upload", { method: "POST", body: form })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); poll(); })
      .catch(function () { addBubble("err", T.fileBad); });
  });
  root.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    send(text);
  });

  request("?lang=" + encodeURIComponent(lang)).then(function (c) {
    cfg = {
      title: c.title || cfg.title,
      greeting: c.greeting || cfg.greeting,
      color: c.color || cfg.color,
      quick: c.quick || [],
      links: c.links || {},
      hours: c.hours || null,
      cta: c.cta || null,
    };
    paint();
    showOffline();
  }).catch(function () { paint(); });
  paint();
  document.body.appendChild(host);
  poll();
  schedule();
})();
