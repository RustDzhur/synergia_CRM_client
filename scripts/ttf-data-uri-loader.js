/**
 * Отдаёт содержимое .ttf как data-URI (base64) — шрифт счёта встраивается прямо в бандл,
 * чтобы рендер PDF не зависел от файлов в node_modules (см. комментарий в next.config.js).
 * raw = true обязателен: иначе webpack отдаёт содержимое уже декодированным в UTF-8 и бинарник портится.
 */
function ttfDataUriLoader(content) {
  const base64 = Buffer.from(content).toString("base64");
  return `module.exports = ${JSON.stringify(`data:font/ttf;base64,${base64}`)};`;
}

module.exports = ttfDataUriLoader;
module.exports.raw = true;
