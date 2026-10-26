import { z } from "zod";
import { ADVISORS } from "./advisors";
import { BLOC_KINDS } from "./foreign";
import { AIM_KINDS, CABINET_MOVES, CABINET_RESULTS, COMMAND_SCOPES, DEATH_CAUSES, DEED_KINDS, EVENT_KINDS, FALL_HOWS, GAME_MODES, INTRIGUE_EVENTS, INTRIGUE_GOALS, INTRIGUE_PRICES, INTRIGUE_STAGES, LOCALES, MINISTER_STANCES, MOTION_KINDS, MOVEMENT_KINDS, MOVEMENT_STATUSES, OFFICIAL_POSTS, PLAN_CAUSES, PLAN_ENDS, PLAN_KINDS, PLAN_STAGES, POLICY_KINDS, PROTEST_STAGES, REGIME_KINDS, RESEARCH_DIRECTIONS, ROLE_KINDS, START_VARIANTS, TALK_RESULTS, WEAPON_KINDS, type GameState } from "./types";

/**
 * Shape check for a state that arrives from outside — a request body or a
 * cloud save. It guards the engine against a malformed object, not against
 * a player editing their own save: that is their game.
 */
const localized = z.object(Object.fromEntries(LOCALES.map((l) => [l, z.string()])) as Record<(typeof LOCALES)[number], z.ZodString>);
const text = z.union([z.string(), localized]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stats = z.object({ stability: z.number(), economy: z.number(), military: z.number() });
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
  factories: z.number().optional(),
  extraction: z.number().optional(),
});
const byKind = z.partialRecord(z.enum(WEAPON_KINDS), z.number());
const arsenal = z.object({
  stock: z.partialRecord(z.enum(WEAPON_KINDS), z.object({ n: z.number(), level: z.number() })),
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
          theatre: z.string().optional(),
          provinces: z.array(z.string()),
          note: z.string().optional(),
        }),
      ),
    })
    .optional(),
});
const directiveStatus = z.object({ id: z.string(), status: z.enum(["progress", "done", "failed"]), note: z.string(), text: z.string().optional(), operation: z.boolean().optional() });
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
  aims: z.array(z.object({ kind: z.enum(AIM_KINDS), target: z.string().optional(), weight: z.number(), seeded: z.boolean().optional() })),
  ties: z.record(z.string(), z.object({ trust: z.number(), tension: z.number(), threat: z.number(), near: z.number(), trade: z.number().optional(), land: z.boolean().optional() })),
  memory: z.array(z.object({ by: z.string(), what: z.enum(DEED_KINDS), date, weight: z.number() })),
  set: z.object({ date, how: z.enum(["start", "election", "coup", "leader"]) }),
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
        })
        .optional(),
      about: z.string().optional(),
      post: z.enum(OFFICIAL_POSTS).optional(),
      command: z.object({ scope: z.enum(COMMAND_SCOPES), name: z.string().optional() }).optional(),
      standing: z.object({ influence: z.number(), means: z.number(), loyalty: z.number() }).optional(),
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
  createdAt: z.string(),
  updatedAt: z.string(),
  scenarioId: z.enum(["1914", "1939", "1950", "1964", "1991", "1999", "2014", "2022"]),
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
      exile: z.object({ since: z.string(), host: z.string().optional() }).optional(),
      domestic: z
        .object({
          regime: z.enum(REGIME_KINDS),
          support: z.number(),
          stability: z.number(),
          nextElection: date.optional(),
          term: z.number().optional(),
          lastElection: z.object({ date, kept: z.boolean() }).optional(),
          changed: z.object({ date, how: z.enum(["election", "coup", "leader"]) }).optional(),
          lastCoup: date.optional(),
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
    }),
  ),
  regions: z.record(z.string(), z.object({ name: text.optional(), owner: z.string(), controller: z.string(), contested: z.string().optional(), held: z.number().optional(), taken: z.array(z.string()).optional(), pop: z.number().optional(), behind: z.boolean().optional(), resistance: z.object({ of: z.string(), level: z.number(), peace: z.string().optional() }).optional() })),
  wars: z.array(
    z.object({
      id: z.string(),
      name: text,
      attackers: z.array(z.string()),
      defenders: z.array(z.string()),
      since: z.string(),
      truce: z.object({ until: z.string(), terms: text.optional() }).optional(),
      losses: z.record(z.string(), z.object({ killed: z.number(), wounded: z.number(), captured: z.number().optional(), arms: byKind.optional() })).optional(),
    }),
  ),
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
    }),
  ),
  chronicle: z.array(
    z.object({
      turn: z.number(),
      from: z.string(),
      to: z.string(),
      orders: z.array(z.string()),
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
        }),
      ),
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
            motion: z.object({ kind: z.enum(MOTION_KINDS), text: z.string(), law: z.string().optional(), option: z.string().optional() }),
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
    .record(z.string(), z.array(z.object({ from: z.enum(["player", "advisor"]), text: z.string(), date: z.string(), turn: z.number() })))
    .optional(),
  bios: z.record(z.string(), z.partialRecord(z.enum(LOCALES), z.string())).optional(),
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
  personnel: z
    .array(z.object({ date: z.string(), post: z.enum(OFFICIAL_POSTS), title: z.string(), from: z.string().optional(), to: z.string(), note: z.string().optional() }))
    .optional(),
  sanctions: z.array(z.object({ by: z.string(), against: z.string(), scope: z.enum(["partial", "full"]), since: z.string() })).optional(),
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
      }),
    )
    .optional(),
  budgetSet: z.object({ date: z.string(), before: z.object({ revenue: z.number(), army: z.number(), industry: z.number(), social: z.number(), other: z.number() }), after: z.object({ revenue: z.number(), army: z.number(), industry: z.number(), social: z.number(), other: z.number() }) }).optional(),
  plans: z.array(plan).optional(),
  // What the turns did to each country's people (engine/society.ts).
  society: z
    .record(
      z.string(),
      z.object({
        start: z.object({ poor: z.number(), rich: z.number(), urban: z.number(), literate: z.number(), farm: z.number(), industry: z.number(), young: z.number(), men: z.number() }).optional(),
        anchor: z.number().optional(),
        shift: z.object({ farm: z.number().optional(), industry: z.number().optional(), urban: z.number().optional(), literate: z.number().optional() }).optional(),
        gap: z.object({ m: z.array(z.number()).max(17), f: z.array(z.number()).max(17), aged: z.number().optional() }).optional(),
      }),
    )
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
