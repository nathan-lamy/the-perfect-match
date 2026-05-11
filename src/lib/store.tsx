import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AssignmentPass,
  ComputeResult,
  Group,
  historicalCounts,
  Restriction,
  Slot,
  SlotRule,
  Student,
  // SubjectQuota,
} from "./types";
import { DEFAULT_WEIGHTS } from "./types";

export type Stage =
  | "connect"
  | "students"
  | "restrictions"
  | "groups"
  | "slots"
  | "rules"
  | "passes"
  | "quotas"
  | "compute"
  | "publish";

export interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface PersistState {
  credentials: { username: string; password: string } | null;
  session?: string;
  isConnected: boolean;
  sessionExpiresAt?: number;

  students: Student[];
  historicalCounts: historicalCounts[];

  restrictions: Restriction[];
  groups: Group[];
  fetchedSlots: Slot[];
  selectedSlotIds: string[];
  globalRules: SlotRule[];
  passes: AssignmentPass[];
  // quotas: SubjectQuota[];
  iterations: number;
  dateRange: { start: string; end: string };
}

export const SESSION_EXPIRY = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = "theperfectmatch_v1";

const today = new Date();
const in14 = new Date(today.getTime() + 7 * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const initial: PersistState = {
  credentials: null,
  isConnected: false,
  sessionExpiresAt: undefined,

  students: [],
  historicalCounts: [],
  restrictions: [],
  groups: [],
  fetchedSlots: [],
  selectedSlotIds: [],

  globalRules: [
    {
      id: "rule_moulin",
      name: "M. MOULIN — capacité 1",
      match_teacher: "M. MOULIN",
      action: { type: "SetCapacity", value: 1 },
    },
  ],

  passes: [
    {
      id: "p_math",
      name: "Mathématiques",
      priority: 1,
      slot_subject_filter: "Mathématiques",
      student_group_id: null,
      weights: null,
      slot_rules: [],
      ignored_slot_ids: [],
      ignored_students: [],
    },
    {
      id: "p_phy",
      name: "Physique-Chimie",
      priority: 2,
      slot_subject_filter: "Physique",
      student_group_id: null,
      weights: null,
      slot_rules: [],
      ignored_slot_ids: [],
      ignored_students: [],
    },
  ],

  // quotas: [
  //   {
  //     id: "q_math",
  //     name: "Max 6 Maths",
  //     subject_filter: "Mathématiques",
  //     max_colles: 6,
  //     group_id: null,
  //   },
  // ],
  iterations: 100,
  dateRange: { start: iso(today), end: iso(in14) },
};

interface StoreContextValue {
  hydrated: boolean;
  state: PersistState;
  setState: (patch: Partial<PersistState> | ((s: PersistState) => Partial<PersistState>)) => void;
  reset: () => void;
  globalWeights: typeof DEFAULT_WEIGHTS;
  setGlobalWeights: (w: typeof DEFAULT_WEIGHTS) => void;

  stage: Stage;
  setStage: (s: Stage) => void;

  logs: LogEntry[];
  log: (level: LogEntry["level"], message: string) => void;

  result: ComputeResult | null;
  setResult: (r: ComputeResult | null) => void;

  publishProgress: { total: number; done: string[]; current: string | null; running: boolean };
  setPublishProgress: (p: StoreContextValue["publishProgress"]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadPersist(): PersistState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
  } catch {
    return initial;
  }
}

function loadWeights() {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY + "_weights");
    return raw ? { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) } : DEFAULT_WEIGHTS;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<PersistState>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [globalWeights, setGlobalWeightsRaw] = useState(DEFAULT_WEIGHTS);
  const [stage, setStage] = useState<Stage>("connect");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [publishProgress, setPublishProgress] = useState({ total: 0, done: [] as string[], current: null as string | null, running: false });
  // const firstRender = useRef(true);

  useEffect(() => {
    setStateRaw(loadPersist());
    setGlobalWeightsRaw(loadWeights());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY + "_weights", JSON.stringify(globalWeights));
  }, [globalWeights, hydrated]);

  // // Auto-advance stage on first hydration
  // useEffect(() => {
  //   if (!hydrated || !firstRender.current) return;
  //   firstRender.current = false;
  //   if (state.isConnected && state.students.length > 0) setStage("slots");
  //   else if (state.isConnected) setStage("students");
  // }, [hydrated, state.isConnected, state.students.length]);

  const setState = (patch: Partial<PersistState> | ((s: PersistState) => Partial<PersistState>)) => {
    setStateRaw((prev) => {
      const p = typeof patch === "function" ? patch(prev) : patch;
      return { ...prev, ...p };
    });
  };

  const log = (level: LogEntry["level"], message: string) => {
    setLogs((l) => [...l, { ts: Date.now(), level, message }].slice(-200));
    // eslint-disable-next-line no-console
    console.log(`[${level}]`, message);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + "_weights");
    setStateRaw(initial);
    setGlobalWeightsRaw(DEFAULT_WEIGHTS);
    setResult(null);
    setLogs([]);
    setStage("connect");
  };

  const value = useMemo<StoreContextValue>(
    () => ({
      hydrated,
      state, setState, reset,
      globalWeights, setGlobalWeights: setGlobalWeightsRaw,
      stage, setStage, logs, log,
      result, setResult,
      publishProgress, setPublishProgress,
    }),
    [state, hydrated, globalWeights, stage, logs, result, publishProgress],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}

export const STORAGE_KEY_EXPORT = STORAGE_KEY;
