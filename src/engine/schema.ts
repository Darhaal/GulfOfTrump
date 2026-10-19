import { z } from "zod";
import { ADVISORS } from "./advisors";
import { BLOC_KINDS } from "./foreign";
import { EVENT_KINDS, LOCALES, OFFICIAL_POSTS, PROTEST_STAGES, type GameState } from "./types";

/**
 * Shape check for a state that arrives from outside — a request body or a
 * cloud save. It guards the engine against a malformed object, not against
 * a player editing their own save: that is their game.
 */
const localized = z.object(Object.fromEntries(LOCALES.map((l) => [l, z.string()])) as Record<(typeof LOCALES)[number], z.ZodString>);
const text = z.union([z.string(), localized]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stats = z.object({ stability: z.number(), economy: z.number(), military: z.number() });
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
});
const figures = z.object({ gdp: z.number(), debt: z.number(), reserves: z.number(), troops: z.number(), balance: z.number(), people: z.number().optional() });

export const GameStateSchema = z.object({
  // 1 = one region per country (migrated on load), 2 = provinces.
  schema: z.union([z.literal(1), z.literal(2)]),
  id: z.string().min(1).max(100),
  title: z.string().max(120).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  scenarioId: z.enum(["1914", "1939", "1991", "2014", "2022"]),
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
    }),
  ),
  regions: z.record(z.string(), z.object({ name: text.optional(), owner: z.string(), controller: z.string(), contested: z.string().optional(), held: z.number().optional(), taken: z.array(z.string()).optional(), pop: z.number().optional() })),
  wars: z.array(
    z.object({
      id: z.string(),
      name: text,
      attackers: z.array(z.string()),
      defenders: z.array(z.string()),
      since: z.string(),
      truce: z.object({ until: z.string(), terms: text.optional() }).optional(),
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
      verdicts: z.array(z.object({ n: z.number(), result: z.enum(["success", "partial", "failed"]), note: z.string() })).optional(),
      headline: z.string(),
      narrative: z.string(),
      events: z.array(z.object({ title: z.string(), body: z.string(), kind: z.enum(EVENT_KINDS), countries: z.array(z.string()) })),
      applied: z.array(z.object({ kind: z.string() }).passthrough()),
      economy: z.object({ before: figures, after: figures }).optional(),
      summits: z.array(z.string()).optional(),
      reports: z
        .array(
          z.object({
            ministry: z.enum(ADVISORS),
            text: z.string(),
            directives: z.array(z.object({ id: z.string(), status: z.enum(["progress", "done", "failed"]), note: z.string(), text: z.string().optional() })),
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
          orders: z.array(z.string()).optional(),
          operation: z
            .object({ name: z.string(), target: z.string(), goal: z.string(), means: z.string(), timing: z.string(), secrecy: z.enum(["open", "covert", "deniable"]) })
            .optional(),
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
        }),
      ),
      lastElection: z
        .object({ date: z.string(), results: z.array(z.object({ party: z.string(), share: z.number(), seats: z.number().optional() })), note: z.string().optional() })
        .optional(),
      loyalty: z.object({ army: z.number(), police: z.number(), security: z.number(), elites: z.number() }).optional(),
      loyaltyWas: z.object({ army: z.number(), police: z.number(), security: z.number(), elites: z.number() }).optional(),
      laws: z.object({ conscription: z.string().optional(), martial: z.string().optional(), press: z.string().optional(), assembly: z.string().optional(), elections: z.string().optional(), economy: z.string().optional(), language: z.string().optional(), alignment: z.string().optional(), deathPenalty: z.string().optional(), exit: z.string().optional() }).optional(),
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
      }),
    )
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
  legal: z.array(z.object({ from: z.enum(["player", "advisor"]), text: z.string(), date: z.string(), turn: z.number(), drafts: z.array(z.record(z.string(), z.unknown())).optional() })).optional(),
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
  defeat: z
    .object({
      date: z.string(),
      turn: z.number(),
      how: z.enum(["coup", "revolution", "uprising", "deposed"]),
      by: z.string(),
      note: z.string(),
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
