#!/usr/bin/env node
// Заливка плана docs/facebook-ads/campaign-plan.json в Meta Marketing API (Graph v23.0).
//
// Правила, зашитые в код:
//   • всё создаётся ТОЛЬКО в status=PAUSED; любой другой статус — отказ до первого запроса;
//   • никаких платежей, billing и funding_source — скрипт про них не знает;
//   • адсеты с ready=false пропускаются (AS2 без пикселя);
//   • без --confirm ничего не пишет: печатает план запросов (dry-run).
//
// Использование:
//   node scripts/fb-ads-upload.mjs                 # dry-run: что будет создано
//   node scripts/fb-ads-upload.mjs --check         # только проверить доступ к аккаунту
//   node scripts/fb-ads-upload.mjs --confirm       # реальная заливка (всё PAUSED)
//   node scripts/fb-ads-upload.mjs --confirm --campaign-id 120...   # дописать в существующую кампанию
//
// Переменные окружения (в git не попадают):
//   FB_SYSTEM_TOKEN   системный токен с ads_management (обязателен для записи)
//   FB_APP_SECRET     секрет приложения — для appsecret_proof (необязателен)
//   FB_GRAPH_URL      по умолчанию https://graph.facebook.com/v23.0
//
// Скрипт НЕ проверен на живом аккаунте: до выдачи ads_management любой запрос вернёт (#200).

import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";

const ROOT = process.cwd();
const PLAN_PATH = path.join(ROOT, "docs/facebook-ads/campaign-plan.json");
const GRAPH = (process.env.FB_GRAPH_URL || "https://graph.facebook.com/v23.0").replace(/\/+$/, "");
const TOKEN = process.env.FB_SYSTEM_TOKEN || process.env.META_SYSTEM_TOKEN || "";
const APP_SECRET = process.env.FB_APP_SECRET || process.env.META_APP_SECRET || "";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = !has("--confirm");
const CHECK_ONLY = has("--check");
const ONLY = valueOf("--only");
const REUSE_CAMPAIGN = valueOf("--campaign-id");

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));

// ── предохранители ────────────────────────────────────────────────────────────
function walk(node, visit, where = "plan") {
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, visit, `${where}[${i}]`));
  if (node && typeof node === "object") {
    visit(node, where);
    for (const [k, v] of Object.entries(node)) walk(v, visit, `${where}.${k}`);
  }
}

const statuses = [];
walk(plan, (obj, where) => {
  for (const key of ["status", "effective_status"]) {
    if (typeof obj[key] === "string") statuses.push({ where: `${where}.${key}`, value: obj[key] });
  }
});
const notPaused = statuses.filter((s) => s.value.toUpperCase() !== "PAUSED");
if (notPaused.length) {
  console.error("ОТКАЗ: в плане есть статус, отличный от PAUSED:\n" + notPaused.map((s) => `  ${s.where} = ${s.value}`).join("\n"));
  process.exit(1);
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
function withProof(params) {
  const out = { ...params };
  if (APP_SECRET && !out.appsecret_proof) out.appsecret_proof = createHmac("sha256", APP_SECRET).update(TOKEN).digest("hex");
  return out;
}

async function graph(pathname, { method = "GET", params = {}, body, form } = {}) {
  const url = new URL(GRAPH + pathname);
  for (const [k, v] of Object.entries(withProof({ ...params, access_token: TOKEN }))) url.searchParams.set(k, String(v));
  const init = { method };
  if (form) init.body = form; // FormData для adimages
  else if (body) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(withProof(body))) fd.set(k, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
    init.body = fd;
  }
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(
      `Meta API ${method} ${pathname}: ${e.message || `HTTP ${res.status}`}` +
        (e.code ? ` (code ${e.code}${e.error_subcode ? `/subcode ${e.error_subcode}` : ""}${e.fbtrace_id ? `, fbtrace ${e.fbtrace_id}` : ""})` : "")
    );
  }
  return json;
}

// ── чистка плана от служебных полей и подстановка ссылок ─────────────────────
// Служебные ключи (notes, ready, blocked_by…) в API не отправляем: Meta отвергает неизвестные поля.
const SERVICE_KEY = /^(?:key|ready|endpoint|upload_endpoint|fallbacks|prerequisites|blocked_by|blocked_reason|text_lengths|note|notes|.*_note)$/;

function stripService(value) {
  if (Array.isArray(value)) return value.map(stripService);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SERVICE_KEY.test(k)) continue;
    if (v === null || v === undefined) continue; // daily_budget: null у кампании не отправляем
    out[k] = stripService(v);
  }
  return out;
}

function resolve(value, ctx, where) {
  if (typeof value === "string") {
    const whole = value.match(/^\{\{(\w+)\}\}$/);
    if (whole) {
      const key = whole[1];
      if (ctx[key] === undefined || ctx[key] === null || ctx[key] === "") throw new Error(`Не разрешён плейсхолдер {{${key}}} в ${where}`);
      return ctx[key];
    }
    return value.replace(/\{\{(\w+)\}\}/g, (m, key) => {
      if (ctx[key] === undefined || ctx[key] === null || ctx[key] === "") throw new Error(`Не разрешён плейсхолдер ${m} в ${where}`);
      return String(ctx[key]);
    });
  }
  if (Array.isArray(value)) return value.map((v, i) => resolve(v, ctx, `${where}[${i}]`));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolve(v, ctx, `${where}.${k}`);
    return out;
  }
  return value;
}

// ── шаги ─────────────────────────────────────────────────────────────────────
const steps = [];
const addStep = (label, pathname, body) => steps.push({ label, pathname, body });

async function main() {
  if (!TOKEN && !DRY) {
    console.error("Нет FB_SYSTEM_TOKEN — реальная заливка невозможна.");
    process.exit(1);
  }

  const act = plan.meta.ad_account_id;
  const probePath = `/act_${act}`;

  if (DRY) {
    addStep("проверка доступа", probePath, { fields: "name,account_status,currency,timezone" });
  } else {
    try {
      const acc = await graph(probePath, { params: { fields: "name,account_status,currency,timezone,disable_reason" } });
      console.log("Доступ к аккаунту есть:", JSON.stringify(acc));
      if (acc.currency && acc.currency !== "EUR") console.warn(`ВНИМАНИЕ: валюта аккаунта ${acc.currency}, бюджеты в плане рассчитаны на EUR — пересчитайте daily_budget.`);
    } catch (e) {
      console.error("Нет доступа к рекламному аккаунту:\n  " + e.message);
      console.error("Нужны: право ads_management/ads_read у приложения + доступ системного пользователя к аккаунту (docs/FACEBOOK_ADS_API.md).");
      process.exit(2);
    }
    if (CHECK_ONLY) return;
  }

  const ctx = { page_id: plan.meta.page_id, instagram_actor_id: plan.meta.instagram_actor_id };

  // 1. картинка
  const imagePath = path.join(ROOT, plan.assets.image);
  addStep("загрузка картинки", `/act_${act}/adimages`, { __image: imagePath });
  if (!DRY) {
    const form = new FormData();
    form.set("filename", new Blob([fs.readFileSync(imagePath)], { type: "image/png" }), path.basename(imagePath));
    const r = await graph(`/act_${act}/adimages`, { method: "POST", form });
    const first = Object.values(r.images || {})[0];
    if (!first?.hash) throw new Error("adimages: в ответе нет hash");
    ctx.image_hash = first.hash;
    console.log("image_hash:", ctx.image_hash);
  }

  // 2. лид-форма
  const leadFormBody = stripService(plan.lead_form);
  addStep("создание Instant Form", `/act_${act}/leadgen_forms`, leadFormBody);
  if (!DRY) {
    ctx.lead_form_id = await createLeadForm(leadFormBody);
    console.log("lead_form_id:", ctx.lead_form_id);
  }

  // 3. кампания
  if (REUSE_CAMPAIGN) {
    ctx.campaign_id = REUSE_CAMPAIGN;
  } else {
    const campaignBody = stripService(plan.campaign);
    addStep("создание кампании", `/act_${act}/campaigns`, campaignBody);
    if (!DRY) {
      await assertNoDuplicateCampaign(plan.campaign.name);
      const c = await graph(`/act_${act}/campaigns`, { method: "POST", body: campaignBody });
      ctx.campaign_id = c.id;
      console.log("campaign_id:", c.id, `(${c.status || "PAUSED"})`);
    }
  }

  // 4. адсеты → креативы → объявления
  for (const adset of plan.adsets) {
    if (adset.ready === false || (ONLY && adset.key !== ONLY)) {
      console.log(`— ${adset.key}: пропущен (${adset.blocked_reason || "ready=false"})`);
      continue;
    }
    const adsetBody = { ...stripService(adset), campaign_id: "{{campaign_id}}" };
    addStep(`создание адсета ${adset.key}`, `/act_${act}/adsets`, adsetBody);
    if (!DRY) {
      const a = await graph(`/act_${act}/adsets`, { method: "POST", body: resolve(adsetBody, ctx, `adsets.${adset.key}`) });
      ctx[`adset_${adset.key}`] = a.id;
      console.log(`adset ${adset.key}:`, a.id, `(${a.status || "PAUSED"})`);
    }

    for (const ad of adset.ads) {
      const creativeBody = stripService(ad.creative);
      addStep(`креатив ${ad.key}`, `/act_${act}/adcreatives`, creativeBody);
      if (!DRY) {
        const cr = await graph(`/act_${act}/adcreatives`, { method: "POST", body: resolve(creativeBody, ctx, `adsets.${adset.key}.ads.${ad.key}.creative`) });
        ctx[`creative_${ad.key}`] = cr.id;
        console.log(`creative ${ad.key}:`, cr.id);
      }

      const adBody = { name: ad.name, status: ad.status, adset_id: `{{adset_${adset.key}}}`, creative: { creative_id: `{{creative_${ad.key}}}` } };
      addStep(`объявление ${ad.key}`, `/act_${act}/ads`, adBody);
      if (!DRY) {
        const created = await graph(`/act_${act}/ads`, { method: "POST", body: resolve(adBody, ctx, `ads.${ad.key}`) });
        console.log(`ad ${ad.key}:`, created.id, `(${created.status || "PAUSED"})`);
      }
    }
  }

  if (DRY) {
    console.log(`\nDRY-RUN: ${steps.length} запросов, ничего не отправлено. Реальная заливка — с флагом --confirm (всё PAUSED).\n`);
    for (const s of steps) {
      const image = s.body && s.body.__image;
      const detail = image ? `файл ${image}` : JSON.stringify(s.body, null, 2).replace(/\n/g, "\n  ");
      console.log(`• ${s.label}: POST ${s.pathname} (${image ? "multipart" : "form"})\n  ${detail}`);
    }
  } else {
    console.log("\nГотово. Все объекты созданы в PAUSED. Ничего не запущено, способ оплаты не добавлялся.");
  }
}

async function createLeadForm(body) {
  const pageId = plan.meta.page_id;
  const act = plan.meta.ad_account_id;
  const swapPrivacy = ({ privacy_policy_url, ...rest }) => (privacy_policy_url ? { ...rest, privacy_policy: { url: privacy_policy_url } } : rest);
  const attempts = [
    { path: `/${pageId}/leadgen_forms`, body },
    { path: `/${pageId}/leadgen_forms`, body: swapPrivacy(body) },
    { path: `/act_${act}/leadgen_forms`, body: { ...body, page_id: pageId } },
    { path: `/act_${act}/leadgen_forms`, body: { ...swapPrivacy(body), page_id: pageId } },
  ];
  let last;
  for (const a of attempts) {
    try {
      return (await graph(a.path, { method: "POST", body: a.body })).id;
    } catch (e) {
      last = e;
      console.warn("leadgen_forms:", e.message);
    }
  }
  throw last;
}

async function assertNoDuplicateCampaign(name) {
  let list = [];
  try {
    const r = await graph(`/act_${plan.meta.ad_account_id}/campaigns`, { params: { fields: "id,name", limit: "500" } });
    list = r.data || [];
  } catch (e) {
    console.warn("не удалось проверить дубликаты:", e.message);
    return;
  }
  const dup = list.find((c) => c.name === name);
  if (dup) throw new Error(`Кампания «${name}» уже существует (${dup.id}). Используйте --campaign-id ${dup.id}, если нужно дописать в неё.`);
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message);
  process.exit(1);
});
