import type { ScenarioId } from "../types";

/**
 * Underground movements history broke by a known time, for the historical
 * mode only (engine/partyLife.ts): from a year before `by` the state's hand
 * on a party the game master names this way grows heavier, so it ends about
 * when it did – as long as the state is still strong enough to break it. The
 * free mode never reads a date from here; `match` alone still tells an order
 * against such a party by its other names ("Banderites", "Forest Brothers").
 *
 * Sources: the end of the OUN–UPA underground in Ukraine with Vasyl Kuk's
 * capture (May 1954); the Lithuanian partisans' union (LLKS) broken with
 * Jonas Žemaitis's capture (May 1953); the last Estonian and Latvian forest
 * brothers' groups gone by the 1956 amnesty; Poland's armed underground
 * (WiN, the National Armed Forces) finished by the provocations of 1952.
 */
export interface UndergroundEnd {
  scenario: ScenarioId;
  /** The country whose government broke it. */
  country: string;
  /** The movement's names, as the game master may write any of them. */
  match: RegExp;
  /** The month history broke it by. */
  by: string;
}

export const UNDERGROUND_ENDS: UndergroundEnd[] = [
  { scenario: "1950", country: "ussr", match: /\b(OUN|UPA)\b|ОУН|УПА|bandera|бандер|ukrainian insurgent|украинская повстанческая|українська повстанська|organi[sz]ation of ukrainian nationalists|организация украинских националистов|організація українських націоналістів/i, by: "1954-06-01" },
  { scenario: "1950", country: "ussr", match: /\bLLKS\b|ЛЛКС|lithuanian freedom|lithuanian partisan|литовск\S* партизан|литовськ\S* партизан|союз борьбы за свободу литвы|союз боротьби за свободу литви|miško broli|laisvės kovos/i, by: "1953-12-01" },
  { scenario: "1950", country: "ussr", match: /forest brothers|лесные братья|лісові брати|metsavenn|meža brāļ|estonian partisan|latvian partisan|эстонск\S* партизан|латвийск\S* партизан|естонськ\S* партизан|латвійськ\S* партизан/i, by: "1956-04-01" },
  { scenario: "1950", country: "poland", match: /\bWiN\b|wolność i niezawisłość|свобода и независимость|свобода і незалежність|narodowe siły zbrojne|\bNSZ\b|cursed soldiers|żołnierze wyklęci|проклятые солдаты|прокляті солдати/i, by: "1952-12-01" },
];
