import type { Locale } from "@/engine/types";

/**
 * The privacy policy, in three languages. Prose like the About page, so it
 * lives apart from messages.ts. The Microsoft Store links to it (policy
 * 10.5.1): what it says must match what the game does — check it whenever
 * sign-in, saves, updates or the AI provider change.
 */
export interface PrivacyContent {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string[] }[];
}

const en: PrivacyContent = {
  title: "Privacy",
  updated: "Last updated 19 October 2026.",
  intro:
    "Gulf of Trump is made by Artem Okhten. The game has no servers of its own that collect data about you: no advertising, no analytics, no tracking. What follows is everything the game sends anywhere, and why.",
  sections: [
    {
      title: "ChatGPT, the game master",
      body: [
        "You sign in with your own ChatGPT account. The sign-in tokens are kept encrypted on your computer and go only to OpenAI; the developer never sees them.",
        "To write each turn, the game sends OpenAI your orders, your messages to other governments and ministers, and the part of the game's state the turn needs. Requests are sent with storage turned off. OpenAI handles them under its own privacy policy: openai.com/policies/privacy-policy.",
      ],
    },
    {
      title: "Saves",
      body: [
        "Your games are saved on your computer. Nobody else can read them.",
        "If you sign in with Google (optional), the game keeps your name, email address, profile picture and saves in a database run for the developer by Supabase, so you can continue on another computer. Signing out stops that; deleting a game deletes its cloud copy. To have your account and all its saves erased, write to the address below.",
      ],
    },
    {
      title: "Updates",
      body: [
        "The Windows app downloaded from GitHub checks the project's GitHub releases for a new version; GitHub sees that request. The Microsoft Store copy is updated by the Store.",
      ],
    },
    {
      title: "The demo website",
      body: [
        "The demo at gulfoftrump.vercel.app runs without an AI and without sign-in. Its host, Vercel, keeps ordinary server logs such as IP addresses.",
      ],
    },
    {
      title: "Reporting the game master's text",
      body: [
        "The game master's text is written by an AI as you play. If it is offensive, harmful or breaks the law, report it from the game (the flag button) or from Settings. Reports are public GitHub issues: copy the offending passage, not your personal details.",
      ],
    },
    {
      title: "Children",
      body: ["The game is not meant for children under 13, and it collects nothing about anyone's age."],
    },
    {
      title: "Contact",
      body: ["Questions, requests to erase data: artem@okhten.com."],
    },
  ],
};

const ru: PrivacyContent = {
  title: "Конфиденциальность",
  updated: "Обновлено 19 октября 2026 года.",
  intro:
    "Gulf of Trump делает Артем Охтень. У игры нет собственных серверов, которые собирают данные о вас: ни рекламы, ни аналитики, ни слежки. Ниже — всё, что игра куда-либо отправляет, и зачем.",
  sections: [
    {
      title: "ChatGPT, ведущий игры",
      body: [
        "Вы входите своим аккаунтом ChatGPT. Ключи входа хранятся зашифрованными на вашем компьютере и уходят только в OpenAI; разработчик их не видит.",
        "Чтобы написать каждый ход, игра отправляет в OpenAI ваши приказы, ваши сообщения правительствам и министрам и ту часть состояния игры, которая нужна для хода. Запросы отправляются с выключенным хранением. OpenAI обрабатывает их по своей политике конфиденциальности: openai.com/policies/privacy-policy.",
      ],
    },
    {
      title: "Сохранения",
      body: [
        "Партии сохраняются на вашем компьютере. Никто другой их не прочитает.",
        "Если вы входите через Google (по желанию), игра хранит ваше имя, адрес почты, аватар и сохранения в базе данных, которую для разработчика ведёт Supabase, — чтобы продолжить на другом компьютере. Выход из аккаунта это прекращает; удаление партии удаляет и её облачную копию. Чтобы стереть аккаунт и все его сохранения, напишите на адрес ниже.",
      ],
    },
    {
      title: "Обновления",
      body: [
        "Приложение для Windows, скачанное с GitHub, проверяет релизы проекта на GitHub; GitHub видит этот запрос. Копию из Microsoft Store обновляет Store.",
      ],
    },
    {
      title: "Демо-сайт",
      body: [
        "Демо на gulfoftrump.vercel.app работает без ИИ и без входа. Его хостинг, Vercel, ведёт обычные журналы сервера, например IP-адреса.",
      ],
    },
    {
      title: "Жалобы на текст ведущего",
      body: [
        "Текст ведущего пишет ИИ прямо во время игры. Если он оскорбительный, вредный или нарушает закон, пожалуйтесь из игры (кнопка с флажком) или из настроек. Жалобы — открытые issues на GitHub: копируйте сам отрывок, а не свои личные данные.",
      ],
    },
    {
      title: "Дети",
      body: ["Игра не предназначена для детей младше 13 лет и ничего не узнаёт о возрасте игроков."],
    },
    {
      title: "Связь",
      body: ["Вопросы и просьбы стереть данные: artem@okhten.com."],
    },
  ],
};

const uk: PrivacyContent = {
  title: "Конфіденційність",
  updated: "Оновлено 19 жовтня 2026 року.",
  intro:
    "Gulf of Trump робить Артем Охтень. Гра не має власних серверів, які збирають дані про вас: ні реклами, ні аналітики, ні стеження. Нижче — усе, що гра кудись надсилає, і навіщо.",
  sections: [
    {
      title: "ChatGPT, ведучий гри",
      body: [
        "Ви входите своїм акаунтом ChatGPT. Ключі входу зберігаються зашифрованими на вашому комп'ютері й надходять лише до OpenAI; розробник їх не бачить.",
        "Щоб написати кожен хід, гра надсилає до OpenAI ваші накази, ваші повідомлення урядам і міністрам і ту частину стану гри, яка потрібна для ходу. Запити надсилаються з вимкненим зберіганням. OpenAI обробляє їх за власною політикою конфіденційності: openai.com/policies/privacy-policy.",
      ],
    },
    {
      title: "Збереження",
      body: [
        "Партії зберігаються на вашому комп'ютері. Ніхто інший їх не прочитає.",
        "Якщо ви входите через Google (за бажанням), гра зберігає ваше ім'я, адресу пошти, аватар і збереження в базі даних, яку для розробника веде Supabase, — щоб продовжити на іншому комп'ютері. Вихід з акаунта це припиняє; видалення партії видаляє і її хмарну копію. Щоб стерти акаунт і всі його збереження, напишіть на адресу нижче.",
      ],
    },
    {
      title: "Оновлення",
      body: [
        "Застосунок для Windows, завантажений з GitHub, перевіряє релізи проєкту на GitHub; GitHub бачить цей запит. Копію з Microsoft Store оновлює Store.",
      ],
    },
    {
      title: "Демосайт",
      body: [
        "Демо на gulfoftrump.vercel.app працює без ШІ та без входу. Його хостинг, Vercel, веде звичайні журнали сервера, наприклад IP-адреси.",
      ],
    },
    {
      title: "Скарги на текст ведучого",
      body: [
        "Текст ведучого пише ШІ просто під час гри. Якщо він образливий, шкідливий або порушує закон, поскаржтеся з гри (кнопка з прапорцем) або з налаштувань. Скарги — відкриті issues на GitHub: копіюйте сам уривок, а не свої особисті дані.",
      ],
    },
    {
      title: "Діти",
      body: ["Гра не призначена для дітей до 13 років і нічого не дізнається про вік гравців."],
    },
    {
      title: "Зв'язок",
      body: ["Питання та прохання стерти дані: artem@okhten.com."],
    },
  ],
};

export const PRIVACY: Record<Locale, PrivacyContent> = { en, ru, uk };
