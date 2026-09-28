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
  // Язык берём со страницы, а не из браузера: на немецком сайте с английским браузером окно должно
  // быть немецким. Порядок: data-lang из кода встраивания → <html lang> → первая часть пути (…/de/…) →
  // язык браузера. Русский и украинский приводим к одному коду: строки у виджета украинские.
  var pageLang = (function () {
    var fromAttr = script.getAttribute("data-lang");
    var fromHtml = document.documentElement && document.documentElement.lang;
    var fromPath = (location.pathname.split("/")[1] || "").slice(0, 2);
    var raw = String(fromAttr || fromHtml || fromPath || navigator.language || "en").toLowerCase().slice(0, 2);
    if (raw === "ru") return "uk";
    return ["de", "uk", "en"].indexOf(raw) >= 0 ? raw : "en";
  })();
  var lang = pageLang;
  var T = {
    de: {
      ph: "Nachricht schreiben…", send: "Senden", err: "Nachricht nicht gesendet. Bitte erneut versuchen.", close: "Schließen",
      quick: "Häufige Fragen", write: "Oder schreiben Sie uns — wir antworten persönlich.", more: "Auch erreichbar über",
      cta: "Kostenlos starten", offline: "Gerade ist niemand im Dienst. Hinterlassen Sie Ihren Kontakt — wir melden uns.",
      contactTitle: "Wie erreichen wir Sie?", contactHint: "E-Mail oder Telefonnummer — wir melden uns, falls es im Chat nicht klappt.",
      contactSend: "Senden", contactBad: "Bitte prüfen Sie die E-Mail oder Nummer.", contactThanks: "Danke! Wir melden uns bei Ihnen.",
      rateUp: "Hat geholfen", rateDown: "Hat nicht geholfen",
      chat: "Im Chat schreiben",
      file: "Datei anhängen", fileBad: "Die Datei konnte nicht gesendet werden (max. 4 MB).",
    },
    uk: {
      ph: "Напишіть повідомлення…", send: "Надіслати", err: "Не вдалося надіслати. Спробуйте ще раз.", close: "Закрити",
      quick: "Часті питання", write: "Або напишіть нам — відповімо особисто.", more: "Також пишіть у",
      cta: "Почати безкоштовно", offline: "Зараз неробочий час. Залиште контакт — ми звʼяжемося.",
      contactTitle: "Як з вами звʼязатися?", contactHint: "Пошта або телефон — напишемо, якщо не встигнемо в чаті.",
      contactSend: "Надіслати", contactBad: "Перевірте пошту або номер.", contactThanks: "Дякуємо! Ми звʼяжемося з вами.",
      rateUp: "Допомогло", rateDown: "Не допомогло",
      chat: "Написати в чат",
      file: "Прикріпити файл", fileBad: "Не вдалося надіслати файл (до 4 МБ).",
    },
  }[lang] || {
    ph: "Type a message…", send: "Send", err: "Message was not sent. Try again.", close: "Close",
    quick: "Common questions", write: "Or write to us — a person will answer.", more: "Also reachable in",
    cta: "Start free", offline: "Nobody is online right now. Leave your contact — we will get back to you.",
    contactTitle: "How can we reach you?", contactHint: "E-mail or phone — we will write back if the chat does not work out.",
    contactSend: "Send", contactBad: "Please check the e-mail or number.", contactThanks: "Thank you! We will get in touch.",
    rateUp: "It helped", rateDown: "It did not help",
    chat: "Write in chat",
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

  // Оформление под тёмный сайт: почти чёрные слои и лаймовый акцент, как в кабинете и на лендинге
  var INK = "#131715", INK_DEEP = "#101412", PANEL = "#1d2320", LINE = "rgba(255,255,255,.10)", TEXT = "#f1f4ee", MUTED = "#8c948b", DARK = "#0a0c0b";

  var host = document.createElement("div");
  // пометка нужна, чтобы виджет можно было убрать при переходе в кабинет (см. components/website/components/ChatWidget.tsx)
  host.setAttribute("data-firmspace-chat", "1");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  root.innerHTML =
    "<style>" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
    ".launcher{display:flex;flex-direction:column;align-items:flex-end;gap:10px;margin-bottom:12px}" +
    ".launcher a,.launcher button{width:48px;height:48px;border-radius:50%;border:1px solid " + LINE + ";background:" + PANEL + ";color:" + TEXT + ";display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;font-size:19px;box-shadow:0 8px 20px rgba(0,0,0,.45);transform:translateY(8px) scale(.7);opacity:0;transition:transform .18s ease,opacity .18s ease,border-color .18s ease}" +
    ".launcher.on a,.launcher.on button{transform:none;opacity:1}" +
    ".launcher a:hover,.launcher button:hover{border-color:rgba(198,255,77,.55)}" +
    ".launcher .lbl{font-size:11px;color:" + MUTED + ";margin-right:4px;align-self:flex-end}" +
    ".btn{width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;color:" + DARK + ";box-shadow:0 8px 22px rgba(0,0,0,.5)}" +
    ".dot{position:absolute;top:2px;right:2px;min-width:14px;height:14px;border-radius:7px;background:#e5484d;border:2px solid " + INK + ";display:none}" +
    // Высота окна ограничена так, чтобы оно всегда висело над пузырём, а не уезжало к верху экрана
    // (две строки height: вторая с dvh — на телефонах адресная строка меняет высоту окна)
    ".panel{display:none;flex-direction:column;width:340px;max-width:calc(100vw - 32px);height:440px;max-height:calc(100vh - 200px);margin-bottom:10px;background:" + INK + ";border:1px solid " + LINE + ";border-radius:16px;overflow:hidden;box-shadow:0 16px 44px rgba(0,0,0,.6);color:" + TEXT + "}" +
    ".panel{height:min(440px, calc(100dvh - 200px))}" +
    ".panel.on{display:flex}" +
    ".head{padding:14px 16px;font-weight:600;font-size:16px;display:flex;justify-content:space-between;align-items:center;color:" + DARK + "}" +
    ".head button{background:none;border:0;color:" + DARK + ";font-size:22px;line-height:1;cursor:pointer;opacity:.75}" +
    ".head button:hover{opacity:1}" +
    ".list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:" + INK + "}" +
    ".m{max-width:80%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word}" +
    ".me{align-self:flex-end;color:" + DARK + ";border-bottom-right-radius:4px}" +
    ".ag{align-self:flex-start;background:" + PANEL + ";color:" + TEXT + ";border-bottom-left-radius:4px}" +
    ".err{align-self:center;font-size:12px;color:#eb5757}" +
    ".quick{padding:0 12px 10px;display:none;flex-direction:column;gap:6px}" +
    ".quick.on{display:flex}" +
    ".quick i{font-style:normal;font-size:12px;color:" + MUTED + "}" +
    ".quick button{text-align:left;border:1px solid " + LINE + ";background:" + PANEL + ";border-radius:10px;padding:8px 10px;font-size:13px;color:" + TEXT + ";cursor:pointer}" +
    ".quick button:hover{border-color:rgba(198,255,77,.45)}" +
    ".links{padding:8px 12px 0;display:none;flex-wrap:wrap;gap:6px;align-items:center;border-top:1px solid " + LINE + "}" +
    ".links.on{display:flex}" +
    ".links i{font-style:normal;font-size:12px;color:" + MUTED + ";width:100%}" +
    ".links a{display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;color:#cfd4cb;border:1px solid " + LINE + ";border-radius:99px;padding:5px 10px}" +
    ".links a:hover{border-color:rgba(198,255,77,.45);color:" + TEXT + "}" +
    ".note{display:none;padding:8px 12px;background:rgba(198,255,77,.10);color:#c6ff4d;font-size:12px;line-height:1.4}" +
    ".note.on{display:block}" +
    ".cta{display:none;margin:0 12px 10px;padding:10px;border-radius:10px;text-align:center;font-size:14px;font-weight:600;text-decoration:none;color:" + DARK + "}" +
    ".cta.on{display:block}" +
    ".ask{display:none;flex-direction:column;gap:6px;padding:10px 12px;border-top:1px solid " + LINE + "}" +
    ".ask.on{display:flex}" +
    ".ask b{font-size:12px;color:" + TEXT + "}" +
    ".ask i{font-style:normal;font-size:11px;color:" + MUTED + "}" +
    ".ask div{display:flex;gap:6px}" +
    ".ask input{flex:1;min-width:0;height:34px;border:1px solid " + LINE + ";background:" + PANEL + ";color:" + TEXT + ";border-radius:8px;padding:0 10px;font-size:13px;outline:none}" +
    ".ask input:focus{border-color:rgba(198,255,77,.55)}" +
    ".ask button{border:0;border-radius:8px;padding:0 12px;font-size:13px;font-weight:600;color:" + DARK + ";cursor:pointer}" +
    ".rate{display:flex;gap:6px;margin-top:4px}" +
    ".rate button{border:0;background:none;cursor:pointer;font-size:14px;opacity:.45;padding:0 2px}" +
    ".rate button.on{opacity:1}" +
    "form{display:flex;gap:8px;padding:10px;border-top:1px solid " + LINE + "}" +
    "input.text{flex:1;min-width:0;height:40px;border:1px solid " + LINE + ";background:" + PANEL + ";color:" + TEXT + ";border-radius:20px;padding:0 14px;font-size:14px;outline:none}" +
    "input.text:focus{border-color:rgba(198,255,77,.55)}" +
    "input.text::placeholder{color:" + MUTED + "}" +
    "form button[type=submit]{border:0;border-radius:20px;padding:0 16px;font-weight:600;cursor:pointer;color:" + DARK + "}" +
    "form .clip{background:none;border:0;font-size:18px;line-height:1;cursor:pointer;padding:0 2px;border-radius:0;color:" + MUTED + "}" +
    "form .clip:hover{color:" + TEXT + "}" +
    "</style>" +
    '<div class="panel" role="dialog"><div class="head"><span class="title"></span><button type="button" class="x" aria-label="' + T.close + '">×</button></div>' +
    '<div class="note"></div><div class="list"></div><div class="quick"></div>' +
    '<div class="ask"><b>' + T.contactTitle + "</b><i>" + T.contactHint + '</i><div><input maxlength="120" aria-label="' + T.contactTitle + '"><button type="button">' + T.contactSend + "</button></div></div>" +
    '<div class="links"></div><a class="cta" target="_blank" rel="noopener"></a>' +
    '<form><button class="clip" type="button" aria-label="' + T.file + '" title="' + T.file + '">📎</button>' +
    '<input class="text" maxlength="1000" placeholder="' + T.ph + '" aria-label="' + T.ph + '"><input class="file" type="file" hidden>' +
    '<button type="submit">' + T.send + "</button></form></div>" +
    // Круглые кнопки выбора связи: нажатие на пузырь раскрывает их, посетитель выбирает удобный канал
    '<div class="launcher"><button type="button" class="chat" aria-label="' + T.chat + '" title="' + T.chat + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg></button>' +
    '<a class="tg" target="_blank" rel="noopener" aria-label="Telegram" title="Telegram" style="color:#fff;background:#229ED9"><svg width="22" height="22" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z"/></svg></a>' +
    '<a class="vb" target="_blank" rel="noopener" aria-label="Viber" title="Viber" style="color:#fff;background:#7360F2"><svg width="22" height="22" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M444 49.9C431.3 38.2 379.9.9 265.3.4c0 0-135.1-8.1-200.9 52.3C27.8 89.3 14.9 143 13.5 209.5c-1.4 66.5-3.1 191.1 117 224.9h.1l-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5zM457.9 287c-12.9 104-89 110.6-103 115.1-6 1.9-61.5 15.7-131.2 11.2 0 0-52 62.7-68.2 79-5.3 5.3-11.1 4.8-11-5.7 0-6.9.4-85.7.4-85.7-.1 0-.1 0 0 0-101.8-28.2-95.8-134.3-94.7-189.8 1.1-55.5 11.6-101 42.6-131.6 55.7-50.5 170.4-43 170.4-43 96.9.4 143.3 29.6 154.1 39.4 35.7 30.6 53.9 103.8 40.6 211.1zm-139-80.8c.4 8.6-12.5 9.2-12.9.6-1.1-22-11.4-32.7-32.6-33.9-8.6-.5-7.8-13.4.7-12.9 27.9 1.5 43.4 17.5 44.8 46.2zm20.3 11.3c1-42.4-25.5-75.6-75.8-79.3-8.5-.6-7.6-13.5.9-12.9 58 4.2 88.9 44.1 87.8 92.5-.1 8.6-13.1 8.2-12.9-.3zm47 13.4c.1 8.6-12.9 8.7-12.9.1-.6-81.5-54.9-125.9-120.8-126.4-8.5-.1-8.5-12.9 0-12.9 73.7.5 133 51.4 133.7 139.2zM374.9 329v.2c-10.8 19-31 40-51.8 33.3l-.2-.3c-21.1-5.9-70.8-31.5-102.2-56.5-16.2-12.8-31-27.9-42.4-42.4-10.3-12.9-20.7-28.2-30.8-46.6-21.3-38.5-26-55.7-26-55.7-6.7-20.8 14.2-41 33.3-51.8h.2c9.2-4.8 18-3.2 23.9 3.9 0 0 12.4 14.8 17.7 22.1 5 6.8 11.7 17.7 15.2 23.8 6.1 10.9 2.3 22-3.7 26.6l-12 9.6c-6.1 4.9-5.3 14-5.3 14s17.8 67.3 84.3 84.3c0 0 9.1.8 14-5.3l9.6-12c4.6-6 15.7-9.8 26.6-3.7 14.7 8.3 33.4 21.2 45.8 32.9 7 5.7 8.6 14.4 3.8 23.6z"/></svg></a>' +
    '<a class="wa" target="_blank" rel="noopener" aria-label="WhatsApp" title="WhatsApp" style="color:#fff;background:#25D366"><svg width="22" height="22" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg></a>' +'</div>' +
    '<button class="btn" type="button" aria-label="Chat"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg><span class="dot"></span></button>';

  var $ = function (s) { return root.querySelector(s); };
  var panel = $(".panel"), list = $(".list"), input = $("input.text"), btn = $(".btn"), dot = $(".dot");

  function paint() {
    // Акцент (лаймовый по умолчанию) — на шапку, пузырь, кнопку отправки и подписи; выбирается в настройках канала
    $(".head").style.background = cfg.color;
    btn.style.background = cfg.color;
    $("form button[type=submit]").style.background = cfg.color;
    $(".ask button").style.background = cfg.color;
    $(".title").textContent = cfg.title;

    // Круглые кнопки выбора связи: чат — всегда, мессенджеры — только те, что фирма подключила
    var linksCfg = cfg.links || {};
    var launcher = $(".launcher");
    // кнопка «чат» — цвета фирмы, и значки на ней тёмные, как у остальных акцентных элементов
    launcher.querySelector(".chat").style.background = cfg.color;
    launcher.querySelector(".chat").style.color = DARK;
    [["tg", "telegram"], ["vb", "viber"], ["wa", "whatsapp"]].forEach(function (pair) {
      var el = launcher.querySelector("." + pair[0]);
      var url = linksCfg[pair[1]];
      el.style.display = url ? "flex" : "none";
      if (url) el.href = url;
    });

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

  // Пузырь раскрывает круглые кнопки, а окно чата открывает кнопка «чат» среди них: посетитель сам
  // выбирает, где ему удобнее разговаривать. Повторное нажатие на пузырь всё закрывает.
  function closeAll() {
    open = false;
    panel.classList.remove("on");
    $(".launcher").classList.remove("on");
    schedule();
  }

  function openPanel() {
    $(".launcher").classList.remove("on");
    panel.classList.add("on");
    open = true;
    render();
    poll();
    input.focus();
    revealContact(isOffline());
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

  // Нажатие мимо окна закрывает и переписку, и список каналов. composedPath нужен потому, что внутри
  // теневого дерева обычный target показывает сам узел, а не контейнер.
  document.addEventListener("pointerdown", function (e) {
    if (!host || !host.isConnected) return;
    var path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.indexOf(host) >= 0) return;
    if (open || $(".launcher").classList.contains("on")) closeAll();
  }, true);

  btn.addEventListener("click", function () {
    if (open) return closeAll();
    var launcher = $(".launcher");
    launcher.classList.toggle("on");
  });
  $(".launcher .chat").addEventListener("click", openPanel);
  $(".x").addEventListener("click", closeAll);
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
