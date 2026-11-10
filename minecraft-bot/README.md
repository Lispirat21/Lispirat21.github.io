# Neptune — инфо-бот Minecraft-сервера (aiogram 3)

## 1. Создать бота в @BotFather
1. Откройте в Telegram **@BotFather** → `/newbot`.
2. Введите имя (например, `Neptune Info`) и username, оканчивающийся на `bot` (например, `neptune_info_bot`).
3. BotFather пришлёт **токен** вида `1234567890:AAH...` — это пароль от бота, никому его не показывайте.
4. (Необязательно) `/setdescription`, `/setuserpic`, `/setcommands` → `start - Главное меню` и `cancel - Отменить заполнение`.

## 2. Узнать свой ADMIN_ID
Напишите **@userinfobot** — он ответит числом `Id`. Это и есть `ADMIN_ID`.
**Важно:** сам админ должен хотя бы раз нажать `/start` в вашем боте, иначе Telegram не даст боту написать ему первым.

## 3. Установка и запуск (Windows / Linux / macOS)
Нужен Python 3.10+.

```bash
cd minecraft-bot
python -m venv .venv
# Windows:      .venv\Scripts\activate
# Linux/macOS:  source .venv/bin/activate
pip install -r requirements.txt
```

Скопируйте `.env.example` в `.env` и впишите свои данные:
```
BOT_TOKEN=1234567890:AAH...
ADMIN_ID=123456789
```
(или впишите `ADMIN_ID`, `BOT_TOKEN`, `CHANNEL_URL` прямо в начало `bot.py`).

Запуск:
```bash
python bot.py
```
В консоли появится `Бот @ваш_бот запущен`. Откройте бота в Telegram по ссылке `t.me/ваш_бот` и нажмите **Start**.

## 4. Что поменять под себя (начало `bot.py`)
- `ADMIN_ID` — кому приходят заявки и жалобы;
- `CHANNEL_URL` — ссылка на ваш канал;
- `SERVER_VERSION` — версия сервера;
- `RULES_TEXT` — текст правил.

## 5. Чтобы бот работал 24/7
Пока скрипт запущен на вашем ПК — бот отвечает; закрыли консоль — бот замолчал.
Для постоянной работы запустите его на VPS/хостинге (например, через `systemd` или `screen`/`tmux`)
или на бесплатных/дешёвых сервисах для Python-ботов.

> ⚠️ Никогда не публикуйте файл `.env` и токен в GitHub. Если токен утёк — `/revoke` в @BotFather.
