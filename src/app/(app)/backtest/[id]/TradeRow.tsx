"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, TrendingDown, Trash2, Star, Pencil, X, Check,
  Loader2, HelpCircle, ChevronDown,
} from "lucide-react";
import type { Direction, TradeOutcome } from "@/generated/prisma/enums";
import { deleteBacktestTrade, updateBacktestTrade } from "../actions";
import { Combobox } from "@/components/ui/Combobox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { CheckToggle } from "@/components/ui/CheckToggle";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface TradeMedia {
  id: string;
  url: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface Trade {
  id: string;
  tradeNumber: number;
  direction: Direction;
  outcome: TradeOutcome | null;
  entryDate: Date;
  exitDate: Date | null;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  rMultiple: number | null;
  pnlDollars: number | null;
  pnlPoints: number | null;
  quantity: number;
  grade: number | null;
  notes: string | null;
  tags: string[];
  screenshotUrl: string | null;
  media?: TradeMedia[];
  // Context
  marketSession: string | null;
  timeframeEntry: string | null;
  timeframeTrend: string | null;
  ictModel: string | null;
  poi: string | null;
  biasHTF: string | null;
  biasMTF: string | null;
  marketStructure: string | null;
  liquiditySwept: string | null;
  // Psychology
  isFomo: boolean;
  isRevenge: boolean;
  isImpulsive: boolean;
  followedRules: boolean | null;
  // Scénarios alternatifs
  outcome1R:    TradeOutcome | null;
  rMultiple1R:  number | null;
  outcome15R:   TradeOutcome | null;
  rMultiple15R: number | null;
}

/* ─── Shared styles ─────────────────────────────────────────────────────── */
const iStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  outline: "none",
};
const iCls = "block w-full px-2.5 py-1.5 text-sm transition-all focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:opacity-30";
const lCls = "mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest";
const lStyle: React.CSSProperties = { color: "var(--text-muted)" };

/* ─── Option maps ───────────────────────────────────────────────────────── */
const SESSIONS = [
  { value: "", label: "— Select —" },
  { value: "ASIA",             label: "Asia" },
  { value: "LONDON",           label: "London" },
  { value: "LONDON_CLOSE",     label: "London Close" },
  { value: "NEW_YORK_AM",      label: "New York AM" },
  { value: "NEW_YORK_PM",      label: "New York PM" },
  { value: "SILVER_BULLET_AM", label: "Silver Bullet AM (10-11)" },
  { value: "SILVER_BULLET_PM", label: "Silver Bullet PM (2-3)" },
  { value: "OVERLAP",          label: "London/NY Overlap" },
  { value: "OFF_HOURS",        label: "Off Hours" },
];

const ICT_MODELS = [
  { value: "", label: "— Select —" },
  { value: "SILVER_BULLET",     label: "Silver Bullet" },
  { value: "OTE",               label: "OTE (Optimal Trade Entry)" },
  { value: "FVG_FILL",          label: "FVG Fill" },
  { value: "POWER_OF_3",        label: "Power of 3 (AMD)" },
  { value: "JUDAS_SWING",       label: "Judas Swing" },
  { value: "LONDON_OPEN_RECAP", label: "London Open Recap" },
  { value: "BREAKER_BLOCK",     label: "Breaker Block" },
  { value: "MITIGATION_BLOCK",  label: "Mitigation Block" },
  { value: "PROPULSION_BLOCK",  label: "Propulsion Block" },
  { value: "TURTLE_SOUP",       label: "Turtle Soup" },
  { value: "ICT_2022",          label: "ICT 2022 Model" },
  { value: "SCALP",             label: "Scalp" },
  { value: "OTHER",             label: "Other" },
];

const POI_TYPES = [
  { value: "", label: "— Select —" },
  { value: "ORDER_BLOCK_BULL",      label: "Order Block (Bull)" },
  { value: "ORDER_BLOCK_BEAR",      label: "Order Block (Bear)" },
  { value: "BREAKER_BLOCK_BULL",    label: "Breaker Block (Bull)" },
  { value: "BREAKER_BLOCK_BEAR",    label: "Breaker Block (Bear)" },
  { value: "FVG_BULL",              label: "FVG (Bull)" },
  { value: "FVG_BEAR",              label: "FVG (Bear)" },
  { value: "IFVG_BULL",             label: "Inversion FVG (Bull)" },
  { value: "IFVG_BEAR",             label: "Inversion FVG (Bear)" },
  { value: "MITIGATION_BLOCK_BULL", label: "Mitigation Block (Bull)" },
  { value: "MITIGATION_BLOCK_BEAR", label: "Mitigation Block (Bear)" },
  { value: "LIQUIDITY_VOID",        label: "Liquidity Void" },
  { value: "PREMIUM_ARRAY",         label: "Premium Array" },
  { value: "DISCOUNT_ARRAY",        label: "Discount Array" },
  { value: "EQUILIBRIUM",           label: "Equilibrium (50%)" },
  { value: "WEEKLY_OPEN",           label: "Weekly Open" },
  { value: "DAILY_OPEN",            label: "Daily Open" },
  { value: "MIDNIGHT_OPEN",         label: "Midnight Open" },
  { value: "LONDON_OPEN",           label: "London Open" },
  { value: "ASIA_HIGH",             label: "Asia High" },
  { value: "ASIA_LOW",              label: "Asia Low" },
  { value: "PREV_DAY_HIGH",         label: "Previous Day High" },
  { value: "PREV_DAY_LOW",          label: "Previous Day Low" },
  { value: "PREV_WEEK_HIGH",        label: "Previous Week High" },
  { value: "PREV_WEEK_LOW",         label: "Previous Week Low" },
];

const BIASES = [
  { value: "", label: "— Select —" },
  { value: "BULLISH", label: "Bullish" },
  { value: "BEARISH", label: "Bearish" },
  { value: "NEUTRAL", label: "Neutral" },
];

const STRUCTURES = [
  { value: "", label: "— Select —" },
  { value: "HH_HL",     label: "HH/HL (Uptrend)" },
  { value: "LH_LL",     label: "LH/LL (Downtrend)" },
  { value: "RANGE",     label: "Range" },
  { value: "BOS_UP",    label: "BOS Up (Break of Structure)" },
  { value: "BOS_DOWN",  label: "BOS Down" },
  { value: "CHOCH_UP",  label: "CHoCH Up (Change of Character)" },
  { value: "CHOCH_DOWN","label": "CHoCH Down" },
];

const LIQUIDITIES = [
  { value: "", label: "— Select —" },
  { value: "BSL",  label: "BSL (Buy Side)" },
  { value: "SSL",  label: "SSL (Sell Side)" },
  { value: "BOTH", label: "Both" },
  { value: "NONE", label: "None" },
];

const TIMEFRAMES = [
  { value: "", label: "— Select —" },
  { value: "M1",  label: "1m" },
  { value: "M5",  label: "5m" },
  { value: "M15", label: "15m" },
  { value: "M30", label: "30m" },
  { value: "H1",  label: "1H" },
  { value: "H4",  label: "4H" },
  { value: "D1",  label: "Daily" },
  { value: "W1",  label: "Weekly" },
];

const OUTCOMES: { value: TradeOutcome; label: string; color: string }[] = [
  { value: "WIN",       label: "Win",  color: "var(--accent-tertiary-light)" },
  { value: "LOSS",      label: "Loss", color: "#f87171" },
  { value: "BREAKEVEN", label: "B/E",  color: "var(--text-muted)" },
];

/* ─── Tooltips ──────────────────────────────────────────────────────────── */
const TIPS: Record<string, string> = {
  direction:       "LONG si tu achètes en espérant une hausse. SHORT si tu vends en espérant une baisse.",
  entryDate:       "Date et heure exactes où tu as ouvert ta position.",
  exitDate:        "Date et heure de clôture. Laisse vide si encore ouvert.",
  entryPrice:      "Prix d'exécution à l'entrée.",
  exitPrice:       "Prix de sortie. Laisse vide si encore ouvert.",
  stopLoss:        "Niveau de coupe-perte. Nécessaire pour le calcul auto du R.",
  takeProfit:      "Niveau cible de prise de gains.",
  rMultiple:       "Ratio risque/récompense réalisé. +2R = gagné 2× ton risque. Calculé auto si Entry, Exit et SL renseignés.",
  pnlDollars:      "Gain ou perte en dollars sur ce trade.",
  pnlPoints:       "Gain ou perte en points ou pips. Utile sur NQ/ES (1pt = $20 sur NQ mini).",
  quantity:        "Nombre de contrats/lots tradés. Défaut : 1.",
  marketSession:   "Session de marché au moment de l'entrée.",
  timeframeEntry:  "Timeframe sur lequel tu as exécuté l'entrée (ex: M5 pour le trigger).",
  timeframeTrend:  "Timeframe de la tendance ou du biais (ex: H1 pour la direction).",
  ictModel:        "Modèle ICT utilisé pour ce trade : Silver Bullet, OTE, FVG Fill, Power of 3…",
  poi:             "Point d'intérêt où tu es entré : Order Block, FVG, Breaker Block, niveau clé…",
  biasHTF:         "Biais directionnel sur le higher timeframe (D1/W1). Bullish = on cherche des longs.",
  biasMTF:         "Biais sur le mid timeframe (H1/H4). Doit idéalement être aligné avec le HTF.",
  marketStructure: "Structure de marché au moment de l'entrée. BOS = confirmation du biais. CHoCH = retournement.",
  liquiditySwept:  "Liquidité balayée avant l'entrée. BSL = buy stops (hauts précédents). SSL = sell stops (bas précédents).",
  outcome:         "Résultat du trade : Win, Loss ou Breakeven.",
  grade:           "Note d'exécution 1-5. Indépendant du résultat : note le respect de ton processus.",
  notes:           "Contexte, raison de l'entrée, ce que tu ferais différemment.",
  screenshotUrl:   "Lien TradingView ou image du chart au moment du trade.",
  tags:            "Mots-clés séparés par virgule. Ex: fomo, early_exit, clean_entry, missed_tp",
  isFomo:          "Trade pris par peur de rater le mouvement (FOMO).",
  isRevenge:       "Trade pris pour 'récupérer' après une perte.",
  isImpulsive:     "Entrée sans attendre la confirmation ou le setup complet.",
  followedRules:   "As-tu respecté toutes les règles de ton playbook pour ce trade ?",
  outcome1R:       "Résultat réel si tu avais sorti à 1R. Peut être WIN, LOSS ou B/E selon où était le prix au niveau 1R.",
  rMultiple1R:     "R effectivement réalisé dans le scénario sortie à 1R. Ex: +1.0 si TP touché, -0.8 si SL touché avant.",
  outcome15R:      "Résultat réel si tu avais sorti à 1.5R.",
  rMultiple15R:    "R effectivement réalisé dans le scénario sortie à 1.5R.",
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function toDatetimeLocal(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ─── Tooltip component ─────────────────────────────────────────────────── */
function Tip({ field }: { field: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tip = TIPS[field];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!tip) return null;

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: Math.min(rect.left, window.innerWidth - 224 - 8),
      });
    }
    setOpen((v) => !v);
  }

  const tooltipEl = open && coords
    ? createPortal(
        <span
          className="w-56 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed shadow-xl"
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            transform: "translateY(calc(-100% - 6px))",
            zIndex: 9999,
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            whiteSpace: "normal",
          }}
        >
          <span className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
              {field.replace(/([A-Z])/g, " $1").trim().toUpperCase()}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="ml-2 rounded p-0.5 hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
              <X size={9} />
            </button>
          </span>
          {tip}
          <span
            className="absolute -bottom-1.5 left-3 h-3 w-3 rotate-45"
            style={{ backgroundColor: "var(--bg-sidebar)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
          />
        </span>,
        document.body
      )
    : null;

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center rounded-full transition-opacity hover:opacity-80"
        style={{ color: open ? "var(--accent-primary)" : "var(--text-muted)" }}
      >
        <HelpCircle size={10} />
      </button>
      {tooltipEl}
    </span>
  );
}

/* ─── Label helpers ─────────────────────────────────────────────────────── */
function L({ htmlFor, field, children }: { htmlFor?: string; field: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={lCls} style={lStyle}>
      {children}<Tip field={field} />
    </label>
  );
}
function GL({ field, children }: { field: string; children: React.ReactNode }) {
  return <p className={lCls} style={lStyle}>{children}<Tip field={field} /></p>;
}

/* ─── Section wrapper ───────────────────────────────────────────────────── */
function Section({ title, children, collapsible = false, defaultOpen = true }: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between px-3 py-2 text-left ${collapsible ? "cursor-pointer hover:bg-white/[0.02]" : "cursor-default"}`}
        style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
          {title}
        </span>
        {collapsible && (
          <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
        )}
      </button>
      {open && <div className="space-y-3 p-3">{children}</div>}
    </div>
  );
}

/* ─── Checkbox field ────────────────────────────────────────────────────── */
function CheckField({ name, label, field, defaultChecked }: {
  name: string; label: string; field: string; defaultChecked?: boolean;
}) {
  return (
    <CheckToggle name={name} label={label} defaultChecked={defaultChecked}>
      <Tip field={field} />
    </CheckToggle>
  );
}

/* ─── Display sub-components ────────────────────────────────────────────── */
function OutcomeBadge({ outcome }: { outcome: TradeOutcome | null }) {
  if (!outcome) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const map: Record<TradeOutcome, { color: string; bg: string }> = {
    WIN:       { color: "var(--accent-tertiary-light)", bg: "rgba(0,200,150,0.12)" },
    LOSS:      { color: "#f87171",                     bg: "rgba(239,68,68,0.12)" },
    BREAKEVEN: { color: "var(--text-muted)",            bg: "rgba(255,255,255,0.05)" },
  };
  const s = map[outcome];
  return (
    <span className="rounded-md px-1.5 py-0.5 text-sm font-bold uppercase" style={{ backgroundColor: s.bg, color: s.color }}>
      {outcome === "BREAKEVEN" ? "B/E" : outcome}
    </span>
  );
}

function GradeStars({ grade }: { grade: number | null }) {
  if (!grade) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={10}
          style={{ color: i < grade ? "var(--accent-primary)" : "var(--border)" }}
          fill={i < grade ? "var(--accent-primary)" : "none"}
        />
      ))}
    </span>
  );
}

/* ─── Alternative scenarios section (shared by Add + Edit forms) ────────── */
function AlternativeScenariosSection({
  outcome1R,
  setOutcome1R,
  outcome15R,
  setOutcome15R,
}: {
  outcome1R: string;
  setOutcome1R: (v: string) => void;
  outcome15R: string;
  setOutcome15R: (v: string) => void;
}) {
  return (
    <Section title="Sorties alternatives (simulation)" collapsible defaultOpen={false}>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Renseigne le résultat <em>réel</em> si tu avais pris tes profits plus tôt. Le R est calculé automatiquement.
      </p>

      {/* 1R */}
      <div>
        <GL field="outcome1R">Si sorti à 1R</GL>
        <div className="flex gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.value} type="button" onClick={() => setOutcome1R(outcome1R === o.value ? "" : o.value)}
              className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-sm font-semibold transition-all"
              style={outcome1R === o.value
                ? { backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid ${o.color}`, color: o.color }
                : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1.5R */}
      <div>
        <GL field="outcome15R">Si sorti à 1.5R</GL>
        <div className="flex gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.value} type="button" onClick={() => setOutcome15R(outcome15R === o.value ? "" : o.value)}
              className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-sm font-semibold transition-all"
              style={outcome15R === o.value
                ? { backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid ${o.color}`, color: o.color }
                : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── Edit form (inline) ────────────────────────────────────────────────── */
function EditForm({
  trade,
  backtestId,
  instrument,
  onCancel,
  onSaved,
}: {
  trade: Trade;
  backtestId: string;
  instrument: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<Direction>(trade.direction);
  const [outcome, setOutcome] = useState<TradeOutcome | "">(trade.outcome ?? "WIN");
  const [followedRules, setFollowedRules] = useState<"" | "true" | "false">(
    trade.followedRules === true ? "true" : trade.followedRules === false ? "false" : ""
  );
  const [outcome1R, setOutcome1R] = useState<string>(trade.outcome1R ?? "");
  const [outcome15R, setOutcome15R] = useState<string>(trade.outcome15R ?? "");
  const [selects, setSelects] = useState<Record<string, string>>({
    marketSession:   trade.marketSession   ?? "",
    timeframeEntry:  trade.timeframeEntry  ?? "",
    timeframeTrend:  trade.timeframeTrend  ?? "",
    liquiditySwept:  trade.liquiditySwept  ?? "",
    biasHTF:         trade.biasHTF         ?? "",
    biasMTF:         trade.biasMTF         ?? "",
    marketStructure: trade.marketStructure ?? "",
    ictModel:        trade.ictModel        ?? "",
    poi:             trade.poi             ?? "",
  });
  const setSel = (key: string) => (v: string) => setSelects((prev) => ({ ...prev, [key]: v }));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("direction", direction);
    if (outcome) fd.set("outcome", outcome);
    if (followedRules !== "") fd.set("followedRules", followedRules);
    if (outcome1R) fd.set("outcome1R", outcome1R);
    if (outcome15R) fd.set("outcome15R", outcome15R);
    startTransition(async () => {
      try {
        await updateBacktestTrade(backtestId, trade.id, fd);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3"
      style={{ borderTop: "1px solid var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
            Editing trade #{trade.tradeNumber}
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold tracking-wider"
            style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            {instrument}
          </span>
        </span>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
          <X size={13} />
        </button>
      </div>

      {/* ── 1. Direction & Outcome ── */}
      <Section title="Direction & Result">
        <GL field="direction">Direction</GL>
        <div className="flex gap-2 mb-3">
          {(["LONG", "SHORT"] as Direction[]).map((d) => (
            <button key={d} type="button" onClick={() => setDirection(d)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-all"
              style={direction === d
                ? d === "LONG"
                  ? { backgroundColor: "rgba(0,200,150,0.18)", border: "1px solid rgba(0,200,150,0.4)", color: "var(--accent-tertiary-light)" }
                  : { backgroundColor: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }
                : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }
              }
            >
              {d === "LONG" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {d}
            </button>
          ))}
        </div>

        <GL field="outcome">Outcome</GL>
        <div className="flex gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.value} type="button" onClick={() => setOutcome(o.value)}
              className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-sm font-semibold transition-all"
              style={outcome === o.value
                ? { backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid ${o.color}`, color: o.color }
                : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── 1b. Sorties alternatives ── */}
      <AlternativeScenariosSection
        outcome1R={outcome1R}
        setOutcome1R={setOutcome1R}
        outcome15R={outcome15R}
        setOutcome15R={setOutcome15R}
      />

      {/* ── 2. Timing ── */}
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="e-entryDate" field="entryDate">Entry Date *</L>
            <input id="e-entryDate" name="entryDate" type="datetime-local" required
              defaultValue={toDatetimeLocal(new Date(trade.entryDate))}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="e-exitDate" field="exitDate">Exit Date</L>
            <input id="e-exitDate" name="exitDate" type="datetime-local"
              defaultValue={trade.exitDate ? toDatetimeLocal(new Date(trade.exitDate)) : ""}
              className={iCls} style={iStyle} />
          </div>
        </div>
      </Section>

      {/* ── 3. Prices ── */}
      <Section title="Prices">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="e-entryPrice" field="entryPrice">Entry</L>
            <input id="e-entryPrice" name="entryPrice" type="number" step="any" placeholder="0.00"
              defaultValue={trade.entryPrice || ""}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="e-stopLoss" field="stopLoss">Stop Loss</L>
            <input id="e-stopLoss" name="stopLoss" type="number" step="any" placeholder="SL"
              defaultValue={trade.stopLoss ?? ""}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="e-takeProfit" field="takeProfit">Take Profit</L>
            <input id="e-takeProfit" name="takeProfit" type="number" step="any" placeholder="TP"
              defaultValue={trade.takeProfit ?? ""}
              className={iCls} style={iStyle} />
          </div>
        </div>
        <div>
          <L htmlFor="e-quantity" field="quantity">Quantity</L>
          <input id="e-quantity" name="quantity" type="number" step="0.01" min="0"
            defaultValue={trade.quantity ?? 1}
            className={iCls} style={iStyle} />
        </div>
      </Section>

      {/* ── 4. Market Context ── */}
      <Section title="Market Context" collapsible defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L field="marketSession">Session</L>
            <Combobox name="marketSession" options={SESSIONS} value={selects.marketSession} onChange={setSel("marketSession")} placeholder="— Select —" />
          </div>
          <div>
            <L field="timeframeEntry">TF Entry</L>
            <Combobox name="timeframeEntry" options={TIMEFRAMES} value={selects.timeframeEntry} onChange={setSel("timeframeEntry")} placeholder="— Select —" />
          </div>
          <div>
            <L field="timeframeTrend">TF Trend</L>
            <Combobox name="timeframeTrend" options={TIMEFRAMES} value={selects.timeframeTrend} onChange={setSel("timeframeTrend")} placeholder="— Select —" />
          </div>
          <div>
            <L field="liquiditySwept">Liq. Swept</L>
            <Combobox name="liquiditySwept" options={LIQUIDITIES} value={selects.liquiditySwept} onChange={setSel("liquiditySwept")} placeholder="— Select —" />
          </div>
          <div>
            <L field="biasHTF">Bias HTF</L>
            <Combobox name="biasHTF" options={BIASES} value={selects.biasHTF} onChange={setSel("biasHTF")} placeholder="— Select —" />
          </div>
          <div>
            <L field="biasMTF">Bias MTF</L>
            <Combobox name="biasMTF" options={BIASES} value={selects.biasMTF} onChange={setSel("biasMTF")} placeholder="— Select —" />
          </div>
        </div>
        <div>
          <L field="marketStructure">Market Structure</L>
          <Combobox name="marketStructure" options={STRUCTURES} value={selects.marketStructure} onChange={setSel("marketStructure")} placeholder="— Select —" />
        </div>
      </Section>

      {/* ── 5. ICT / SMC ── */}
      <Section title="ICT / SMC" collapsible defaultOpen={false}>
        <div>
          <L field="ictModel">Model</L>
          <Combobox name="ictModel" options={ICT_MODELS} value={selects.ictModel} onChange={setSel("ictModel")} placeholder="— Select —" />
        </div>
        <div>
          <L field="poi">Point of Interest (POI)</L>
          <Combobox name="poi" options={POI_TYPES} value={selects.poi} onChange={setSel("poi")} placeholder="— Select —" />
        </div>
      </Section>

      {/* ── 6. Evaluation ── */}
      <Section title="Evaluation">
        <div>
          <L htmlFor="e-grade" field="grade">Grade (1-5)</L>
          <input id="e-grade" name="grade" type="number" min="1" max="5" step="1" placeholder="—"
            defaultValue={trade.grade ?? ""}
            className={iCls} style={iStyle} />
        </div>

        <div>
          <GL field="followedRules">Followed Rules?</GL>
          <div className="flex gap-2">
            {[
              { v: "true",  l: "Yes", c: "var(--accent-tertiary-light)" },
              { v: "false", l: "No",  c: "#f87171" },
              { v: "",      l: "N/A", c: "var(--text-muted)" },
            ].map(({ v, l, c }) => (
              <button key={v} type="button"
                onClick={() => setFollowedRules(v as "" | "true" | "false")}
                className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-sm font-semibold transition-all"
                style={followedRules === v
                  ? { backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid ${c}`, color: c }
                  : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <GL field="isFomo">Psychology</GL>
          <CheckField name="isFomo" label="FOMO (entré par peur de rater)" field="isFomo" defaultChecked={trade.isFomo} />
          <CheckField name="isRevenge" label="Revenge trade" field="isRevenge" defaultChecked={trade.isRevenge} />
          <CheckField name="isImpulsive" label="Entrée impulsive (sans confirmation)" field="isImpulsive" defaultChecked={trade.isImpulsive} />
        </div>
      </Section>

      {/* ── 7. Notes & Media ── */}
      <Section title="Notes & Media" collapsible defaultOpen={false}>
        <div>
          <L htmlFor="e-tags" field="tags">Tags</L>
          <input id="e-tags" name="tags" type="text" placeholder="clean_entry, fomo, missed_tp…"
            defaultValue={trade.tags.join(", ")}
            className={iCls} style={iStyle} />
        </div>
        <div>
          <L htmlFor="e-notes" field="notes">Notes</L>
          <textarea id="e-notes" name="notes" rows={3}
            placeholder="Contexte, raison du trade, ce à améliorer…"
            defaultValue={trade.notes ?? ""}
            className={iCls} style={{ ...iStyle, resize: "none" }} />
        </div>
        <div>
          <p className={lCls} style={lStyle}>Screenshots<Tip field="screenshotUrl" /></p>
          <MediaUpload
            tradeId={trade.id}
            initialMedia={trade.media ?? []}
          />
        </div>
      </Section>

      {error && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Save
        </button>
      </div>
    </form>
  );
}

/* ─── TradeRow ──────────────────────────────────────────────────────────── */
export function TradeRow({ trade, backtestId, instrument, rMultipleOverride }: { trade: Trade; backtestId: string; instrument: string; rMultipleOverride?: number | null }) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteBacktestTrade(backtestId, trade.id));
  }

  const displayR = rMultipleOverride !== undefined ? rMultipleOverride : trade.rMultiple;

  const rColor =
    displayR == null ? "var(--text-muted)"
    : displayR > 0   ? "var(--accent-tertiary-light)"
    : displayR < 0   ? "#f87171"
    : "var(--text-secondary)";

  return (
    <>
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete trade #${trade.tradeNumber}?`}
        description="This action is irreversible. The trade will be permanently removed from this backtest."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        isPending={isPending}
      />

      <div style={{ opacity: isPending ? 0.5 : 1 }}>
        {/* ── Display row ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 text-base transition-colors hover:bg-white/[0.02]">
          {/* # */}
          <span className="w-5 shrink-0 text-base tabular-nums" style={{ color: "var(--text-muted)" }}>
            {trade.tradeNumber}
          </span>

          {/* Direction */}
          <span className="w-14 shrink-0">
            {trade.direction === "LONG" ? (
              <span className="flex items-center gap-1 text-base font-semibold" style={{ color: "var(--accent-tertiary-light)" }}>
                <TrendingUp size={14} /> Long
              </span>
            ) : (
              <span className="flex items-center gap-1 text-base font-semibold" style={{ color: "#f87171" }}>
                <TrendingDown size={14} /> Short
              </span>
            )}
          </span>

          {/* Date */}
          <span className="w-20 shrink-0 text-base tabular-nums" style={{ color: "var(--text-muted)" }}>
            {new Date(trade.entryDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>

          {/* Entry / Exit */}
          <span className="w-28 shrink-0 text-base tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {trade.entryPrice.toFixed(2)}
            {trade.exitPrice != null ? ` → ${trade.exitPrice.toFixed(2)}` : ""}
          </span>

          {/* Outcome */}
          <span className="w-12 shrink-0">
            <OutcomeBadge outcome={trade.outcome} />
          </span>

          {/* R-multiple */}
          <span className="w-14 shrink-0 text-right text-base font-bold tabular-nums" style={{ color: rColor }}>
            {displayR != null
              ? (displayR >= 0 ? "+" : "") + displayR.toFixed(2) + "R"
              : "—"}
          </span>

          {/* P&L$ */}
          <span className="w-16 shrink-0 text-right text-base tabular-nums" style={{ color: rColor }}>
            {trade.pnlDollars != null
              ? (trade.pnlDollars >= 0 ? "+$" : "-$") + Math.abs(trade.pnlDollars).toFixed(0)
              : "—"}
          </span>

          {/* Grade */}
          <span className="w-16 shrink-0">
            <GradeStars grade={trade.grade} />
          </span>

          {/* Notes */}
          <span className="flex-1 truncate text-base" style={{ color: "var(--text-muted)" }}>
            {trade.notes ?? ""}
          </span>

          {/* Actions */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              disabled={isPending}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ color: editing ? "var(--accent-primary)" : "var(--text-muted)" }}
              aria-label="Edit trade"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              className="rounded-lg p-1.5 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              style={{ color: "var(--text-muted)" }}
              aria-label="Delete trade"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* ── Edit form (inline expansion) ── */}
        {editing && (
          <EditForm
            trade={trade}
            backtestId={backtestId}
            instrument={instrument}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        )}
      </div>
    </>
  );
}
