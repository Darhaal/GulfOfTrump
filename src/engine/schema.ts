import { z } from "zod";
import { ADVISORS, NEW_MINISTRIES } from "./advisors";
import { CIVIL_CAUSES, CIVIL_ENDS, CIVIL_HOWS, CLASS_WANTS, COLONY_COURSES, COLONY_HOWS, COLONY_STAGES, GOVERNMENT_CHANGES, ROUTINE_HELD, SOCIAL_CLASSES } from "./types";
import { RECORD_MAX } from "./societyRecord";
import { BLOC_KINDS } from "./foreign";
import { AIM_KINDS, ARMS_TYPES, ARMY_ORDER_KINDS, ATOM_STAGES, CABINET_MOVES, CABINET_RESULTS, CASE_ORIGINS, CASE_RESULTS, CASE_TARGETS, COMMAND_SCOPES, CRIME_KINDS, DEATH_CAUSES, DEED_KINDS, DELEGATION_VOTES, DISCONTENTS, ENERGY_SOURCES, ENVOY_STATUSES, EVENT_KINDS, FALL_HOWS, type GameState, GAMES_KINDS, GAME_MODES, HOST_LOSSES, INTRIGUE_EVENTS, INTRIGUE_GOALS, INTRIGUE_PRICES, INTRIGUE_STAGES, LOCALES, MINISTER_STANCES, MOTION_KINDS, MOVEMENT_KINDS, MOVEMENT_STATUSES, OFFICIAL_POSTS, OPINION_CAMPS, ORDER_FATES, PARTY_ENDS, PEACE_TERMS, PLAN_CAUSES, PLAN_ENDS, PLAN_KINDS, PLAN_STAGES, POLICY_KINDS, POSTURES, PROTEST_STAGES, REGIME_KINDS, REPRESSION_MEASURES, RESEARCH_DIRECTIONS, RESOLUTION_KINDS, ROLE_AREAS, ROLE_KINDS, SPACE_MILESTONES, START_VARIANTS, TALK_RESULTS, TREATY_AREAS, UNIT_TASKS, WEAPON_KINDS } from "./types";
import { DEAL_BREACHES, DEAL_CONDITIONS, DEAL_PAYMENTS, DEAL_REASONS } from "./types";
import { JOINT_KINDS, JOINT_REASONS, JOINT_STATUSES, ORDER_PRIORITIES, PROJECT_KINDS } from "./types";
import { MINISTRY_ICON_KEYS } from "./ministries";
import { PARTY_EMBLEM_KEYS, validPartyColour, validPartyImage } from "./partyEmblems";

/**
 * Shape check for a state that arrives from outside — a request body or a
 * cloud save. It guards the engine against a malformed object, not against
 * a player editing their own save: that is their game.
 */
const localized = z.object(Object.fromEntries(LOCALES.map((l) => [l, z.string()])) as Record<(typeof LOCALES)[number], z.ZodString>);
const text = z.union([z.string(), localized]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stats = z.object({ stability: z.number(), economy: z.number(), military: z.number() });
const tradeGood = z.enum(["grain", "oil", "gas", "coal", "metals", "uranium", "arms"]);
/** A trade deal's payment and conditions (engine/negotiation.ts). */
const dealExtras = {
  pay: z.enum(DEAL_PAYMENTS).optional(),
  payGood: tradeGood.optional(),
  conditions: z.array(z.object({ kind: z.enum(DEAL_CONDITIONS), by: z.enum(["player", "partner"]) })).optional(),
};
const dealTerms = z.object({ value: z.number(), premium: z.number(), years: z.number(), ...dealExtras });
/** How the government has courted a minister or deputy (engine/intrigue.ts). */
const courtship = { favour: z.number().optional(), courted: z.number().optional(), raised: z.boolean().optional() };
const economy = z.object({
  gdp: z.number(),
  growth: z.number(),
  inflation: z.number(),
  unemployment: z.number(),
  budget: z.object({ revenue: z.number(), army: z.number(), industry: z.number(), social: z.number(), other: z.number() }),
  debt: z.number(),
  reserves: z.number(),
  troops: z.number(),
  tradeCut: z.number(),
  stocks: z.record(z.string(), z.number()),
  shock: z.number().optional(),
  war: z.number().optional(),
  called: z.number().optional(),
  factories: z.number().optional(),
  extraction: z.number().optional(),
  neglect: z.number().optional(),
  // Light and heavy industry: the split of the industry line and the structure, points from the usual (engine/industry.ts).
  tilt: z.number().optional(),
  lean: z.number().optional(),
  strained: z.number().optional(),
  // Losses of output held as levels, the land its resource appetites go with, a default, money spent off the budget (engine/economy.ts).
  losses: z.object({ power: z.number().optional(), trade: z.number().optional(), war: z.number().optional(), bombing: z.number().optional() }).optional(),
  land: z.number().optional(),
  defaulted: z.string().optional(),
  offBudget: z.number().optional(),
});
const byKind = z.partialRecord(z.enum(WEAPON_KINDS), z.number());
/** A turn of the player's society (engine/societyRecord.ts). */
const societyPoint = z.object({
  d: z.string(),
  p: z.number(),
  b: z.number(),
  m: z.number(),
  e: z.number(),
  lit: z.number(),
  urb: z.number(),
  inc: z.number(),
  gini: z.number(),
  poor: z.number(),
  rich: z.number(),
  job: z.number(),
  pro: z.number(),
  med: z.number(),
  hv: z.number(),
  mood: z.array(z.number()).max(SOCIAL_CLASSES.length).optional(),
  out: z.number().optional(),
  in: z.number().optional(),
  dep: z.number().optional(),
  war: z.number().optional(),
  civ: z.number().optional(),
  crime: z.number().optional(),
});
const arsenal = z.object({
  stock: z.partialRecord(z.enum(WEAPON_KINDS), z.object({ n: z.number(), level: z.number(), types: z.partialRecord(z.enum(ARMS_TYPES), z.number()).optional() })),
  made: byKind.optional(),
  lost: byKind.optional(),
  got: byKind.optional(),
  nuclear: z.boolean().optional(),
  men: z.object({ pro: z.number(), trained: z.number(), recruits: z.number() }).optional(),
  organisation: z
    .object({
      date: z.string(),
      turn: z.number(),
      formations: z.array(
        z.object({
          name: z.string(),
          kind: z.enum(["front", "army", "corps", "fleet", "air", "reserve"]),
          divisions: z.number(),
          commander: z.string().optional(),
          character: z.string().optional(),
          theatre: z.string().optional(),
          provinces: z.array(z.string()),
          note: z.string().optional(),
        }),
      ),
    })
    .optional(),
  orders: z.array(z.object({ type: z.enum([...WEAPON_KINDS, ...ARMS_TYPES]), n: z.number(), built: z.number(), since: z.string() })).optional(),
});
/** A formation the engine fights with (engine/formations.ts), and one turn of its fighting. */
const unitKind = z.enum(["front", "army", "corps"]);
const unit = z.object({
  id: z.string(),
  tag: z.string(),
  n: z.number(),
  name: z.string().optional(),
  kind: unitKind,
  commander: z.object({ name: z.string().optional(), temper: z.number(), skill: z.number() }),
  sector: z.array(z.string()),
  task: z.enum(UNIT_TASKS),
  prep: z.number(),
  ordered: z.boolean().optional(),
  rest: z.number().optional(),
});
const sectorTurn = z.object({
  war: z.string(),
  unit: z.string(),
  n: z.number(),
  name: z.string().optional(),
  kind: unitKind,
  commander: z.string().optional(),
  posture: z.enum(POSTURES),
  at: z.string().optional(),
  lost: z.number(),
  enemyLost: z.number(),
  taken: z.number().optional(),
  km: z.number(),
  men: z.number(),
  supply: z.number(),
  forces: z.object({ tanks: z.number().optional(), artillery: z.number().optional(), aircraft: z.number().optional() }).optional(),
  order: z.object({ kind: z.enum(ARMY_ORDER_KINDS), fate: z.enum(ORDER_FATES) }).optional(),
});
/** How an order is carried out (engine/orderMeta.ts): entrusted, kept from, until a date. */
const orderMetaShape = z.object({
  to: z.enum(ADVISORS).optional(),
  hiddenFrom: z.array(z.enum(ADVISORS)).optional(),
  until: date.optional(),
  span: z.enum(["turn", "week", "month", "quarter", "half", "year", "days", "always"]).optional(),
  days: z.number().int().min(1).max(3650).optional(),
  priority: z.enum(ORDER_PRIORITIES).optional(),
  secret: z.boolean().optional(),
  from: date.optional(),
});
const directiveStatus = z.object({ id: z.string(), status: z.enum(["progress", "done", "failed"]), note: z.string(), text: z.string().optional(), operation: z.boolean().optional() });
/** How a party the engine made came about (engine/partyLife.ts). */
const partyOrigin = z.object({ how: z.enum(["rose", "split"]), date: z.string(), camp: z.enum(OPINION_CAMPS), from: z.string().optional(), why: z.array(z.enum(DISCONTENTS)).optional() });
const figures = z.object({ gdp: z.number(), debt: z.number(), reserves: z.number(), troops: z.number(), balance: z.number(), people: z.number().optional() });
const gender = z.enum(["male", "female"]);
/** Someone the game names as a person (engine/people.ts), with the title they hold if any. */
const personShape = z.object({ id: z.string(), name: z.string(), gender, portrait: z.string().optional(), title: z.string().optional() });
const rulers = z.object({
  line: z.string(),
  people: z.array(z.object({ id: z.string(), name: z.string(), gender, portrait: z.string().optional() })),
  lead: z.number(),
});
const course = z.object({
  hawk: z.number(),
  reach: z.number(),
  aims: z.array(z.object({ kind: z.enum(AIM_KINDS), target: z.string().optional(), weight: z.number(), seeded: z.boolean().optional(), until: date.optional() })),
  ties: z.record(z.string(), z.object({ trust: z.number(), tension: z.number(), threat: z.number(), near: z.number(), trade: z.number().optional(), land: z.boolean().optional(), alarm: z.number().optional() })),
  memory: z.array(z.object({ by: z.string(), what: z.enum(DEED_KINDS), date, weight: z.number() })),
  set: z.object({ date, how: z.enum(["start", ...GOVERNMENT_CHANGES]) }),
});
const plan = z.object({
  id: z.string(),
  kind: z.enum(PLAN_KINDS),
  by: z.string(),
  target: z.string().optional(),
  partners: z.array(z.string()).optional(),
  war: z.string().optional(),
  begins: z.string().optional(),
  bloc: z.string().optional(),
  side: z.enum(["attackers", "defenders"]).optional(),
  blocKind: z.enum(["alliance", "pact"]).optional(),
  policy: z.enum(POLICY_KINDS).optional(),
  lift: z.boolean().optional(),
  origin: z.string().optional(),
  cause: z.enum(PLAN_CAUSES),
  stage: z.enum(PLAN_STAGES),
  since: date,
  moved: date,
  due: date.optional(),
  end: z.object({ date, turn: z.number(), how: z.enum(["done", "failed", "faded"]), why: z.enum(PLAN_ENDS) }).optional(),
});

export const GameStateSchema = z.object({
  // 1 = one region per country (migrated on load), 2 = provinces.
  schema: z.union([z.literal(1), z.literal(2)]),
  migration: z.number().int().min(0).optional(),
  id: z.string().min(1).max(100),
  seed: z.string().min(1).max(100).optional(),
  title: z.string().max(120).optional(),
  mode: z.enum(GAME_MODES).optional(),
  fog: z.boolean().optional(),
  // Who the player is: the leader, the leader of the opposition, a minister or a general (engine/role.ts, engine/figures.ts).
  role: z
    .object({
      kind: z.enum(ROLE_KINDS),
      person: personShape.optional(),
      movement: z
        .object({
          name: z.string().optional(),
          kind: z.enum(MOVEMENT_KINDS),
          host: z.string().optional(),
          status: z.enum(MOVEMENT_STATUSES),
          support: z.number(),
          members: z.number(),
          money: z.number(),
          press: z.number(),
          insiders: z.number(),
          army: z.number(),
          street: z.number(),
          allies: z.array(z.string()).optional(),
          offers: z.array(z.object({ party: z.string(), chance: z.number() })).optional(),
        })
        .optional(),
      about: z.string().optional(),
      post: z.enum(OFFICIAL_POSTS).optional(),
      command: z.object({ scope: z.enum(COMMAND_SCOPES), name: z.string().optional() }).optional(),
      standing: z.object({ influence: z.number(), means: z.number(), loyalty: z.number() }).optional(),
      proposals: z.array(z.object({ id: z.string(), text: z.string(), area: z.enum(ROLE_AREAS), date: z.string() })).optional(),
      resigning: z.boolean().optional(),
      fall: z
        .object({
          how: z.enum(FALL_HOWS),
          from: z.enum(ROLE_KINDS),
          date: z.string(),
          turn: z.number(),
          cause: z.enum(DEATH_CAUSES).optional(),
          successor: z.string().optional(),
        })
        .optional(),
      since: z.string(),
      how: z.enum(["start", "fell", "rose", "succeeded"]).optional(),
    })
    .optional(),
  research: z
    .object({
      // Directions (migration step 16); a save from before them has only projects.
      shares: z.record(z.string(), z.number()).optional(),
      base: z.record(z.string(), z.number()).optional(),
      tech: z.record(z.string(), z.number()).optional(),
      bomb: z.number().optional(),
      active: z.array(z.object({ id: z.string(), progress: z.number(), since: z.string(), on: z.boolean() })).optional(),
      done: z.array(z.object({ id: z.string(), date: z.string() })),
    })
    .optional(),
  // The space race (engine/space.ts, migration step 39).
  space: z
    .object({
      programmes: z.record(
        z.string(),
        z.object({
          level: z.number(),
          share: z.number(),
          focus: z.enum(["balanced", "prestige", "military"]).optional(),
          work: z.record(z.string(), z.number()),
          done: z.array(z.object({ id: z.enum(SPACE_MILESTONES), date: z.string() })),
          failed: z.number().optional(),
        }),
      ),
      firsts: z.record(z.string(), z.object({ by: z.string(), date: z.string() })),
      sites: z.array(z.object({ id: z.string(), name: z.string(), province: z.string(), opens: z.string(), by: z.string() })).optional(),
    })
    .optional(),
  // The Olympic Games and the World Cup (engine/sport.ts, migration step 43).
  sport: z
    .object({
      games: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(GAMES_KINDS),
          year: z.number(),
          opens: z.string(),
          hosts: z.array(z.string()),
          city: localized.optional(),
          awarded: z.string().optional(),
          bids: z.array(z.string()).optional(),
          replaced: z.array(z.object({ hosts: z.array(z.string()), city: localized.optional(), why: z.enum(HOST_LOSSES), date: z.string() })).optional(),
          status: z.enum(["planned", "held", "cancelled"]),
          cancelled: z.enum(["war", "host"]).optional(),
          boycott: z.array(z.string()).optional(),
          banned: z.array(z.string()).optional(),
          medals: z.array(z.object({ tag: z.string(), gold: z.number(), silver: z.number(), bronze: z.number() })).optional(),
          rank: z.number().optional(),
          final: z
            .object({ winner: z.string(), runnerUp: z.string(), score: z.tuple([z.number(), z.number()]), penalties: z.boolean().optional(), semis: z.array(z.string()).optional() })
            .optional(),
          champion: z.string().optional(),
        }),
      ),
      bans: z.array(z.object({ tag: z.string(), since: z.string(), by: z.enum(["history", "aggression", "vote"]), until: z.string().optional() })).optional(),
      bids: z.array(z.string()).optional(),
      boycotts: z.array(z.string()).optional(),
      share: z.number().optional(),
      form: z.number().optional(),
      war: z.string().optional(),
      peace: z.string().optional(),
    })
    .optional(),
  // Power plants and atomic programmes (engine/energy.ts, engine/atom.ts, migration step 47).
  energy: z
    .record(
      z.string(),
      z.object({
        gw: z.partialRecord(z.enum(ENERGY_SOURCES), z.number()),
        demand: z.number(),
        supply: z.number().optional(),
        short: z.number().optional(),
        building: z
          .array(z.object({ source: z.enum(ENERGY_SOURCES), gw: z.number(), cost: z.number(), paid: z.number(), since: z.string(), by: z.enum(["order", "minister", "state"]) }))
          .optional(),
        base: z.number().optional(),
        wrecked: z.number().optional(),
        spent: z.number().optional(),
      }),
    )
    .optional(),
  atom: z
    .object({
      programmes: z.record(
        z.string(),
        z.object({
          done: z.array(z.object({ id: z.enum(ATOM_STAGES), date: z.string() })),
          work: z.partialRecord(z.enum(ATOM_STAGES), z.number()),
          share: z.number(),
          stock: z.number(),
          goal: z.number().optional(),
          ended: z.string().optional(),
          undeclared: z.boolean().optional(),
        }),
      ),
      strikes: z
        .array(z.object({ by: z.string(), against: z.string(), region: z.string(), n: z.number(), date: z.string(), turn: z.number(), deaths: z.number(), answer: z.boolean().optional(), tactical: z.boolean().optional() }))
        .optional(),
      // The escalation ladders of the computer governments' atomic powers at war (engine/nuclear.ts).
      ladder: z.record(z.string(), z.object({ step: z.number(), war: z.string(), against: z.string(), since: z.string(), top: z.number(), strikes: z.number().optional() })).optional(),
    })
    .optional(),
  // The ministers' own work (engine/ministers.ts): who acts only on orders, the networks, the levers as the last turn left them.
  ministers: z
    .object({
      onOrders: z.array(z.enum(ADVISORS)).optional(),
      watch: z.string().optional(),
      left: z
        .object({
          research: z.record(z.string(), z.number()).optional(),
          space: z.object({ share: z.number(), focus: z.enum(["balanced", "prestige", "military"]) }).optional(),
        })
        .optional(),
      set: z
        .object({
          research: z.record(z.string(), z.number()).optional(),
          space: z.object({ share: z.number(), focus: z.enum(["balanced", "prestige", "military"]) }).optional(),
          deficit: z.number().optional(),
          tilt: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  scenarioId: z.enum(["1914", "1933", "1939", "1950", "1957", "1964", "1973", "1979", "1991", "1999", "2014", "2022"]),
  // The start chosen on the date's card (engine/scenarios); the date's own day when missing.
  variant: z.enum(START_VARIANTS).optional(),
  player: z.string().min(1),
  date,
  turn: z.number().int().min(1),
  step: z.enum(["week", "month", "quarter", "half", "year"]),
  countries: z.record(
    z.string(),
    z.object({
      tag: z.string(),
      name: text,
      color: z.string(),
      customColor: z.boolean().optional(),
      leader: z.string().optional(),
      government: text.optional(),
      stats: stats.optional(),
      dormant: z.boolean().optional(),
      economy: economy.optional(),
      exile: z.object({ since: z.string(), host: z.string().optional(), standing: z.number().optional(), offered: z.string().optional() }).optional(),
      client: z
        .object({
          patron: z.string(),
          since: z.string(),
          of: z.string().optional(),
          land: z.array(z.string()),
          accepted: z.number(),
          recognised: z.array(z.string()),
          refused: z.array(z.string()),
          bloc: z.string().optional(),
        })
        .optional(),
      domestic: z
        .object({
          regime: z.enum(REGIME_KINDS),
          support: z.number(),
          stability: z.number(),
          nextElection: date.optional(),
          term: z.number().optional(),
          lastElection: z.object({ date, kept: z.boolean() }).optional(),
          changed: z.object({ date, how: z.enum(GOVERNMENT_CHANGES) }).optional(),
          lastCoup: date.optional(),
          couped: date.optional(),
          deferred: date.optional(),
        })
        .optional(),
      rulers: rulers.optional(),
      course: course.optional(),
      arsenal: arsenal.optional(),
      programmes: z
        .array(
          z.object({
            id: z.string(),
            kind: z.union([z.enum(POLICY_KINDS), z.literal("trade")]),
            since: date,
            until: date,
            with: z.string().optional(),
            gain: z.number().optional(),
            lines: z.object({ army: z.number().optional(), industry: z.number().optional(), social: z.number().optional(), other: z.number().optional() }).optional(),
          }),
        )
        .optional(),
      mobilised: z.number().optional(),
    }),
  ),
  regions: z.record(z.string(), z.object({ name: text.optional(), owner: z.string(), controller: z.string(), contested: z.string().optional(), held: z.number().optional(), taken: z.array(z.string()).optional(), pop: z.number().optional(), behind: z.boolean().optional(), resistance: z.object({ of: z.string(), level: z.number(), peace: z.string().optional() }).optional(), dug: z.number().optional() })),
  wars: z.array(
    z.object({
      id: z.string(),
      name: text,
      attackers: z.array(z.string()),
      defenders: z.array(z.string()),
      since: z.string(),
      truce: z.object({ until: z.string(), terms: text.optional() }).optional(),
      losses: z
        .record(
          z.string(),
          z.object({
            killed: z.number(),
            wounded: z.number(),
            captured: z.number().optional(),
            arms: byKind.optional(),
            last: z.object({ turn: z.number(), killed: z.number(), wounded: z.number(), captured: z.number().optional(), arms: byKind.optional() }).optional(),
          }),
        )
        .optional(),
      offers: z.array(z.object({ by: z.string(), since: z.string(), until: z.string(), terms: z.enum(PEACE_TERMS) })).optional(),
      units: z.array(unit).optional(),
      // What it cost each country's people (engine/civilians.ts).
      civilians: z
        .record(
          z.string(),
          z.object({
            dead: z.number(),
            fled: z.number(),
            by: z.partialRecord(z.enum(CIVIL_CAUSES), z.number()).optional(),
            last: z.object({ turn: z.number(), dead: z.number(), fled: z.number() }).optional(),
          }),
        )
        .optional(),
    }),
  ),
  // Civil wars, live and lately ended (engine/civilWar.ts).
  civilWars: z
    .array(
      z.object({
        war: z.string(),
        of: z.string(),
        rebels: z.string(),
        how: z.enum(CIVIL_HOWS),
        since: z.string(),
        legitimacy: z.object({ government: z.number(), rebels: z.number() }),
        recognised: z.array(z.string()),
        seat: z.boolean().optional(),
        volunteers: z.array(z.object({ from: z.string(), side: z.enum(["government", "rebels"]), men: z.number() })).optional(),
        defected: z.object({ rebels: z.number(), government: z.number(), regions: z.number() }).optional(),
        player: z.enum(["government", "rebels"]).optional(),
        outlawed: z.array(z.object({ id: z.string(), status: z.enum(["ruling", "coalition"]) })).optional(),
        hold: z.number().optional(),
        still: z.string().optional(),
        seeded: z.boolean().optional(),
        floor: z.number().optional(),
        end: z.object({ date: z.string(), turn: z.number(), how: z.enum(CIVIL_ENDS) }).optional(),
      }),
    )
    .optional(),
  alliances: z.array(
    z.object({
      id: z.string(),
      name: text,
      members: z.array(z.string()),
      since: z.string(),
      kind: z.enum(BLOC_KINDS).optional(),
      until: z.string().optional(),
      terms: text.optional(),
      founder: z.string().optional(),
      area: z.enum(TREATY_AREAS).optional(),
      open: z.boolean().optional(),
      binds: z.literal(false).optional(),
      against: z.string().optional(),
    }),
  ),
  chronicle: z.array(
    z.object({
      turn: z.number(),
      from: z.string(),
      to: z.string(),
      orders: z.array(z.string()),
      orderMeta: z.record(z.string(), orderMetaShape).optional(),
      verdicts: z.array(z.object({ n: z.number(), result: z.enum(["success", "partial", "failed"]), note: z.string(), by: z.enum(ADVISORS).optional(), obstructed: z.boolean().optional() })).optional(),
      headline: z.string(),
      narrative: z.string(),
      events: z.array(z.object({ title: z.string(), body: z.string(), kind: z.enum(EVENT_KINDS), countries: z.array(z.string()) })),
      applied: z.array(z.object({ kind: z.string() }).passthrough()),
      economy: z.object({ before: figures, after: figures }).optional(),
      borders: z.record(z.string(), z.object({ owner: z.string(), controller: z.string(), contested: z.string().optional(), held: z.number().optional() })).optional(),
      summits: z.array(z.string()).optional(),
      briefs: z
        .array(z.object({ ministry: z.enum(ADVISORS), matter: z.string(), directives: z.array(directiveStatus), asked: z.boolean().optional() }))
        .optional(),
      reports: z
        .array(
          z.object({
            ministry: z.enum(ADVISORS),
            text: z.string(),
            directives: z.array(directiveStatus),
            stance: z.enum(MINISTER_STANCES).optional(),
          }),
        )
        .optional(),
      routine: z
        .array(
          z.object({
            ministry: z.enum(ADVISORS),
            by: z.string(),
            act: z.string().optional(),
            held: z.enum(ROUTINE_HELD).optional(),
            target: z.string().optional(),
            amount: z.number().optional(),
            bungled: z.boolean().optional(),
            faction: z.string().optional(),
          }),
        )
        .optional(),
      sectors: z.array(sectorTurn).optional(),
    }),
  ),
  diplomacy: z.record(
    z.string(),
    z.array(
      z.object({
        from: z.enum(["player", "them"]),
        text: z.string(),
        date: z.string(),
        turn: z.number(),
        stance: z.enum(["agree", "refuse", "counter", "neutral"]).optional(),
        summary: z.string().optional(),
        as: z.enum(ROLE_KINDS).optional(),
      }),
    ),
  ),
  advice: z
    .record(
      z.string(),
      z.array(
        z.object({
          from: z.enum(["player", "advisor"]),
          text: z.string(),
          date: z.string(),
          turn: z.number(),
          by: z.string().optional(),
          operation: z
            .object({ name: z.string(), target: z.string(), goal: z.string(), means: z.string(), timing: z.string(), secrecy: z.enum(["open", "covert", "deniable"]) })
            .optional(),
          budget: z.object({ revenue: z.number(), army: z.number(), industry: z.number(), social: z.number(), other: z.number(), reason: z.string().optional() }).optional(),
          proposal: z.object({ research: z.record(z.enum(RESEARCH_DIRECTIONS), z.number()).optional() }).optional(),
          applied: z.boolean().optional(),
          orders: z.array(z.string()).optional(),
        }),
      ),
    )
    .optional(),
  draft: z.array(z.string()),
  standing: z.array(z.string()).optional(),
  orderMeta: z.record(z.string(), orderMetaShape).optional(),
  armyOrders: z.array(z.object({ war: z.string(), unit: z.string(), kind: z.enum(ARMY_ORDER_KINDS), temper: z.number().optional(), name: z.string().optional(), text: z.string().max(400).optional() })).optional(),
  directives: z
    .array(
      z.object({
        id: z.string(),
        ministry: z.enum(ADVISORS),
        text: z.string(),
        since: z.string(),
        operation: z
          .object({ name: z.string(), target: z.string(), goal: z.string(), means: z.string(), timing: z.string(), secrecy: z.enum(["open", "covert", "deniable"]) })
          .optional(),
      }),
    )
    .optional(),
  politics: z
    .object({
      regime: z.string(),
      unrest: z.number(),
      nextElection: z.string().optional(),
      parliament: z.object({ name: z.string(), seats: z.number(), threshold: z.number().optional() }).optional(),
      parliamentGone: z.object({ date: z.string(), name: z.string().optional() }).optional(),
      parties: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          leader: z.string().optional(),
          ideology: z.string(),
          support: z.number(),
          status: z.enum(["ruling", "coalition", "opposition", "underground", "banned"]),
          stance: z.object({ economy: z.number(), freedom: z.number(), nation: z.number() }),
          seats: z.number().optional(),
          color: z.string().optional(),
          short: z.string().optional(),
          was: z.object({ economy: z.number(), freedom: z.number(), nation: z.number() }).optional(),
          trend: z.number().optional(),
          strength: z.number().optional(),
          backer: z.string().optional(),
          origin: partyOrigin.optional(),
          unnamed: z.boolean().optional(),
        }),
      ),
      gone: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            short: z.string().optional(),
            color: z.string().optional(),
            status: z.enum(["ruling", "coalition", "opposition", "underground", "banned"]),
            how: z.enum(PARTY_ENDS),
            into: z.string().optional(),
            date: z.string(),
            turn: z.number(),
            unnamed: z.boolean().optional(),
            origin: partyOrigin.optional(),
          }),
        )
        .optional(),
      plots: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          by: z.string(),
          kind: z.enum(["coup", "conspiracy", "protest", "strike", "insurgency", "sabotage"]),
          strength: z.number(),
          known: z.boolean(),
          since: z.string(),
          cabinet: z
            .object({
              faction: z.string(),
              members: z.array(z.string()),
              target: z.union([z.enum(OFFICIAL_POSTS), z.literal("leader")]),
              targetName: z.string(),
              rumour: z.object({ faction: z.string(), turn: z.number() }).optional(),
            })
            .optional(),
        }),
      ),
      lastElection: z
        .object({ date: z.string(), results: z.array(z.object({ party: z.string(), share: z.number(), seats: z.number().optional() })), note: z.string().optional() })
        .optional(),
      loyalty: z.object({ army: z.number(), police: z.number(), security: z.number(), elites: z.number() }).optional(),
      loyaltyWas: z.object({ army: z.number(), police: z.number(), security: z.number(), elites: z.number() }).optional(),
      laws: z.object({ conscription: z.string().optional(), martial: z.string().optional(), press: z.string().optional(), assembly: z.string().optional(), elections: z.string().optional(), economy: z.string().optional(), language: z.string().optional(), alignment: z.string().optional(), deathPenalty: z.string().optional(), exit: z.string().optional() }).optional(),
      sessions: z
        .array(
          z.object({
            id: z.string(),
            motion: z.object({ kind: z.enum(MOTION_KINDS), text: z.string(), law: z.string().optional(), option: z.string().optional(), by: z.literal("opposition").optional(), party: z.string().optional() }),
            transcript: z.array(z.object({ speaker: z.string(), party: z.string().optional(), text: z.string(), player: z.boolean().optional() })),
            sway: z.record(z.string(), z.number()),
            status: z.enum(["open", "passed", "failed"]),
            vote: z
              .object({
                for: z.number(),
                against: z.number(),
                abstain: z.number(),
                need: z.number(),
                parties: z.array(z.object({ party: z.string(), for: z.number(), against: z.number(), abstain: z.number() })),
              })
              .optional(),
            date: z.string(),
            turn: z.number(),
          }),
        )
        .optional(),
      talks: z
        .array(
          z.object({
            id: z.string(),
            with: z.enum(["protest", "plot"]),
            target: z.string(),
            title: z.string(),
            counterpart: z.string(),
            transcript: z.array(z.object({ speaker: z.string(), text: z.string(), player: z.boolean().optional() })),
            status: z.enum(["open", "done"]),
            result: z.enum(TALK_RESULTS).optional(),
            note: z.string().optional(),
            date: z.string(),
            turn: z.number(),
          }),
        )
        .optional(),
      familiesQuiet: z.string().optional(),
    })
    .optional(),
  proposals: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(BLOC_KINDS),
        name: z.string(),
        invited: z.array(z.string()),
        terms: z.string().optional(),
        date: z.string(),
      }),
    )
    .optional(),
  summits: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        place: z.string(),
        date: z.string(),
        participants: z.array(z.string()),
        agenda: z.string().optional(),
        by: z.enum(["player", "world"]),
        status: z.enum(["planned", "held", "missed"]),
        outcome: z.string().optional(),
        transcript: z.array(z.object({ country: z.string(), speaker: z.string(), text: z.string() })).optional(),
        live: z.boolean().optional(),
        agreements: z.array(z.string()).optional(),
        heldTurn: z.number().optional(),
        bloc: z.string().optional(),
      }),
    )
    .optional(),
  envoys: z.record(z.string(), z.object({ status: z.enum(ENVOY_STATUSES), since: z.string(), until: z.string().optional(), by: z.string().optional() })).optional(),
  delegation: z.record(z.string(), z.enum(DELEGATION_VOTES)).optional(),
  delegationInPerson: z.array(z.string()).optional(),
  protests: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        stage: z.enum(PROTEST_STAGES),
        size: z.number(),
        where: z.array(z.string()),
        demands: z.string(),
        by: z.string().optional(),
        since: z.string(),
        country: z.string().optional(),
        support: z.number().optional(),
        organisation: z.number().optional(),
        backer: z.string().optional(),
        killed: z.number().optional(),
        grew: z.number().optional(),
        kind: z.literal("mobilisation").optional(),
      }),
    )
    .optional(),
  officials: z
    .array(
      z.object({
        post: z.enum(OFFICIAL_POSTS),
        title: z.string(),
        name: z.string(),
        traits: z.array(z.string()),
        manner: z.string(),
        competence: z.number(),
        loyalty: z.number(),
        faction: z.string().optional(),
        bio: z.string().optional(),
        since: z.string(),
        interests: z.object({ agenda: z.array(z.string()), ambition: z.number(), party: z.string().optional() }).optional(),
        mood: z.object({ stance: z.enum(MINISTER_STANCES), grievance: z.string().optional(), turn: z.number() }).optional(),
        gender: gender.optional(),
        portrait: z.string().optional(),
        ...courtship,
      }),
    )
    .optional(),
  deputies: z
    .array(
      z.object({
        id: z.string(),
        post: z.enum(OFFICIAL_POSTS),
        deputyOf: z.enum(OFFICIAL_POSTS),
        title: z.string(),
        name: z.string(),
        traits: z.array(z.string()),
        manner: z.string(),
        competence: z.number(),
        loyalty: z.number(),
        chiefLoyalty: z.number(),
        approached: z.number().optional(),
        mood: z.object({ stance: z.enum(MINISTER_STANCES), grievance: z.string().optional(), turn: z.number() }).optional(),
        gender: gender.optional(),
        portrait: z.string().optional(),
        faction: z.string().optional(),
        bio: z.string().optional(),
        since: z.string(),
        interests: z.object({ agenda: z.array(z.string()), ambition: z.number(), party: z.string().optional() }).optional(),
        ...courtship,
      }),
    )
    .optional(),
  deputyAdvice: z
    .record(z.string(), z.array(z.object({ from: z.enum(["player", "advisor"]), text: z.string(), date: z.string(), turn: z.number(), by: z.string().optional() })))
    .optional(),
  bios: z.record(z.string(), z.partialRecord(z.enum(LOCALES), z.string())).optional(),
  speechProfiles: z
    .record(z.string(), z.partialRecord(z.enum(LOCALES), z.object({ register: z.string(), phrases: z.array(z.string()), argues: z.string(), avoids: z.string(), tics: z.string() })))
    .optional(),
  intrigues: z
    .array(
      z.object({
        id: z.string(),
        deputy: z.string(),
        deputyName: z.string(),
        post: z.enum(OFFICIAL_POSTS),
        target: z.string(),
        goal: z.enum(INTRIGUE_GOALS),
        directive: z.string().optional(),
        strength: z.number(),
        risk: z.number(),
        stage: z.enum(INTRIGUE_STAGES),
        price: z.enum(INTRIGUE_PRICES).optional(),
        since: z.string(),
        last: z.object({ turn: z.number(), event: z.enum(INTRIGUE_EVENTS) }),
      }),
    )
    .optional(),
  cabinet: z
    .object({
      moves: z.array(
        z.object({
          kind: z.enum(CABINET_MOVES),
          who: z.string(),
          with: z.string().optional(),
          result: z.enum(CABINET_RESULTS),
          names: z.array(z.string()).optional(),
          removed: z.array(z.object({ post: z.enum(OFFICIAL_POSTS), title: z.string(), name: z.string() })).optional(),
          noticed: z.boolean().optional(),
          turn: z.number(),
        }),
      ),
    })
    .optional(),
  partyEmblems: z.record(z.string(), z.enum(PARTY_EMBLEM_KEYS)).optional(),
  partyImages: z.record(z.string(), z.string().refine(validPartyImage)).optional().catch(undefined),
  partyColours: z.record(z.string(), z.string().refine(validPartyColour)).optional().catch(undefined),
  portraitImages: z.record(z.string(), z.string().refine(validPartyImage)).optional().catch(undefined),
  cabinetShape: z
    .object({
      closed: z.array(z.object({ id: z.enum(ADVISORS), since: z.string() })).optional(),
      created: z.array(z.object({ id: z.enum(NEW_MINISTRIES), name: z.string(), names: z.object({ ru: z.string(), uk: z.string(), en: z.string() }).optional(), portfolio: z.string(), tasks: z.array(z.string()).optional(), since: z.string() })).optional(),
      renamed: z.partialRecord(z.enum(ADVISORS), z.object({ ru: z.string(), uk: z.string(), en: z.string() })).optional(),
      icons: z.partialRecord(z.enum(ADVISORS), z.enum(MINISTRY_ICON_KEYS)).optional(),
      colours: z.partialRecord(z.enum(ADVISORS), z.string().regex(/^#[0-9a-f]{6}$/i)).optional().catch(undefined),
      changes: z
        .array(
          z.object({
            kind: z.enum(["closed", "reopened", "created"]),
            id: z.enum(ADVISORS),
            name: z.string().optional(),
            date: z.string(),
            minister: z.object({ post: z.enum(OFFICIAL_POSTS), title: z.string(), name: z.string() }).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  personnel: z
    .array(z.object({ date: z.string(), post: z.enum(OFFICIAL_POSTS), title: z.string(), from: z.string().optional(), to: z.string(), note: z.string().optional(), renamed: z.string().optional() }))
    .optional(),
  sanctions: z.array(z.object({ by: z.string(), against: z.string(), scope: z.enum(["partial", "full"]), since: z.string(), joint: z.string().optional() })).optional(),
  // Joint actions with allies, proposed, under way and lately ended (engine/joint.ts, migration step 52).
  joint: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(JOINT_KINDS),
        by: z.string(),
        members: z.array(z.string()),
        declined: z.array(z.string()).optional(),
        target: z.string().optional(),
        war: z.string().optional(),
        at: z.string().optional(),
        direction: z.enum(RESEARCH_DIRECTIONS).optional(),
        project: z.enum(PROJECT_KINDS).optional(),
        scope: z.enum(["partial", "full"]).optional(),
        vote: z.enum(DELEGATION_VOTES).optional(),
        share: z.enum(["equal", "lead"]).optional(),
        name: localized.optional(),
        status: z.enum(JOINT_STATUSES),
        since: date,
        from: date.optional(),
        until: date.optional(),
        turn: z.number(),
        progress: z.number().optional(),
        cost: z.number().optional(),
        paid: z.number().optional(),
        reason: z.enum(JOINT_REASONS).optional(),
        ended: date.optional(),
        result: z.object({ km: z.number().optional(), yielded: z.boolean().optional(), gdp: z.number().optional() }).optional(),
        history: z.string().optional(),
      }),
    )
    .optional(),
  proclamation: z.object({ name: z.object({ ru: z.string(), uk: z.string(), en: z.string() }).optional(), color: z.string().optional(), places: z.record(z.string(), z.object({ ru: z.string(), uk: z.string(), en: z.string() })).optional(), reactions: z.record(z.string(), z.object({ unrest: z.number(), note: z.string() })).optional() }).optional(),
  bills: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        text: z.string(),
        laws: z.record(z.string(), z.string()).optional(),
        vote: z.enum(["majority", "twothirds", "decree"]),
        status: z.enum(["proposed", "passed", "failed"]),
        turn: z.number(),
        date: z.string(),
        decided: z.string().optional(),
        reaction: z.object({ unrest: z.number(), note: z.string() }).optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  placeNames: z.record(z.string(), z.object({ ru: z.string(), uk: z.string(), en: z.string() })).optional(),
  deals: z
    .array(
      z.object({
        id: z.string(),
        partner: z.string(),
        good: z.enum(["grain", "oil", "gas", "coal", "metals", "uranium", "arms"]),
        side: z.enum(["sell", "buy"]),
        value: z.number(),
        premium: z.number(),
        years: z.number(),
        since: z.string(),
        until: z.string(),
        status: z.enum(["active", "proposed", "declined", "ended", "broken"]),
        origin: z.enum(["offer", "player"]),
        turn: z.number(),
        note: z.string().optional(),
        // The terms beyond goods and price, the talks and the deal's life (engine/negotiation.ts); none in saves from before them.
        ...dealExtras,
        rounds: z.array(z.object({ by: z.enum(["player", "partner"]), terms: dealTerms, answer: z.enum(["accepted", "countered", "refused"]).optional(), reason: z.enum(DEAL_REASONS).optional(), turn: z.number() })).optional(),
        talking: z.boolean().optional(),
        strain: z.object({ cause: z.enum(DEAL_BREACHES), by: z.enum(["player", "partner"]), share: z.number(), turns: z.number() }).optional(),
        owed: z.number().optional(),
        alliance: z.string().optional(),
      }),
    )
    .optional(),
  budgetSet: z.object({ date: z.string(), before: z.object({ revenue: z.number(), army: z.number(), industry: z.number(), social: z.number(), other: z.number() }), after: z.object({ revenue: z.number(), army: z.number(), industry: z.number(), social: z.number(), other: z.number() }) }).optional(),
  plans: z.array(plan).optional(),
  // The colonies on their way to independence and those already free (engine/colonies.ts).
  colonies: z
    .array(
      z.object({
        id: z.string(),
        tag: z.string(),
        of: z.string(),
        adm0: z.array(z.string()),
        plus: z.array(z.string()).optional(),
        minus: z.array(z.string()).optional(),
        seed: z.string().optional(),
        stage: z.enum(COLONY_STAGES),
        since: date,
        pressure: z.number(),
        due: date.optional(),
        course: z.enum(COLONY_COURSES).optional(),
        answered: z.enum(COLONY_COURSES).optional(),
        war: z.string().optional(),
        movement: z.string().optional(),
        fought: z.boolean().optional(),
        won: z.boolean().optional(),
        end: z.object({ date, turn: z.number(), how: z.enum([...COLONY_HOWS, "gone"]) }).optional(),
      }),
    )
    .optional(),
  // Acts of aggression and the world's answer to each (engine/aggression.ts).
  aggressions: z
    .array(
      z.object({
        id: z.string(),
        war: z.string(),
        by: z.string(),
        against: z.string(),
        date,
        weight: z.number(),
        repeat: z.number(),
        condemned: z.array(z.string()),
        aid: z.array(z.string()).optional(),
        pledges: z.array(z.object({ by: z.string(), to: z.string() })).optional(),
        body: z.string().optional(),
        resolutions: z
          .array(
            z.object({
              kind: z.enum(RESOLUTION_KINDS),
              forum: z.enum(["council", "assembly"]),
              date,
              yes: z.number(),
              no: z.number(),
              abstain: z.number(),
              passed: z.boolean(),
              veto: z.array(z.string()).optional(),
            }),
          )
          .optional(),
        blocked: z.enum(RESOLUTION_KINDS).optional(),
        closed: date.optional(),
      }),
    )
    .optional(),
  // What the turns did to each country's people (engine/society.ts).
  society: z
    .record(
      z.string(),
      z.object({
        start: z.object({ poor: z.number(), rich: z.number(), urban: z.number(), literate: z.number(), farm: z.number(), industry: z.number(), young: z.number(), men: z.number() }).optional(),
        anchor: z.number().optional(),
        shift: z.object({ farm: z.number().optional(), industry: z.number().optional(), urban: z.number().optional(), literate: z.number().optional() }).optional(),
        gap: z.object({ m: z.array(z.number()).max(17), f: z.array(z.number()).max(17), aged: z.number().optional() }).optional(),
        ages: z.object({ m: z.array(z.number()).length(17), f: z.array(z.number()).length(17), born: z.tuple([z.number(), z.number()]), aged: z.number() }).optional(),
        vital: z.object({ fert: z.number(), life: z.number(), men: z.number(), ni0: z.number(), dev: z.number() }).optional(),
        drift: z.number().optional(),
        // The society tab's record, the pyramid it opened with and the classes (engine/societyRecord.ts, engine/classes.ts).
        record: z.array(societyPoint).max(RECORD_MAX * 4).optional(),
        first: z.object({ m: z.array(z.number()).length(17), f: z.array(z.number()).length(17) }).optional(),
        classes: z.partialRecord(z.enum(SOCIAL_CLASSES), z.object({ share: z.number(), mood: z.number(), want: z.enum(CLASS_WANTS).catch("stability") })).optional(),
      }),
    )
    .optional(),
  // Repressions and mass crimes the engine carried out, the leader's orders to the player, history's course (engine/repressions.ts).
  repressions: z
    .object({
      cases: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            target: z.enum(CASE_TARGETS),
            title: z.string().optional(),
            measure: z.enum(REPRESSION_MEASURES),
            by: z.enum(CASE_ORIGINS),
            result: z.enum(CASE_RESULTS),
            executor: z.string().optional(),
            player: z.boolean().optional(),
            martyr: z.boolean().optional(),
            leader: z.string().optional(),
            date,
            turn: z.number(),
            rehabilitated: date.optional(),
          }),
        )
        .optional(),
      crimes: z
        .array(
          z.object({
            id: z.string(),
            kind: z.enum(CRIME_KINDS),
            by: z.string(),
            who: text,
            toll: z.number(),
            moved: z.number().optional(),
            held: z.number().optional(),
            origin: z.enum(CASE_ORIGINS),
            status: z.enum(["done", "ongoing", "refused", "stopped"]),
            harsher: z.boolean().optional(),
            executor: z.string().optional(),
            player: z.boolean().optional(),
            since: date,
            turn: z.number(),
            tried: date.optional(),
            condemned: date.optional(),
          }),
        )
        .optional(),
      demands: z
        .array(
          z.object({
            id: z.string(),
            by: z.string(),
            name: z.string(),
            target: z.enum(CASE_TARGETS).optional(),
            title: z.string().optional(),
            measure: z.enum([...REPRESSION_MEASURES, ...CRIME_KINDS]),
            history: z.string().optional(),
            since: date,
            turn: z.number(),
          }),
        )
        .optional(),
      history: z.record(z.string(), z.enum(["stopped", "harsher", "done", "moot"])).optional(),
      power: z.number().optional(),
      complicity: z.number().optional(),
    })
    .optional(),
  defeat: z
    .object({
      date: z.string(),
      turn: z.number(),
      how: z.enum(["coup", "revolution", "uprising", "deposed", "election", "resigned", "died"]),
      by: z.string(),
      note: z.string(),
      fallen: personShape.optional(),
      party: z.string().optional(),
      regime: z.string().optional(),
      continued: z.boolean().optional(),
    })
    .optional(),
});

export function parseGameState(value: unknown): GameState | null {
  const result = GameStateSchema.safeParse(value);
  if (!result.success) return null;
  // A version-1 state passes here and is migrated by the caller, which has the map.
  const state = result.data as unknown as GameState;
  if (!state.countries[state.player]) return null;
  return state;
}
