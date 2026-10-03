FROM node:24-bookworm
RUN npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs \
      @deepseek-ai/dsh@0.2.0-rc.2 \
 && dsh --version
RUN npm install -g pnpm@10 && pnpm --version

# Патч 1. Постоянный launch-токен web-UI.
# Без патча processLaunchToken() генерирует новый токен при каждом старте процесса,
# и ссылку приходилось брать заново после каждого перезапуска сервера.
RUN set -eux; \
    F=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js; \
    sed -i 's|const created = encodeBase64Url(randomBytes(SECRET_BYTES));|const created = process.env.DSH_WEB_TOKEN ?? encodeBase64Url(randomBytes(SECRET_BYTES));|' "$F"; \
    grep -q DSH_WEB_TOKEN "$F"

# Патч 2. Разрешить страницу Settings (провайдеры моделей, плагин-маркет) при заходе
# по домену, а не только по loopback. Клиент сам решает доступность настроек флагом
# ctx.remote.$host.isLoopback: не-loopback страницы получают persistence "memory"
# и показывают «settings are unavailable in this browser».
RUN set -eux; \
    A=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings/lib/client.js; \
    B=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js; \
    sed -i 's#const persistence = ctx.remote.$host.isLoopback ? "host" : "memory";#const persistence = "host";#' "$A"; \
    grep -q 'const persistence = "host";' "$A"; \
    sed -i 's#ctx.remote.$host.isLoopback ? new SettingsDocumentStore#true ? new SettingsDocumentStore#' "$B"; \
    grep -q 'true ? new SettingsDocumentStore' "$B"

# Патч 3. Голосовой ввод на русском: штатный SenseVoice знает только zh/en/ja/ko; регистрация подменяется на Whisper (облако через omniroute,
# запасной — свой speaches). Подробности и настройка — в начале patch-stt.mjs.
COPY patch-stt.mjs /tmp/patch-stt.mjs
RUN node /tmp/patch-stt.mjs && rm /tmp/patch-stt.mjs

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
WORKDIR /workspace
EXPOSE 3080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
