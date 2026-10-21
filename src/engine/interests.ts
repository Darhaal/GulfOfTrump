import { ADVISORS, type AdvisorId } from "./advisors";
import { roll } from "./dice";
import type { GameState, Localized, Official, OfficialPost } from "./types";

/**
 * Each minister of the cabinet wants things of their own: two causes of
 * their portfolio, an ambition, and the party they owe their post to. They
 * are dealt by the game's dice when a person takes a post — the same game
 * deals the same — and colour every answer and report: a minister whose
 * causes the government tramples objects, drags their feet or threatens to
 * go. The game master of the turn sees them too, and decides what comes of it.
 */

export interface Agenda {
  /** What the minister pushes for, for the model. */
  en: string;
  label: Localized;
}

export const AGENDAS: Record<AdvisorId, Record<string, Agenda>> = {
  chief: {
    apparatus: { en: "keep the apparatus and the appointments in their own hands", label: { ru: "Аппарат в своих руках", uk: "Апарат у своїх руках", en: "The apparatus in their hands" } },
    ratings: { en: "the leader's ratings and image before everything", label: { ru: "Рейтинг лидера", uk: "Рейтинг лідера", en: "The leader's ratings" } },
    reform: { en: "push the government's reforms through, whoever objects", label: { ru: "Провести реформы", uk: "Провести реформи", en: "Push the reforms through" } },
    loyalists: { en: "fill the posts with people loyal to the leader", label: { ru: "Свои люди на постах", uk: "Свої люди на посадах", en: "Loyal people in posts" } },
    calm: { en: "no risky moves that could cost the leader power", label: { ru: "Без резких движений", uk: "Без різких рухів", en: "No risky moves" } },
  },
  military: {
    budget: { en: "a bigger army budget and more soldiers", label: { ru: "Больше денег армии", uk: "Більше грошей армії", en: "A bigger army budget" } },
    modern: { en: "modern weapons and training over sheer numbers", label: { ru: "Современное оружие", uk: "Сучасна зброя", en: "Modern weapons" } },
    caution: { en: "no reckless offensives and never a war on two fronts", label: { ru: "Никаких авантюр", uk: "Жодних авантюр", en: "No reckless offensives" } },
    offensive: { en: "decisive offensives rather than waiting", label: { ru: "Решительное наступление", uk: "Рішучий наступ", en: "Decisive offensives" } },
    professional: { en: "a professional army rather than a mass of conscripts", label: { ru: "Профессиональная армия", uk: "Професійна армія", en: "A professional army" } },
  },
  finance: {
    balance: { en: "a balanced budget and low debt", label: { ru: "Бездефицитный бюджет", uk: "Бездефіцитний бюджет", en: "A balanced budget" } },
    growth: { en: "spending for growth, even on borrowed money", label: { ru: "Рост любой ценой", uk: "Зростання будь-якою ціною", en: "Growth at any cost" } },
    prices: { en: "stable prices and a strong currency", label: { ru: "Стабильные цены", uk: "Стабільні ціни", en: "Stable prices" } },
    openness: { en: "free trade and foreign investment", label: { ru: "Свободная торговля", uk: "Вільна торгівля", en: "Free trade" } },
    industry: { en: "protecting the country's own industry", label: { ru: "Защита своей промышленности", uk: "Захист власної промисловості", en: "Protect home industry" } },
  },
  foreign: {
    allies: { en: "closer ties with the country's strongest ally", label: { ru: "Ближе к главному союзнику", uk: "Ближче до головного союзника", en: "Closer to the main ally" } },
    neutral: { en: "keeping out of other people's wars", label: { ru: "Не лезть в чужие войны", uk: "Не лізти в чужі війни", en: "Out of others' wars" } },
    prestige: { en: "the country's prestige abroad: summits, treaties, a seat at every table", label: { ru: "Престиж за рубежом", uk: "Престиж за кордоном", en: "Prestige abroad" } },
    trade: { en: "trade deals rather than quarrels", label: { ru: "Сделки вместо ссор", uk: "Угоди замість сварок", en: "Deals, not quarrels" } },
    hardline: { en: "a firm line with rivals, no concessions", label: { ru: "Жёсткий курс с соперниками", uk: "Жорсткий курс із суперниками", en: "A hard line with rivals" } },
  },
  interior: {
    order: { en: "order above all: crack down on the street", label: { ru: "Порядок любой ценой", uk: "Порядок будь-якою ціною", en: "Order above all" } },
    press: { en: "a loyal press and quiet newspapers", label: { ru: "Послушная пресса", uk: "Слухняна преса", en: "A loyal press" } },
    lawful: { en: "staying within the law and avoiding bloodshed", label: { ru: "В рамках закона", uk: "У межах закону", en: "Within the law" } },
    votes: { en: "winning the next election", label: { ru: "Выиграть выборы", uk: "Виграти вибори", en: "Win the election" } },
    police: { en: "more power and money for the police", label: { ru: "Сильная полиция", uk: "Сильна поліція", en: "A strong police" } },
  },
  intelligence: {
    abroad: { en: "more agents and networks abroad", label: { ru: "Агентура за рубежом", uk: "Агентура за кордоном", en: "Networks abroad" } },
    watch: { en: "watching the generals and the elites at home", label: { ru: "Присмотр за элитами", uk: "Нагляд за елітами", en: "Watch the elites" } },
    covert: { en: "covert operations rather than open force", label: { ru: "Тайные операции", uk: "Таємні операції", en: "Covert operations" } },
    caution: { en: "never being exposed: no reckless operations", label: { ru: "Не засветиться", uk: "Не засвітитися", en: "Never be exposed" } },
    influence: { en: "their own influence over the leader", label: { ru: "Влияние на лидера", uk: "Вплив на лідера", en: "Sway over the leader" } },
  },
  science: {
    budget: { en: "more money for science and the laboratories", label: { ru: "Больше денег науке", uk: "Більше грошей науці", en: "More money for science" } },
    weapons: { en: "weapons research before everything else", label: { ru: "Оружие прежде всего", uk: "Зброя понад усе", en: "Weapons first" } },
    pure: { en: "pure science and the universities rather than the army's projects", label: { ru: "Фундаментальная наука", uk: "Фундаментальна наука", en: "Pure science" } },
    prestige: { en: "being first in the world: records, prizes, a famous breakthrough", label: { ru: "Первыми в мире", uk: "Першими у світі", en: "First in the world" } },
    open: { en: "working with foreign scientists rather than in secret", label: { ru: "Открытая наука", uk: "Відкрита наука", en: "Open science" } },
  },
};

/** The cabinet post's ministry, if it is one. */
export const MINISTRY_OF: Partial<Record<OfficialPost, AdvisorId>> = Object.fromEntries(ADVISORS.map((a) => [a, a]));

const game = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;

/** The interests the dice deal a person who takes a cabinet post; none for other posts. */
export function dealInterests(state: Pick<GameState, "seed" | "id" | "politics">, person: Pick<Official, "post" | "name">): Official["interests"] {
  const ministry = MINISTRY_OF[person.post];
  if (!ministry) return undefined;
  const key = `interests:${person.post}:${person.name}`;
  const ids = Object.keys(AGENDAS[ministry]);
  const first = Math.floor(roll(game(state), 0, `${key}:a`) * ids.length);
  const second = (first + 1 + Math.floor(roll(game(state), 0, `${key}:b`) * (ids.length - 1))) % ids.length;
  const ambition = 1 + Math.floor(roll(game(state), 0, `${key}:ambition`) * 5);
  // The party the person owes the post to: the ruling party mostly, a partner in government sometimes.
  const ruling = (state.politics?.parties ?? []).filter((p) => p.status === "ruling");
  const partners = (state.politics?.parties ?? []).filter((p) => p.status === "coalition");
  const pick = roll(game(state), 0, `${key}:party`);
  const party = partners.length && pick < 0.3 ? partners[Math.floor((pick / 0.3) * partners.length)] : ruling[Math.floor(pick * ruling.length)];
  return { agenda: [ids[first], ids[second]], ambition, ...(party ? { party: party.name } : {}) };
}

/** Every cabinet minister without interests gets them; the state is returned as it was when nobody lacks them. */
export function seedInterests<T extends Pick<GameState, "seed" | "id" | "politics" | "officials">>(state: T): T {
  if (!state.officials?.some((o) => MINISTRY_OF[o.post] && !o.interests)) return state;
  return { ...state, officials: state.officials.map((o) => (MINISTRY_OF[o.post] && !o.interests ? withInterests(state, o) : o)) };
}

function withInterests(state: Pick<GameState, "seed" | "id" | "politics">, o: Official): Official {
  const interests = dealInterests(state, o);
  return interests ? { ...o, interests } : o;
}

/** The causes of a minister's agenda that the catalogue knows, in order. */
export function agendaOf(o: Pick<Official, "post" | "interests">): Agenda[] {
  const ministry = MINISTRY_OF[o.post];
  if (!ministry || !o.interests) return [];
  return o.interests.agenda.flatMap((id) => (AGENDAS[ministry][id] ? [AGENDAS[ministry][id]] : []));
}

const AMBITION = ["content with the post", "content with the post", "wants a bigger say", "wants a higher post", "wants the top job one day"];

/** A minister's interests in one English line, for the model: "causes: …; …. ambition 4/5, wants a higher post. owes the post to …". */
export function interestsLine(o: Pick<Official, "post" | "interests">): string {
  const agenda = agendaOf(o);
  if (!agenda.length || !o.interests) return "";
  const ambition = Math.min(5, Math.max(1, Math.round(o.interests.ambition)));
  return `causes: ${agenda.map((a) => a.en).join("; ")}. ambition ${ambition}/5, ${AMBITION[ambition - 1]}${o.interests.party ? `. owes the post to ${o.interests.party}` : ""}`;
}
