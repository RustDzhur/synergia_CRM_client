/*! Firmspace CRM — онлайн-чат для сайта.
 *  Подключение: <script src="https://ВАШ-САЙТ/widget.js" data-token="ТОКЕН" async></script>
 *  Токен и готовый код — в CRM: Settings → Integration → Online Chat.
 *
 *  Устройство: один пузырь в углу и одно окно. Нажатие на пузырь открывает окно (второе нажатие
 *  закрывает), мессенджеры фирмы стоят строкой внутри окна, форма контакта появляется, когда человек
 *  действительно нужен. Настройки — заголовок, приветствие, цвет, каналы, часы работы — приходят
 *  из CRM (GET /api/webchat/<token>). */
(function () {
  var script = document.currentScript;
  if (!script || window.__synergiaChat) return;
  var token = script.getAttribute("data-token");
  if (!token) return console.warn("[Firmspace chat] data-token is missing");
  window.__synergiaChat = true;

  var api = new URL(script.src).origin + "/api/webchat/" + encodeURIComponent(token);
  // Язык берём со страницы, а не из браузера: на немецком сайте с английским браузером окно должно
  // быть немецким. Порядок: data-lang из кода встраивания → <html lang> → первая часть пути (…/de/…) →
  // язык браузера. Наш сайт помечает украинские страницы кодом «ua» (у него своя локаль в next-intl),
  // а стандартный код украинского — «uk»: сводим оба (и «ru») к одному, иначе окно падало в английский.
  var pageLang = (function () {
    var fromAttr = script.getAttribute("data-lang");
    var fromHtml = document.documentElement && document.documentElement.lang;
    var fromPath = (location.pathname.split("/")[1] || "").slice(0, 2);
    var raw = String(fromAttr || fromHtml || fromPath || navigator.language || "en").toLowerCase().slice(0, 2);
    if (raw === "ua" || raw === "ru") return "uk";
    return ["de", "uk", "en"].indexOf(raw) >= 0 ? raw : "en";
  })();
  var lang = pageLang;
  var T = {
    de: {
      ph: "Nachricht schreiben…", send: "Senden", err: "Nachricht nicht gesendet. Bitte erneut versuchen.", close: "Schließen",
      quick: "Häufige Fragen", write: "Oder schreiben Sie uns — wir antworten persönlich.", more: "Auch erreichbar über",
      cta: "Kostenlos starten", offline: "Gerade ist niemand im Dienst. Hinterlassen Sie Ihren Kontakt — wir melden uns.",
      online: "Wir sind für Sie da", outside: "Außerhalb der Dienstzeiten",
      contactTitle: "Wie erreichen wir Sie?", contactHint: "E-Mail oder Telefonnummer — wir melden uns, falls es im Chat nicht klappt.", contactPh: "E-Mail oder Telefonnummer",
      contactSend: "Senden", contactBad: "Bitte prüfen Sie die E-Mail oder Nummer.", contactThanks: "Danke! Wir melden uns bei Ihnen.",
      rateUp: "Hat geholfen", rateDown: "Hat nicht geholfen",
      chat: "Im Chat schreiben",
      file: "Datei anhängen", fileBad: "Die Datei konnte nicht gesendet werden (max. 4 MB).",
    },
    uk: {
      ph: "Напишіть повідомлення…", send: "Надіслати", err: "Не вдалося надіслати. Спробуйте ще раз.", close: "Закрити",
      quick: "Часті питання", write: "Або напишіть нам — відповімо особисто.", more: "Також пишіть у",
      cta: "Почати безкоштовно", offline: "Зараз неробочий час. Залиште контакт — ми звʼяжемося.",
      online: "Ми на звʼязку", outside: "Неробочий час",
      contactTitle: "Як з вами звʼязатися?", contactHint: "Пошта або телефон — напишемо, якщо не встигнемо в чаті.", contactPh: "Пошта або телефон",
      contactSend: "Надіслати", contactBad: "Перевірте пошту або номер.", contactThanks: "Дякуємо! Ми звʼяжемося з вами.",
      rateUp: "Допомогло", rateDown: "Не допомогло",
      chat: "Написати в чат",
      file: "Прикріпити файл", fileBad: "Не вдалося надіслати файл (до 4 МБ).",
    },
  }[lang] || {
    ph: "Type a message…", send: "Send", err: "Message was not sent. Try again.", close: "Close",
    quick: "Common questions", write: "Or write to us — a person will answer.", more: "Also reachable in",
    cta: "Start free", offline: "Nobody is online right now. Leave your contact — we will get back to you.",
    online: "We are here", outside: "Outside working hours",
    contactTitle: "How can we reach you?", contactHint: "E-mail or phone — we will write back if the chat does not work out.", contactPh: "E-mail or phone",
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

  // Акцент по умолчанию — лаймовый, как на сайте и в кабинете: фирма может выбрать свой в настройках канала,
  // но новый канал должен совпадать с сайтом сразу, а не становиться синим
  var cfg = { title: "Chat with us", greeting: "Hello! How can we help?", color: "#C6FF4D", quick: [], links: {}, hours: null, cta: null };
  var open = false, messages = [], seen = 0, timer = null;

  // Оформление под тёмный сайт: почти чёрные слои и лаймовый акцент, как в кабинете и на лендинге
  var INK = "#131715", INK_DEEP = "#101412", PANEL = "#1d2320", LINE = "rgba(255,255,255,.10)", TEXT = "#f1f4ee", MUTED = "#8c948b", DARK = "#0a0c0b";

  // Текст поверх акцента фирмы: у лаймового это почти чёрный, у тёмно-синего — белый. Фирма выбирает
  // любой цвет, и раньше на тёмном выборе подписи становились невидимыми — считаем по яркости
  function onAccent(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
    if (!m) return DARK;
    var lin = function (v) { v = parseInt(v, 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var l = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
    return l > 0.35 ? DARK : "#ffffff";
  }

  var host = document.createElement("div");
  // пометка нужна, чтобы виджет можно было убрать при переходе в кабинет (см. components/website/components/ChatWidget.tsx)
  host.setAttribute("data-firmspace-chat", "1");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  root.innerHTML =
    "<style>" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
    ".btn{width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;color:" + DARK + ";box-shadow:0 8px 22px rgba(0,0,0,.5);transition:transform .18s ease}" +
    ".btn:hover{transform:scale(1.04)}" +
    ".dot{position:absolute;top:2px;right:2px;min-width:14px;height:14px;border-radius:7px;background:#e5484d;border:2px solid " + INK + ";display:none}" +
    // Высота окна ограничена так, чтобы оно всегда висело над пузырём, а не уезжало к верху экрана
    // (две строки height: вторая с dvh — на телефонах адресная строка меняет высоту окна).
    // Запас — только под пузырь и отступы (56 + 12 + 16 + 16), колонка каналов при открытом окне убрана,
    // поэтому переписке достаётся больше места, чем раньше
    ".panel{display:none;flex-direction:column;width:340px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);margin-bottom:12px;background:" + INK + ";border:1px solid " + LINE + ";border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.62);color:" + TEXT + ";transform-origin:100% 100%}" +
    ".panel{height:min(520px, calc(100dvh - 100px))}" +
    ".panel.on{display:flex;animation:pop .18s ease}" +
    "@keyframes pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}" +
    // Шапка — «лицо» фирмы: кружок с её цветом, название и состояние (на связи / нерабочее время).
    // Сплошная цветная полоса выглядела чужой на тёмном сайте, поэтому акцент ушёл в кружок и кнопки
    ".head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px 11px 14px;background:" + INK_DEEP + ";border-bottom:1px solid " + LINE + "}" +
    ".who{display:flex;align-items:center;gap:10px;min-width:0}" +
    ".ava{width:34px;height:34px;border-radius:50%;flex:0 0 34px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:" + DARK + "}" +
    ".cap{display:flex;flex-direction:column;min-width:0}" +
    ".cap b{font-size:14px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".cap i{font-style:normal;font-size:11px;color:" + MUTED + ";line-height:1.3;display:flex;align-items:center;gap:5px}" +
    ".st{width:6px;height:6px;border-radius:50%;background:#5fbf3c;flex:0 0 6px}" +
    ".head .x{background:none;border:0;color:" + MUTED + ";font-size:20px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:8px}" +
    ".head .x:hover{color:" + TEXT + ";background:rgba(255,255,255,.05)}" +
    ".list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:" + INK + "}" +
    ".m{max-width:80%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word}" +
    ".me{align-self:flex-end;color:" + DARK + ";border-bottom-right-radius:4px}" +
    ".ag{align-self:flex-start;background:" + PANEL + ";color:" + TEXT + ";border-bottom-left-radius:4px}" +
    ".err{align-self:center;font-size:12px;color:#eb5757}" +
    // Системная строка в переписке (нерабочее время): раньше это была полоса над списком, и вместе
    // с формой контакта в окне оказывалось три объяснения одного и того же
    ".sys{align-self:stretch;text-align:center;font-size:11.5px;line-height:1.45;color:#c6ff4d;background:rgba(198,255,77,.08);border:1px solid rgba(198,255,77,.22);border-radius:10px;padding:7px 10px}" +
    ".quick{padding:0 12px 10px;display:none;flex-direction:column;gap:6px}" +
    ".quick.on{display:flex}" +
    ".quick i{font-style:normal;font-size:12px;color:" + MUTED + "}" +
    ".quick button{text-align:left;border:1px solid " + LINE + ";background:" + PANEL + ";border-radius:10px;padding:8px 10px;font-size:13px;color:" + TEXT + ";cursor:pointer;transition:border-color .15s ease,background .15s ease}" +
    ".quick button:hover{border-color:rgba(198,255,77,.45);background:rgba(198,255,77,.06)}" +
    ".links{padding:8px 12px 0;display:none;flex-wrap:wrap;gap:6px;align-items:center;border-top:1px solid " + LINE + "}" +
    ".links.on{display:flex}" +
    ".links i{font-style:normal;font-size:12px;color:" + MUTED + ";width:100%}" +
    ".links a{display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;color:#cfd4cb;border:1px solid " + LINE + ";border-radius:99px;padding:5px 10px;transition:border-color .15s ease,color .15s ease}" +
    ".links a:hover{border-color:rgba(198,255,77,.45);color:" + TEXT + "}" +
    ".cta{display:none;margin:0 12px 10px;padding:10px;border-radius:10px;text-align:center;font-size:14px;font-weight:600;text-decoration:none;color:" + DARK + "}" +
    ".cta.on{display:block}" +
    // Контакт: подпись и одно поле. Раньше строкой ниже висело объяснение «мы напишем, если не выйдет в чате» —
    // то же самое уже сказано системной строкой в переписке, и на телефоне это съедало две строки высоты
    ".ask{display:none;flex-direction:column;gap:7px;padding:10px 12px;border-top:1px solid " + LINE + "}" +
    ".ask.on{display:flex}" +
    ".ask b{font-size:12px;color:" + TEXT + "}" +
    ".ask div{display:flex;gap:6px;align-items:center}" +
    ".ask input{flex:1;min-width:0;height:38px;border:1px solid " + LINE + ";background:" + PANEL + ";color:" + TEXT + ";border-radius:19px;padding:0 14px;font-size:13px;outline:none}" +
    ".ask input:focus{border-color:rgba(198,255,77,.55)}" +
    ".ask input::placeholder{color:" + MUTED + "}" +
    ".ask button{width:38px;height:38px;flex:0 0 38px;border-radius:50%;border:0;cursor:pointer;color:" + DARK + ";display:flex;align-items:center;justify-content:center}" +
    ".rate{display:flex;gap:6px;margin-top:4px}" +
    ".rate button{border:0;background:none;cursor:pointer;font-size:14px;opacity:.45;padding:0 2px}" +
    ".rate button.on{opacity:1}" +
    "form{display:flex;gap:8px;align-items:center;padding:10px;border-top:1px solid " + LINE + "}" +
    "input.text{flex:1;min-width:0;height:40px;border:1px solid " + LINE + ";background:" + PANEL + ";color:" + TEXT + ";border-radius:20px;padding:0 14px;font-size:14px;outline:none}" +
    "input.text:focus{border-color:rgba(198,255,77,.55)}" +
    "input.text::placeholder{color:" + MUTED + "}" +
    // Отправка — круглая кнопка со стрелкой: подпись «Senden» занимала четверть строки ввода,
    // а сама кнопка читалась как второй, конкурирующий вход
    "form .send{width:40px;height:40px;flex:0 0 40px;border-radius:50%;border:0;cursor:pointer;color:" + DARK + ";display:flex;align-items:center;justify-content:center;transition:transform .15s ease}" +
    "form .send:hover{transform:scale(1.05)}" +
    "form .clip{background:none;border:0;font-size:18px;line-height:1;cursor:pointer;padding:0 2px;border-radius:0;color:" + MUTED + "}" +
    "form .clip:hover{color:" + TEXT + "}" +
    "</style>" +
    '<div class="panel" role="dialog" aria-label="' + T.chat + '">' +
    '<div class="head"><span class="who"><span class="ava"></span><span class="cap"><b class="title"></b><i><span class="st"></span><span class="status"></span></i></span></span>' +
    '<button type="button" class="x" aria-label="' + T.close + '">×</button></div>' +
    '<div class="list"></div><div class="quick"></div>' +
    '<div class="ask"><b>' + T.contactTitle + '</b><div><input maxlength="120" placeholder="' + T.contactPh + '" aria-label="' + T.contactHint + '">' +
    '<button type="button" aria-label="' + T.contactSend + '" title="' + T.contactSend + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button></div></div>' +
    '<div class="links"></div><a class="cta" target="_blank" rel="noopener"></a>' +
    '<form><button class="clip" type="button" aria-label="' + T.file + '" title="' + T.file + '">📎</button>' +
    '<input class="text" maxlength="1000" placeholder="' + T.ph + '" aria-label="' + T.ph + '"><input class="file" type="file" hidden>' +
    '<button class="send" type="submit" aria-label="' + T.send + '" title="' + T.send + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button></form></div>' +
    // Круглые кнопки выбора связи: нажатие на пузырь раскрывает их, посетитель выбирает удобный канал.
    // Чат стоит последним — прямо над пузырём и ближе к пальцу, мессенджеры выше него
    '<button class="btn" type="button" aria-label="Chat"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg><span class="dot"></span></button>';

  var $ = function (s) { return root.querySelector(s); };
  var panel = $(".panel"), list = $(".list"), input = $("input.text"), btn = $(".btn"), dot = $(".dot");

  function paint() {
    // Акцент фирмы (по умолчанию лаймовый, как на сайте) — кружок в шапке, пузырь, кнопка отправки
    // и кнопка формы контакта: цвет выбирается в настройках канала
    $(".ava").style.background = cfg.color;
    $(".ava").style.color = onAccent(cfg.color);
    $(".ava").textContent = String(cfg.title || "?").trim().charAt(0).toUpperCase();
    btn.style.background = cfg.color;
    btn.style.color = onAccent(cfg.color);
    $("form .send").style.background = cfg.color;
    $("form .send").style.color = onAccent(cfg.color);
    $(".ask button").style.background = cfg.color;
    $(".ask button").style.color = onAccent(cfg.color);
    $(".title").textContent = cfg.title;

    // Круглые кнопки выбора связи: чат — всегда, мессенджеры — только те, что фирма подключила
    var linksCfg = cfg.links || {};

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
      cta.style.color = onAccent(cfg.color);
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

  // Состояние фирмы — строкой под названием в шапке (точка зелёная внутри часов работы, серая вне них),
  // а само объяснение «оставьте контакт» показывается системной строкой в переписке — см. render()
  var offline = false;
  function showOffline() {
    offline = isOffline();
    $(".status").textContent = offline ? T.outside : T.online;
    $(".st").style.background = offline ? MUTED : "#5fbf3c";
  }

  // Форма контакта: показываем, когда человек нужен, — вне рабочих часов или когда бот не нашёл ответа
  var contactWanted = false;
  function revealContact(show) {
    if (show) contactWanted = true;
    $(".ask").classList.toggle("on", !!show || contactWanted);
    // форма съедает у списка свою высоту — последняя реплика иначе остаётся обрезанной снизу
    scrollDown();
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

  function scrollDown() { list.scrollTop = list.scrollHeight; }

  // Пузырь в списке сообщений. Объявлен снаружи отрисовки: им пользуется и форма контакта
  function addBubble(cls, text, bg) {
    var d = document.createElement("div");
    d.className = "m " + cls;
    if (bg) d.style.background = bg;
    // реплика посетителя — цветом фирмы, и текст на нём подбираем по яркости этого цвета
    if (bg && cls === "me") d.style.color = onAccent(bg);
    d.textContent = text;
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
    return d;
  }

  // Системная строка в переписке: то, что не реплика, а состояние (нерабочее время)
  function addSys(text) {
    var d = document.createElement("div");
    d.className = "sys";
    d.textContent = text;
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
    return d;
  }

  function render() {
    list.textContent = "";
    var add = addBubble;
    showOffline(); // состояние фирмы считаем до отрисовки: от него зависит системная строка
    add("ag", cfg.greeting);
    if (offline) addSys(T.offline);
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

  // Пузырь открывает окно сразу, а не список каналов: раньше нажатие раскрывало колонку круглых кнопок
  // (чат, мессенджеры), окно открывалось второй кнопкой, и между ним и пузырём оставалась её высота —
  // окно висело далеко над пузырём. Мессенджеры никуда не делись: они строкой «Також пишіть у» в окне.
  function closeAll() {
    open = false;
    panel.classList.remove("on");
    schedule();
  }

  function openPanel() {
    panel.classList.add("on");
    open = true;
    render();
    poll();
    input.focus();
    revealContact(isOffline());
    scrollDown();
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

  // Нажатие мимо окна закрывает переписку. composedPath нужен потому, что внутри теневого дерева
  // обычный target показывает сам узел, а не контейнер.
  document.addEventListener("pointerdown", function (e) {
    if (!host || !host.isConnected) return;
    var path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.indexOf(host) >= 0) return;
    if (open) closeAll();
  }, true);

  // Пузырь — единственная кнопка: открыть окно, повторное нажатие закрывает
  btn.addEventListener("click", function () {
    if (open) closeAll();
    else openPanel();
  });
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
