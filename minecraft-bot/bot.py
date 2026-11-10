"""
Инфо-бот Minecraft-сервера Neptune.
aiogram 3.x

Запуск:  python bot.py
"""

import asyncio
import html
import logging
import os
import re

# ============================================================
#                  НАСТРОЙКИ — МЕНЯТЬ ЗДЕСЬ
# ============================================================
# ID администратора, которому приходят заявки и жалобы.
# Узнать свой ID можно у бота @userinfobot. Это число, без кавычек.
ADMIN_ID = 123456789

# Токен бота от @BotFather. Лучше хранить его в файле .env
# (BOT_TOKEN=...) или переменной окружения, а не в коде.
BOT_TOKEN = os.getenv("BOT_TOKEN", "ВСТАВЬТЕ_СЮДА_ТОКЕН")

# Ссылка на Telegram-канал сервера.
CHANNEL_URL = "https://t.me/your_channel"

# Данные сервера.
SERVER_IP = "play.neptune.my-craft.cc"
SERVER_VERSION = "1.16.5 – 1.21.x"
# ============================================================

try:  # необязательно: подхватываем .env, если установлен python-dotenv
    from dotenv import load_dotenv

    load_dotenv()
    BOT_TOKEN = os.getenv("BOT_TOKEN", BOT_TOKEN)
    ADMIN_ID = int(os.getenv("ADMIN_ID", ADMIN_ID))
except ImportError:
    pass

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
from aiogram.filters import Command, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    ErrorEvent,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("neptune_bot")

router = Router()

# ------------------------------------------------------------
#                         ТЕКСТЫ
# ------------------------------------------------------------
WELCOME_TEXT = (
    "👋 <b>Добро пожаловать на сервер Neptune!</b>\n\n"
    "Я информационный бот сервера. Здесь можно узнать правила, IP-адрес, "
    "подать заявку в состав или отправить жалобу.\n\n"
    "Выберите нужный пункт меню 👇"
)

RULES_TEXT = (
    "📜 <b>Правила сервера</b>\n\n"
    "<b>1. Общение</b>\n"
    "1.1. Запрещены оскорбления, мат в адрес игроков и администрации.\n"
    "1.2. Запрещены флуд, спам и капс в чате.\n"
    "1.3. Запрещена реклама сторонних серверов и ресурсов.\n\n"
    "<b>2. Игровой процесс</b>\n"
    "2.1. Запрещено использование читов, макросов и модификаций, дающих преимущество.\n"
    "2.2. Запрещено использование багов и дюпов. О найденных багах сообщайте администрации.\n"
    "2.3. Запрещено гриферство на чужих приватных территориях.\n\n"
    "<b>3. Аккаунты</b>\n"
    "3.1. Запрещена продажа/передача аккаунтов.\n"
    "3.2. Запрещены оскорбительные ники.\n\n"
    "<b>4. Администрация</b>\n"
    "4.1. Решение администрации является окончательным.\n"
    "4.2. Незнание правил не освобождает от ответственности.\n\n"
    "⚠️ За нарушения — мут, кик, бан или вайп, в зависимости от тяжести."
)

SERVER_INFO_TEXT = (
    "🎮 <b>Информация о сервере</b>\n\n"
    f"🌐 IP: <code>{SERVER_IP}</code>\n"
    f"🧩 Версия: <b>{SERVER_VERSION}</b>\n\n"
    "Нажмите на IP, чтобы скопировать его. Ждём вас в игре! ⛏️"
)

COMPLAINTS_TEXT = (
    "⚠️ <b>Жалобы и обращения</b>\n\n"
    "Выберите тип обращения:"
)

THANKS_TEXT = "✅ <b>Спасибо, ваше обращение принято!</b>\nАдминистрация рассмотрит его в ближайшее время."

# ------------------------------------------------------------
#                       КЛАВИАТУРЫ
# ------------------------------------------------------------
def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📜 Правила", callback_data="rules")],
            [InlineKeyboardButton(text="🛡️ Заявка в состав", callback_data="apply")],
            [InlineKeyboardButton(text="⚠️ Жалобы", callback_data="complaints")],
            [InlineKeyboardButton(text="📢 Наш Telegram-канал", url=CHANNEL_URL)],
            [InlineKeyboardButton(text="🎮 IP и версия сервера", callback_data="server_info")],
        ]
    )


def complaints_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="👤 Жалоба на игрока", callback_data="rep_player")],
            [InlineKeyboardButton(text="🛡️ Жалоба на сотрудника", callback_data="rep_staff")],
            [InlineKeyboardButton(text="🐞 Баг/Ошибка сервера", callback_data="rep_bug")],
            [InlineKeyboardButton(text="⬅️ Назад в меню", callback_data="back_to_main")],
        ]
    )


def back_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад в меню", callback_data="back_to_main")]]
    )


def cancel_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]]
    )


# ------------------------------------------------------------
#                       СОСТОЯНИЯ FSM
# ------------------------------------------------------------
class Application(StatesGroup):
    nickname = State()
    age = State()
    experience = State()
    motivation = State()
    contacts = State()


class PlayerReport(StatesGroup):
    nickname = State()
    reason = State()
    proof = State()


class StaffReport(StatesGroup):
    nickname = State()
    reason = State()
    proof = State()


class BugReport(StatesGroup):
    description = State()
    steps = State()


# ------------------------------------------------------------
#                    ВСПОМОГАТЕЛЬНОЕ
# ------------------------------------------------------------
NICK_RE = re.compile(r"^[A-Za-z0-9_]{3,16}$")
MAX_TEXT_LEN = 1000


async def safe_edit(callback: CallbackQuery, text: str, kb: InlineKeyboardMarkup | None = None) -> None:
    """Редактирует сообщение с меню; если не получается — отправляет новое."""
    try:
        await callback.message.edit_text(text, reply_markup=kb, disable_web_page_preview=True)
    except TelegramBadRequest as e:
        if "message is not modified" in str(e):
            return  # пользователь нажал ту же кнопку повторно — ничего не делаем
        log.warning("edit_text не удался (%s), отправляю новое сообщение", e)
        await callback.message.answer(text, reply_markup=kb, disable_web_page_preview=True)


def user_signature(message: Message) -> str:
    u = message.from_user
    username = f"@{u.username}" if u.username else "нет username"
    return (
        f"👤 От: {html.escape(u.full_name)} ({html.escape(username)})\n"
        f"🆔 ID: <code>{u.id}</code>"
    )


async def get_text(message: Message, max_len: int = MAX_TEXT_LEN) -> str | None:
    """Возвращает экранированный текст сообщения или None (и пишет пользователю ошибку)."""
    if not message.text:
        await message.answer("❗ Пожалуйста, отправьте ответ <b>текстом</b>.", reply_markup=cancel_kb())
        return None
    text = message.text.strip()
    if not text:
        await message.answer("❗ Ответ не может быть пустым. Попробуйте ещё раз.", reply_markup=cancel_kb())
        return None
    if len(text) > max_len:
        await message.answer(
            f"❗ Слишком длинный ответ ({len(text)} симв.). Максимум — {max_len}. Сократите, пожалуйста.",
            reply_markup=cancel_kb(),
        )
        return None
    return html.escape(text)


async def get_nickname(message: Message) -> str | None:
    if not message.text or not NICK_RE.match(message.text.strip()):
        await message.answer(
            "❗ Некорректный ник. Ник Minecraft — от 3 до 16 символов: "
            "латинские буквы, цифры и «_». Попробуйте ещё раз.",
            reply_markup=cancel_kb(),
        )
        return None
    return message.text.strip()


async def send_to_admin(message: Message, text: str, proof_msg_id: int | None = None) -> bool:
    """Отправляет обращение админу. Если есть доказательство-медиа — копирует его следом."""
    try:
        await message.bot.send_message(ADMIN_ID, text, disable_web_page_preview=True)
        if proof_msg_id is not None:
            await message.bot.copy_message(
                chat_id=ADMIN_ID, from_chat_id=message.chat.id, message_id=proof_msg_id
            )
        return True
    except TelegramAPIError as e:
        log.error("Не удалось отправить обращение админу %s: %s", ADMIN_ID, e)
        return False


async def finish(message: Message, state: FSMContext, admin_text: str, proof_msg_id: int | None = None) -> None:
    """Завершение любого сценария: отправка админу, сброс FSM, возврат в меню."""
    await state.clear()
    ok = await send_to_admin(message, admin_text, proof_msg_id)
    if ok:
        await message.answer(THANKS_TEXT)
    else:
        await message.answer(
            "😔 Не удалось доставить обращение администрации. Попробуйте позже "
            "или напишите в наш Telegram-канал."
        )
    await message.answer(WELCOME_TEXT, reply_markup=main_menu_kb())


# ------------------------------------------------------------
#                   КОМАНДЫ И ГЛАВНОЕ МЕНЮ
# ------------------------------------------------------------
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(WELCOME_TEXT, reply_markup=main_menu_kb())


@router.message(Command("cancel"))
async def cmd_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Действие отменено.")
    await message.answer(WELCOME_TEXT, reply_markup=main_menu_kb())


@router.message(Command("myid"))
async def cmd_myid(message: Message) -> None:
    await message.answer(f"Ваш Telegram ID: <code>{message.from_user.id}</code>")


@router.callback_query(F.data == "back_to_main")
async def cb_back(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await safe_edit(callback, WELCOME_TEXT, main_menu_kb())
    await callback.answer()


@router.callback_query(F.data == "cancel")
async def cb_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await safe_edit(callback, WELCOME_TEXT, main_menu_kb())
    await callback.answer("Действие отменено")


@router.callback_query(F.data == "rules")
async def cb_rules(callback: CallbackQuery) -> None:
    await safe_edit(callback, RULES_TEXT, back_kb())
    await callback.answer()


@router.callback_query(F.data == "server_info")
async def cb_server_info(callback: CallbackQuery) -> None:
    await safe_edit(callback, SERVER_INFO_TEXT, back_kb())
    await callback.answer()


@router.callback_query(F.data == "complaints")
async def cb_complaints(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await safe_edit(callback, COMPLAINTS_TEXT, complaints_kb())
    await callback.answer()


# ------------------------------------------------------------
#                   ЗАЯВКА В СОСТАВ (FSM)
# ------------------------------------------------------------
@router.callback_query(F.data == "apply")
async def cb_apply(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(Application.nickname)
    await safe_edit(
        callback,
        "🛡️ <b>Заявка в состав</b> (шаг 1/5)\n\nНапишите ваш <b>ник в игре</b>:",
        cancel_kb(),
    )
    await callback.answer()


@router.message(Application.nickname)
async def app_nickname(message: Message, state: FSMContext) -> None:
    nick = await get_nickname(message)
    if nick is None:
        return
    await state.update_data(nickname=nick)
    await state.set_state(Application.age)
    await message.answer("🛡️ Шаг 2/5\n\nСколько вам <b>лет</b>? (числом)", reply_markup=cancel_kb())


@router.message(Application.age)
async def app_age(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if not text.isdigit() or not 7 <= int(text) <= 99:
        await message.answer("❗ Введите возраст числом от 7 до 99.", reply_markup=cancel_kb())
        return
    await state.update_data(age=int(text))
    await state.set_state(Application.experience)
    await message.answer(
        "🛡️ Шаг 3/5\n\nОпишите ваш <b>опыт администрирования</b> "
        "(на каких серверах, какие должности, сколько времени):",
        reply_markup=cancel_kb(),
    )


@router.message(Application.experience)
async def app_experience(message: Message, state: FSMContext) -> None:
    text = await get_text(message)
    if text is None:
        return
    await state.update_data(experience=text)
    await state.set_state(Application.motivation)
    await message.answer("🛡️ Шаг 4/5\n\n<b>Почему вы хотите в состав</b> нашего сервера?", reply_markup=cancel_kb())


@router.message(Application.motivation)
async def app_motivation(message: Message, state: FSMContext) -> None:
    text = await get_text(message)
    if text is None:
        return
    await state.update_data(motivation=text)
    await state.set_state(Application.contacts)
    await message.answer(
        "🛡️ Шаг 5/5\n\nУкажите ваш <b>юзернейм в Telegram</b> и другие контакты "
        "для связи (Discord / VK):",
        reply_markup=cancel_kb(),
    )


@router.message(Application.contacts)
async def app_contacts(message: Message, state: FSMContext) -> None:
    text = await get_text(message, max_len=300)
    if text is None:
        return
    data = await state.get_data()
    admin_text = (
        "🛡️ <b>НОВАЯ ЗАЯВКА В СОСТАВ</b>\n\n"
        f"🎮 Ник: <code>{data['nickname']}</code>\n"
        f"🎂 Возраст: {data['age']}\n"
        f"📚 Опыт: {data['experience']}\n"
        f"💬 Почему хочет в состав: {data['motivation']}\n"
        f"📞 Контакты: {text}\n\n"
        f"{user_signature(message)}"
    )
    await finish(message, state, admin_text)


# ------------------------------------------------------------
#           ЖАЛОБА НА ИГРОКА / СОТРУДНИКА (FSM)
# ------------------------------------------------------------
REPORT_CONFIG = {
    "rep_player": {
        "group": PlayerReport,
        "title": "👤 Жалоба на игрока",
        "nick_q": "Напишите <b>ник нарушителя</b>:",
        "reason_q": "Опишите <b>суть нарушения</b>:",
        "admin_title": "👤 <b>ЖАЛОБА НА ИГРОКА</b>",
        "nick_label": "Нарушитель",
    },
    "rep_staff": {
        "group": StaffReport,
        "title": "🛡️ Жалоба на сотрудника",
        "nick_q": "Напишите <b>ник сотрудника</b>:",
        "reason_q": "Опишите <b>суть жалобы</b>:",
        "admin_title": "🛡️ <b>ЖАЛОБА НА СОТРУДНИКА</b>",
        "nick_label": "Сотрудник",
    },
}
PROOF_Q = (
    "Шаг 3/3\n\nПришлите <b>доказательства</b>: скриншот, видео, файл "
    "или ссылку (например, на YouTube / Яндекс.Диск)."
)


@router.callback_query(F.data.in_({"rep_player", "rep_staff"}))
async def cb_report_start(callback: CallbackQuery, state: FSMContext) -> None:
    cfg = REPORT_CONFIG[callback.data]
    await state.clear()
    await state.update_data(report_type=callback.data)
    await state.set_state(cfg["group"].nickname)
    await safe_edit(callback, f"{cfg['title']} (шаг 1/3)\n\n{cfg['nick_q']}", cancel_kb())
    await callback.answer()


@router.message(StateFilter(PlayerReport.nickname, StaffReport.nickname))
async def report_nickname(message: Message, state: FSMContext) -> None:
    nick = await get_nickname(message)
    if nick is None:
        return
    cfg = REPORT_CONFIG[(await state.get_data())["report_type"]]
    await state.update_data(nickname=nick)
    await state.set_state(cfg["group"].reason)
    await message.answer(f"Шаг 2/3\n\n{cfg['reason_q']}", reply_markup=cancel_kb())


@router.message(StateFilter(PlayerReport.reason, StaffReport.reason))
async def report_reason(message: Message, state: FSMContext) -> None:
    text = await get_text(message)
    if text is None:
        return
    cfg = REPORT_CONFIG[(await state.get_data())["report_type"]]
    await state.update_data(reason=text)
    await state.set_state(cfg["group"].proof)
    await message.answer(PROOF_Q, reply_markup=cancel_kb())


@router.message(StateFilter(PlayerReport.proof, StaffReport.proof))
async def report_proof(message: Message, state: FSMContext) -> None:
    proof_msg_id = None
    if message.text:
        proof = await get_text(message)
        if proof is None:
            return
    elif message.photo or message.video or message.document or message.animation:
        kind = (
            "фото" if message.photo else
            "видео" if message.video else
            "GIF" if message.animation else
            "файл"
        )
        proof = f"📎 {kind} (прикреплено следующим сообщением)"
        if message.caption:
            proof += f"\nПодпись: {html.escape(message.caption[:MAX_TEXT_LEN])}"
        proof_msg_id = message.message_id
    else:
        await message.answer(
            "❗ Пришлите скриншот, видео, файл или ссылку текстом.", reply_markup=cancel_kb()
        )
        return

    data = await state.get_data()
    cfg = REPORT_CONFIG[data["report_type"]]
    admin_text = (
        f"{cfg['admin_title']}\n\n"
        f"🎮 {cfg['nick_label']}: <code>{data['nickname']}</code>\n"
        f"📝 Суть: {data['reason']}\n"
        f"🔍 Доказательства: {proof}\n\n"
        f"{user_signature(message)}"
    )
    await finish(message, state, admin_text, proof_msg_id)


# ------------------------------------------------------------
#                    БАГ / ОШИБКА (FSM)
# ------------------------------------------------------------
@router.callback_query(F.data == "rep_bug")
async def cb_bug(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(BugReport.description)
    await safe_edit(
        callback,
        "🐞 <b>Баг/Ошибка сервера</b> (шаг 1/2)\n\nОпишите <b>проблему</b>:",
        cancel_kb(),
    )
    await callback.answer()


@router.message(BugReport.description)
async def bug_description(message: Message, state: FSMContext) -> None:
    text = await get_text(message)
    if text is None:
        return
    await state.update_data(description=text)
    await state.set_state(BugReport.steps)
    await message.answer(
        "🐞 Шаг 2/2\n\nОпишите, <b>как воспроизвести</b> ошибку (по шагам):",
        reply_markup=cancel_kb(),
    )


@router.message(BugReport.steps)
async def bug_steps(message: Message, state: FSMContext) -> None:
    text = await get_text(message)
    if text is None:
        return
    data = await state.get_data()
    admin_text = (
        "🐞 <b>БАГ / ОШИБКА СЕРВЕРА</b>\n\n"
        f"📝 Описание: {data['description']}\n"
        f"🔁 Как воспроизвести: {text}\n\n"
        f"{user_signature(message)}"
    )
    await finish(message, state, admin_text)


# ------------------------------------------------------------
#               ПРОЧЕЕ И ОБРАБОТКА ОШИБОК
# ------------------------------------------------------------
@router.message(StateFilter(None))
async def fallback(message: Message) -> None:
    """Любое сообщение вне сценария — показываем меню."""
    await message.answer("Я понимаю только кнопки меню 🙂", reply_markup=main_menu_kb())


@router.callback_query()
async def unknown_callback(callback: CallbackQuery) -> None:
    await callback.answer("Эта кнопка устарела. Нажмите /start", show_alert=True)


@router.errors()
async def on_error(event: ErrorEvent) -> bool:
    """Глобальный перехватчик: логируем ошибку и не даём боту упасть."""
    log.exception("Необработанная ошибка: %s", event.exception, exc_info=event.exception)
    update = event.update
    try:
        if update.message:
            await update.message.answer("⚠️ Произошла ошибка. Попробуйте ещё раз или нажмите /start")
        elif update.callback_query:
            await update.callback_query.answer("⚠️ Произошла ошибка, попробуйте ещё раз", show_alert=True)
    except TelegramAPIError:
        pass
    return True  # ошибка обработана


# ------------------------------------------------------------
#                          ЗАПУСК
# ------------------------------------------------------------
async def main() -> None:
    if not BOT_TOKEN or BOT_TOKEN.startswith("ВСТАВЬТЕ"):
        raise SystemExit("❌ Не задан BOT_TOKEN. Укажите его в файле .env или в начале bot.py")

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    await bot.delete_webhook(drop_pending_updates=True)
    me = await bot.get_me()
    log.info("Бот @%s запущен. Заявки уходят админу %s", me.username, ADMIN_ID)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit) as e:
        if str(e):
            print(e)
        log.info("Бот остановлен")
