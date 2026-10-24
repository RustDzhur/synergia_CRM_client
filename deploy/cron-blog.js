// Ежедневный блог-робот: cron сервера каждые 10 минут, запускается внутри контейнера CRM
// (docker exec -i firmspace-crm node - < /home/server/cron-blog.js). Сам запуск — маршрут
// /api/cron/blog (CRON_SECRET); защита от дублей и лимит 2 статьи/сутки — внутри маршрута.
fetch("http://127.0.0.1:3000/api/cron/blog", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } })
    .then((r) => r.text())
    .then((t) => { console.log(new Date().toISOString(), t); })
    .catch((e) => { console.error("cron-blog:", e); process.exit(1); });
