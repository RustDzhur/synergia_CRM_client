const out = [];
const show = (label, status, body) => out.push(`${label}: HTTP ${status} :: ${String(body).slice(0, 300)}`);

// 1) monobank pubkey с фейковым токеном
try {
    const r = await fetch("https://api.monobank.ua/api/merchant/pubkey", { headers: { "X-Token": "zz-fake-token" } });
    show("monobank pubkey(fake)", r.status, await r.text());
} catch (e) { out.push("monobank pubkey(fake): FAILED " + e.message); }

// 2) NOWPayments balance с фейковым ключом + status
try {
    const r = await fetch("https://api.nowpayments.io/v1/balance", { headers: { "x-api-key": "zz-fake" } });
    show("nowpayments balance(fake)", r.status, await r.text());
} catch (e) { out.push("nowpayments balance(fake): FAILED " + e.message); }

// 3) LiqPay request/status с фейковыми ключами (формула из lib/payments)
try {
    const { createHash } = await import("node:crypto");
    const publicKey = "i00000000000", privateKey = "zz-fake-private";
    const data = Buffer.from(JSON.stringify({ version: 3, public_key: publicKey, action: "status", order_id: "zz-probe" })).toString("base64");
    const signature = createHash("sha1").update(privateKey + data + privateKey).digest("base64");
    const r = await fetch("https://www.liqpay.ua/api/request", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data, signature }).toString() });
    show("liqpay status(fake)", r.status, await r.text());
} catch (e) { out.push("liqpay status(fake): FAILED " + e.message); }

// 4) WayForPay CHECK_STATUS с фейковым мерчантом (формула HMAC_MD5 из lib/payments)
try {
    const { createHmac } = await import("node:crypto");
    const merchantAccount = "zz_fake_merchant", secretKey = "zz-fake-secret";
    const orderReference = "zz-probe";
    const merchantSignature = createHmac("md5", secretKey).update([merchantAccount, orderReference].join(";")).digest("hex");
    const r = await fetch("https://api.wayforpay.com/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionType: "CHECK_STATUS", apiVersion: 2, merchantAccount, orderReference, merchantSignature }) });
    show("wayforpay CHECK_STATUS(fake)", r.status, await r.text());
} catch (e) { out.push("wayforpay CHECK_STATUS(fake): FAILED " + e.message); }

// 5) Prom / Rozetka / OLX с фейковыми токенами — проверить форму отказов
try {
    const r = await fetch("https://my.prom.ua/api/v1/orders/list", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer zz-fake" }, body: JSON.stringify({ limit: 1 }) });
    show("prom orders(fake)", r.status, await r.text());
} catch (e) { out.push("prom orders(fake): FAILED " + e.message); }
try {
    const r = await fetch("https://api-seller.rozetka.com.ua/orders/search?page=1", { headers: { Authorization: "Bearer zz-fake" } });
    show("rozetka orders(fake)", r.status, await r.text());
} catch (e) { out.push("rozetka orders(fake): FAILED " + e.message); }
try {
    const r = await fetch("https://www.olx.ua/api/partner/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: "zz", client_secret: "zz", scope: "read" }).toString() });
    show("olx token(fake)", r.status, await r.text());
} catch (e) { out.push("olx token(fake): FAILED " + e.message); }

// 6) Новая Почта с фейковым ключом
try {
    const r = await fetch("https://api.novaposhta.ua/v2.0/json/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: "zz-fake", modelName: "Common", calledMethod: "getTimeIntervals", methodProperties: {} }) });
    show("novaposhta getTimeIntervals(fake)", r.status, await r.text());
} catch (e) { out.push("novaposhta(fake): FAILED " + e.message); }

console.log(out.join("\n"));
