import type { Locale } from "@/engine/types";

/**
 * The privacy policy, in three languages. Prose like the About page, so it
 * lives apart from messages.ts. The Microsoft Store links to it (policy
 * 10.5.1): what it says must match what the game does – check it whenever
 * sign-in, saves, updates, the AI provider or the anonymous statistics
 * (src/lib/telemetry, docs/telemetry.md) change.
 */
export interface PrivacyContent {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string[] }[];
}

const en: PrivacyContent = {
  title: "Privacy",
  updated: "Last updated 23 October 2026.",
  intro:
    "Gulf of Trump is made by Artem Okhten. The game has no advertising and does not track you. Its only statistics are anonymous and off unless you agree to them. What follows is everything the game sends anywhere, and why.",
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
      title: "Anonymous statistics, only if you agree",
      body: [
        "On its first start the game asks whether you want to help with anonymous statistics. They stay off until you say yes, and you can turn them on or off at any time in Settings → Anonymous statistics. A copy of the game built without the developer's database never asks and never sends.",
        "If you agree, the game sends these events to the same Supabase database that keeps cloud saves: the game started; a game begun or opened, with its date, start, country, mode and role; a turn played, with its number and length, how long it took, how many tokens it used, which model wrote it, and whether it succeeded or the code of its error; an error shown to you, by its code alone; which of the game's main panels and actions you used. Each event also carries the game's version, where it runs (the Windows app, the Microsoft Store copy, the demo website or a browser), the interface language and a random id of this copy of the game. A game is named by an anonymous key that cannot be matched to its save.",
        "Never sent: your orders, letters and speeches, the game master's text, names you type, your email, your Google or ChatGPT account, any tokens, your saves. The random id is made on your computer, is linked to no account, and is replaced by a new one when you turn statistics off and on again. The database has no place for IP addresses; like any server, Supabase sees the address a request comes from and may keep it briefly in its own request logs.",
        "Events are deleted automatically after 12 months. Turning statistics off stops all sending at once and forgets the random id. To have the events of your copy erased sooner, write to the address below with the id that Settings shows while statistics are on.",
      ],
    },
    {
      title: "Updates",
      body: [
        "The Windows app downloaded from GitHub checks the project's GitHub releases for a new version; GitHub sees that request. The Microsoft Store copy is updated by the Store.",
      ],
    },
    {
      title: "Voice",
      body: [
        "Reading aloud uses the voices of your system or browser. The voices that come with Windows work on your computer; the online voices of Microsoft Edge and Google Chrome send the text being read to Microsoft or Google.",
        "Voice input in the Windows app works on your computer: the speech model (Whisper, about 100 MB) is downloaded once, when you agree, from jsDelivr and Hugging Face, and after that your voice never leaves the computer. In a browser that recognises speech itself (Chrome, Edge, Safari) the recording goes to the browser maker's service – Google, Microsoft or Apple – under its own policy. The microphone is on only while its button is lit.",
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
  updated: "Обновлено 23 октября 2026 года.",
  intro:
    "Gulf of Trump делает Артем Охтень. В игре нет рекламы, и она за вами не следит. Единственная статистика – анонимная и выключена, пока вы на неё не согласитесь. Ниже – всё, что игра куда-либо отправляет, и зачем.",
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
        "Если вы входите через Google (по желанию), игра хранит ваше имя, адрес почты, аватар и сохранения в базе данных, которую для разработчика ведёт Supabase, – чтобы продолжить на другом компьютере. Выход из аккаунта это прекращает; удаление партии удаляет и её облачную копию. Чтобы стереть аккаунт и все его сохранения, напишите на адрес ниже.",
      ],
    },
    {
      title: "Анонимная статистика, только с вашего согласия",
      body: [
        "При первом запуске игра спрашивает, хотите ли вы помочь анонимной статистикой. Она выключена, пока вы не ответите «да», и её можно включить или выключить в любой момент: Настройки → Анонимная статистика. Копия игры, собранная без базы данных разработчика, не спрашивает и ничего не отправляет.",
        "Если вы согласны, игра отправляет такие события в ту же базу Supabase, где хранятся облачные сохранения: игра запущена; партия начата или открыта – с её датой, стартом, страной, режимом и ролью; ход сыгран – с его номером и длиной, сколько он длился, сколько токенов потратил, какая модель его написала и удался ли он или каков код ошибки; ошибка, которую вы увидели, – только её код; какими главными панелями и действиями игры вы пользовались. Каждое событие несёт ещё версию игры, где она работает (приложение для Windows, копия из Microsoft Store, демо-сайт или браузер), язык интерфейса и случайный номер этой копии игры. Партия обозначена анонимным ключом, который нельзя сопоставить с её сохранением.",
        "Никогда не отправляются: ваши приказы, письма и речи, текст ведущего, имена, которые вы вводите, ваша почта, аккаунты Google и ChatGPT, какие-либо ключи, ваши сохранения. Случайный номер создаётся на вашем компьютере, ни с каким аккаунтом не связан и меняется на новый, если выключить статистику и включить снова. В базе нет места для IP-адресов; как любой сервер, Supabase видит адрес, с которого пришёл запрос, и может недолго хранить его в собственных журналах запросов.",
        "События удаляются автоматически через 12 месяцев. Выключение статистики сразу прекращает всякую отправку и забывает случайный номер. Чтобы стереть события вашей копии раньше, напишите на адрес ниже и приложите номер, который показывают настройки, пока статистика включена.",
      ],
    },
    {
      title: "Обновления",
      body: [
        "Приложение для Windows, скачанное с GitHub, проверяет релизы проекта на GitHub; GitHub видит этот запрос. Копию из Microsoft Store обновляет Store.",
      ],
    },
    {
      title: "Голос",
      body: [
        "Чтение вслух использует голоса вашей системы или браузера. Голоса, встроенные в Windows, работают на вашем компьютере; онлайн-голоса Microsoft Edge и Google Chrome отправляют читаемый текст в Microsoft или Google.",
        "Голосовой ввод в приложении для Windows работает на вашем компьютере: модель распознавания (Whisper, около 100 МБ) скачивается один раз, с вашего согласия, с jsDelivr и Hugging Face, и после этого ваш голос не покидает компьютер. В браузере, который сам распознаёт речь (Chrome, Edge, Safari), запись уходит в сервис его производителя – Google, Microsoft или Apple – по его собственным правилам. Микрофон включён, только пока горит его кнопка.",
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
        "Текст ведущего пишет ИИ прямо во время игры. Если он оскорбительный, вредный или нарушает закон, пожалуйтесь из игры (кнопка с флажком) или из настроек. Жалобы – открытые issues на GitHub: копируйте сам отрывок, а не свои личные данные.",
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
  updated: "Оновлено 23 жовтня 2026 року.",
  intro:
    "Gulf of Trump робить Артем Охтень. У грі немає реклами, і вона за вами не стежить. Єдина статистика – анонімна й вимкнена, поки ви на неї не погодитеся. Нижче – усе, що гра кудись надсилає, і навіщо.",
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
        "Якщо ви входите через Google (за бажанням), гра зберігає ваше ім'я, адресу пошти, аватар і збереження в базі даних, яку для розробника веде Supabase, – щоб продовжити на іншому комп'ютері. Вихід з акаунта це припиняє; видалення партії видаляє і її хмарну копію. Щоб стерти акаунт і всі його збереження, напишіть на адресу нижче.",
      ],
    },
    {
      title: "Анонімна статистика, лише з вашої згоди",
      body: [
        "Під час першого запуску гра питає, чи хочете ви допомогти анонімною статистикою. Вона вимкнена, поки ви не відповісте «так», і її можна ввімкнути або вимкнути будь-коли: Налаштування → Анонімна статистика. Копія гри, зібрана без бази даних розробника, не питає й нічого не надсилає.",
        "Якщо ви згодні, гра надсилає такі події до тієї самої бази Supabase, де зберігаються хмарні збереження: гру запущено; партію почато або відкрито – з її датою, стартом, країною, режимом і роллю; хід зіграно – з його номером і довжиною, скільки він тривав, скільки токенів витратив, яка модель його написала і чи вдався він або який код помилки; помилка, яку ви побачили, – лише її код; якими головними панелями й діями гри ви користувалися. Кожна подія несе ще версію гри, де вона працює (застосунок для Windows, копія з Microsoft Store, демосайт або браузер), мову інтерфейсу й випадковий номер цієї копії гри. Партію позначено анонімним ключем, який не можна зіставити з її збереженням.",
        "Ніколи не надсилаються: ваші накази, листи й промови, текст ведучого, імена, які ви вводите, ваша пошта, акаунти Google і ChatGPT, будь-які ключі, ваші збереження. Випадковий номер створюється на вашому комп'ютері, не пов'язаний з жодним акаунтом і змінюється на новий, якщо вимкнути статистику й увімкнути знову. У базі немає місця для IP-адрес; як будь-який сервер, Supabase бачить адресу, з якої надійшов запит, і може недовго зберігати її у власних журналах запитів.",
        "Події видаляються автоматично через 12 місяців. Вимкнення статистики одразу припиняє будь-яке надсилання й забуває випадковий номер. Щоб стерти події вашої копії раніше, напишіть на адресу нижче й додайте номер, який показують налаштування, поки статистика ввімкнена.",
      ],
    },
    {
      title: "Оновлення",
      body: [
        "Застосунок для Windows, завантажений з GitHub, перевіряє релізи проєкту на GitHub; GitHub бачить цей запит. Копію з Microsoft Store оновлює Store.",
      ],
    },
    {
      title: "Голос",
      body: [
        "Читання вголос використовує голоси вашої системи або браузера. Голоси, вбудовані у Windows, працюють на вашому комп'ютері; онлайн-голоси Microsoft Edge і Google Chrome надсилають текст, що читається, до Microsoft або Google.",
        "Голосове введення в застосунку для Windows працює на вашому комп'ютері: модель розпізнавання (Whisper, близько 100 МБ) завантажується один раз, з вашої згоди, з jsDelivr і Hugging Face, і після цього ваш голос не залишає комп'ютер. У браузері, який сам розпізнає мову (Chrome, Edge, Safari), запис іде до сервісу його виробника – Google, Microsoft або Apple – за його власними правилами. Мікрофон увімкнено, лише поки світиться його кнопка.",
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
        "Текст ведучого пише ШІ просто під час гри. Якщо він образливий, шкідливий або порушує закон, поскаржтеся з гри (кнопка з прапорцем) або з налаштувань. Скарги – відкриті issues на GitHub: копіюйте сам уривок, а не свої особисті дані.",
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
