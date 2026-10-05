export {
  useRow,
  useRows,
  useSettings,
  useNow,
  useToday,
  useWeekStart,
  useAreas,
  useSeasons,
  useGoalsInSeason,
  usePlansForGoal,
  useMajorMoves,
  useActionsForGoal,
  useActionsForArea,
  useCompletedByAction,
  useOpenCountsByArea,
  useActiveGoals,
  useMovesForGoal,
  useBlocksForActions,
  useDaySchedule,
  usePersonalBlocks,
  useBlocksForDays,
  useWeekList,
  useWindows,
} from "./hooks";
export { useDbReady, type DbState } from "./ready";
export { getActivePlanSpans, getPlacementContext, type GoalWithPlan, type TitledBlock } from "./queries";
export { setSetupProgress, useSetupProgress } from "./goal-setup";
