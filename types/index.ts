export * from "./common";
export * from "./schedule";
export * from "./structure";
export * from "./time";
export * from "./reflection";
export * from "./google";

import type { Settings, AvailabilityWindow, PeakWindow, PersonalBlock } from "./schedule";
import type { Area, Season, Goal, SeasonPlan, MajorMove, RecurrenceRule, Action } from "./structure";
import type { Block, FocusSession } from "./time";
import type {
  DailyCheckin,
  WeeklyReview,
  Compass,
  PlanStrengthSnapshot,
  CoachMessage,
} from "./reflection";
import type { GoogleCalendar, ExternalEvent } from "./google";

/** Every table in the local store, keyed by its name. Names match the Stage 3 Postgres tables. */
export interface Tables {
  settings: Settings;
  availability_windows: AvailabilityWindow;
  peak_windows: PeakWindow;
  personal_blocks: PersonalBlock;
  areas: Area;
  seasons: Season;
  goals: Goal;
  season_plans: SeasonPlan;
  major_moves: MajorMove;
  recurrence_rules: RecurrenceRule;
  actions: Action;
  blocks: Block;
  focus_sessions: FocusSession;
  daily_checkins: DailyCheckin;
  weekly_reviews: WeeklyReview;
  compass: Compass;
  plan_strength_snapshots: PlanStrengthSnapshot;
  coach_messages: CoachMessage;
  google_calendars: GoogleCalendar;
  external_events: ExternalEvent;
}

export type TableName = keyof Tables;

/** Tables the server owns (Stage 4). The client pulls them and never writes them through `repo/`. */
export const SERVER_OWNED_TABLES = ["google_calendars", "external_events"] as const satisfies readonly TableName[];
