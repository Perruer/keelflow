<p align="center">
  <img src="https://raw.githubusercontent.com/Perruer/keelflow/main/images/keelflow_light.png#gh-light-mode-only" width="360" alt="Keelflow">
  <img src="https://raw.githubusercontent.com/Perruer/keelflow/main/images/keelflow_dark.png#gh-dark-mode-only" width="360" alt="Keelflow">
</p>

<p align="center">
  <b>Визуальный конструктор ИИ-агентов и LLM-процессов. Продолжение Flowise для собственного сервера с исправлениями безопасности.</b>
</p>

<p align="center">
  <a href="https://github.com/Perruer/keelflow/actions/workflows/main.yml"><img src="https://github.com/Perruer/keelflow/actions/workflows/main.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Perruer/keelflow/releases"><img src="https://img.shields.io/github/v/release/Perruer/keelflow" alt="Release"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0"></a>
</p>

<p align="center"><a href="README.md">English</a> · Русский</p>

---

13 августа 2026 года репозиторий Flowise заархивировали, 31 августа поддержка закончилась. Бюллетени об уязвимостях выходят и после этого, но исправлений уже нет, а тысячи установок по-прежнему доступны из интернета.

Keelflow продолжает Flowise 3.1.4: уязвимости закрыты, зависимости обновлены, весь код под лицензией Apache-2.0. Ваши flow, учётные данные, API-ключи и база данных работают без переделок.

## Чем отличается от Flowise 3.1.4

| | Flowise 3.1.4 | Keelflow 3.2 |
| --- | --- | --- |
| Лицензия | Apache-2.0 плюс коммерческая лицензия FlowiseAI: код входа даже в бесплатной версии был коммерческим | Только Apache-2.0. Коммерческий код удалён из истории и заменён собственной реализацией |
| Учётные записи | Владелец (open source); пользователи, роли, SSO (платно) | Одна учётная запись владельца плюс API-ключи с правами на отдельные действия |
| Сессии | JWT в cookie | Серверные сессии с хешированными токенами; смена пароля завершает все входы; ограничение попыток входа |
| Известные уязвимости в зависимостях | 385 (19 критических) | 153 (1 критическая, только на этапе установки) |
| Песочница для пользовательского JavaScript | vm2 3.11.2 с 9 критическими выходами из песочницы | vm2 3.12.2 |
| Наборы данных, оценки, оценщики, логи сервера | Только в платных тарифах | Доступны |
| Сторонние запросы из веб-интерфейса | Трекер партнёрской программы Rewardful, Google Fonts, GitHub API на каждой странице | Нет |
| Список моделей | Скачивается с GitHub при каждом обращении | Встроен в приложение; свой URL или файл — по желанию |
| `X-Forwarded-For` | По умолчанию верит кому угодно | По умолчанию верит только локальной и частной сети |

Закрытые уязвимости и остальные изменения перечислены в [журнале изменений](CHANGELOG.md). Всё, чего там нет, работает как во Flowise 3.1.4: те же узлы, agentflow, хранилища документов, API и виджет для встраивания.

## Быстрый старт

### Docker

```bash
docker run -d --name keelflow -p 3000:3000 -v ~/.keelflow:/home/node/.keelflow ghcr.io/perruer/keelflow:latest
```

Откройте http://localhost:3000 и создайте учётную запись владельца. Образы собираются для `linux/amd64` и `linux/arm64`.

Пример `docker compose` (в том числе режим очередей и Postgres) — в папке [docker/](docker/).

### Из исходников

Нужны Node.js 24 и pnpm 10.

```bash
git clone https://github.com/Perruer/keelflow.git
cd keelflow
pnpm install
pnpm build        # нужно около 4 ГБ памяти: export NODE_OPTIONS=--max-old-space-size=4096
pnpm start
```

## Переезд с Flowise

1. Остановите Flowise и сделайте копию папки с данными (`~/.flowise`) или базы.
2. Запустите Keelflow на тех же данных:
    - **Docker:** замените образ `flowiseai/flowise` на `ghcr.io/perruer/keelflow`, тома и переменные окружения оставьте. Том, подключённый в `/home/node/.flowise`, подхватится сам.
    - **Из исходников:** Keelflow продолжает использовать `~/.flowise`, пока ни в `~/.keelflow`, ни в папке данных Keelflow нет данных. `DATABASE_*`, `SECRETKEY_PATH`, `FLOWISE_SECRETKEY_OVERWRITE` и прочие переменные `FLOWISE_*` называются так же.
3. Войдите с почтой и паролем владельца из Flowise. Учётные данные расшифруются, если ключ шифрования тот же.

Что не переносится: учётные записи других пользователей (из Flowise Enterprise), SSO, приглашения, роли и переключение между несколькими пространствами. API-ключи продолжают работать с прежними правами. Если в базе от Flowise Enterprise несколько пространств, нужное задаётся через `KEELFLOW_WORKSPACE_ID`.

SDK-пакеты `@flowiseai/agentflow` и `@flowiseai/observe` в Keelflow не входят.

## Настройки

Настройки задаются переменными окружения, см. [packages/server/.env.example](packages/server/.env.example). Новые в Keelflow:

| Переменная | По умолчанию | |
| --- | --- | --- |
| `KEELFLOW_HOME` | папка данных системы | Папка для базы SQLite, ключа шифрования, загрузок и логов. По умолчанию `$XDG_DATA_HOME/keelflow` (`~/.local/share/keelflow`) в Linux, `~/Library/Application Support/keelflow` в macOS, `%LOCALAPPDATA%\keelflow` в Windows; существующие `~/.keelflow` или `~/.flowise` с данными продолжают использоваться |
| `SESSION_EXPIRY_IN_MINUTES` | `10080` (7 дней) | Вход завершается после такого простоя |
| `SESSION_MAX_AGE_IN_MINUTES` | `43200` (30 дней) | Вход завершается через это время в любом случае |
| `TRUST_PROXY` | локальная и частная сеть | `true` — доверять любому прокси, как во Flowise |
| `KEELFLOW_WORKSPACE_ID` | самое старое пространство | Только для баз от Flowise Enterprise |

Забыли пароль владельца? Сбросьте его на сервере, заодно завершатся все активные входы:

```bash
docker exec keelflow node /app/bin/run user owner@example.com 'New-password-1'
```

В копии исходников та же команда: `pnpm user owner@example.com 'New-password-1'`.

## Документация

[Документация Flowise](https://docs.flowiseai.com) описывает узлы, flow, API и виджет и подходит для Keelflow. Вход, пользователи и SSO устроены иначе, как описано выше.

## Безопасность

Об уязвимостях сообщайте приватно через [GitHub Security Advisories](https://github.com/Perruer/keelflow/security/advisories/new). Подробнее — в [SECURITY.md](SECURITY.md).

Пользовательские JavaScript-узлы и инструменты выполняются в vm2. Это не надёжная изоляция: давайте редактировать flow только тем, кому доверяете, или задайте `E2B_APIKEY`, чтобы код выполнялся в песочницах E2B.

## Поддержать проект

Keelflow поддерживается в свободное время. Если он помогает вашим агентам работать, можно поддержать:

- [Boosty](https://boosty.to/mikio_kuroki/donate)
- USDT / TRX (TRC-20): `TXUBW4e88SDTfrnJRKfbhYfFcggufbonc1`
- USDT / USDC / ETH (ERC-20): `0x1378491169064702786b2E5b58c6375776177E8A`
- TON / USDT (TON): `UQAhI7EKzoa-JuKOfv0ULMzA3FrmpxsDkXj8Qevwj2z1cMRN`

## Лицензия

[Apache-2.0](LICENSE.md). Keelflow — форк [Flowise](https://github.com/FlowiseAI/Flowise) от FlowiseAI, Inc., см. [NOTICE](NOTICE). Keelflow не связан с FlowiseAI, Inc. и не одобрен ею.
