# Приватный репозиторий и выкладка

Репозиторий `RustDzhur/synergia_CRM_client` может быть приватным: серверы **не** ходят в GitHub анонимно.

- **Код** сервер берёт по SSH с read-only **deploy-ключом** (`~/.ssh/github_deploy` на сервере; публичную часть добавляют в GitHub → Settings → Deploy keys, без права записи; remote — `git@github.com:RustDzhur/synergia_CRM_client.git`).
- **Зелёный CI** передаётся веткой `deploy`: после успешной проверки задача `publish-deploy` (`.github/workflows/ci.yml`) переносит коммит из `main` в `deploy` (только вперёд). Автовыкладка (`DEPLOY_BRANCH=deploy`, `REQUIRE_CI=0` в `deploy/autodeploy.env` на сервере) берёт только её — публичный API GitHub для статуса проверок больше не нужен.
- Если ветка `deploy` не обновляется — смотрите вкладку Actions: красная сборка = выкладки нет (так и задумано).
- Старый домашний сервер (`deploy/autodeploy.sh`) всё ещё ходит анонимно: при закрытом репозитории ему нужен такой же ключ или он выкладывать не будет.
