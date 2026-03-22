"use client";

import { useRef, useState, useTransition, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { addBacktestTrade } from "../actions";
import { TrendingUp, TrendingDown, Loader2, HelpCircle, X, ChevronDown } from "lucide-react";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";

/* ─── Styles ────────────────────────────────────────────────────────────── */
const iStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  outline: "none",
};
const lCls = "mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-widest";
const lStyle: React.CSSProperties = { color: "var(--text-muted)" };
const iCls = "block w-full px-2.5 py-2 text-base transition-all focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:opacity-30";
const sCls = `${iCls} appearance-none`;

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
  { value: "HH_HL",    label: "HH/HL (Uptrend)" },
  { value: "LH_LL",    label: "LH/LL (Downtrend)" },
  { value: "RANGE",    label: "Range" },
  { value: "BOS_UP",   label: "BOS Up (Break of Structure)" },
  { value: "BOS_DOWN", label: "BOS Down" },
  { value: "CHOCH_UP", label: "CHoCH Up (Change of Character)" },
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

const OUTCOMES = [
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
  marketSession:   "Session de marché au moment de l'entrée. Clé pour analyser 'London performe-t-il mieux que NY ?'",
  timeframeEntry:  "Timeframe sur lequel tu as exécuté l'entrée (ex: M5 pour le trigger).",
  timeframeTrend:  "Timeframe de la tendance ou du biais (ex: H1 pour la direction).",
  ictModel:        "Modèle ICT utilisé pour ce trade : Silver Bullet, OTE, FVG Fill, Power of 3…",
  poi:             "Point d'intérêt où tu es entré : Order Block, FVG, Breaker Block, niveau clé…",
  biasHTF:         "Biais directionnel sur le higher timeframe (D1/W1). Bullish = on cherche des longs.",
  biasMTF:         "Biais sur le mid timeframe (H1/H4). Doit idéalement être aligné avec le HTF.",
  marketStructure: "Structure de marché au moment de l'entrée. BOS = confirmation du biais. CHoCH = retournement.",
  liquiditySwept:  "Liquidité balayée avant l'entrée. BSL = buy stops (hauts précédents). SSL = sell stops (bas précédents).",
  outcome:         "Résultat du trade : Win, Loss ou Breakeven.",
  grade:           "Note d'exécution 1-5. Indépendant du résultat : note le respect de ton processus, pas le P&L.",
  notes:           "Contexte, raison de l'entrée, ce que tu ferais différemment.",
  screenshotUrl:   "Lien TradingView ou image du chart au moment du trade.",
  tags:            "Mots-clés séparés par virgule. Ex: fomo, early_exit, clean_entry, missed_tp",
  isFomo:          "Trade pris par peur de rater le mouvement (FOMO). Souvent pris trop tard, sans setup valide.",
  isRevenge:       "Trade pris pour 'récupérer' après une perte. Biais émotionnel fort, souvent perdant.",
  isImpulsive:     "Entrée sans attendre la confirmation ou le setup complet.",
  followedRules:   "As-tu respecté toutes les règles de ton playbook pour ce trade ?",
};

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
        left: Math.min(
          rect.left,
          window.innerWidth - 224 - 8,
        ),
      });
    }
    setOpen((v) => !v);
  }

  const tooltipEl = open && coords
    ? createPortal(
        <span
          className="w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-xl"
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
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
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
function L({ htmlFor, field, children, req }: { htmlFor?: string; field: string; children: React.ReactNode; req?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={lCls} style={lStyle}>
      {children}{req && <span style={{ color: "#f87171" }}>*</span>}
      <Tip field={field} />
    </label>
  );
}
function GL({ field, children }: { field: string; children: React.ReactNode }) {
  return <p className={lCls} style={lStyle}>{children}<Tip field={field} /></p>;
}

/* ─── Section wrapper ───────────────────────────────────────────────────── */
function Section({ title, children, collapsible = false }: {
  title: string; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between px-3 py-2 text-left ${collapsible ? "cursor-pointer hover:bg-white/[0.02]" : "cursor-default"}`}
        style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
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

/* ─── Select ────────────────────────────────────────────────────────────── */
function Sel({ name, options }: { name: string; options: { value: string; label: string }[] }) {
  return (
    <select name={name} className={sCls} style={iStyle}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ─── Checkbox field ────────────────────────────────────────────────────── */
function CheckField({ name, label, field }: { name: string; label: string; field: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" name={name} value="true"
        className="h-3.5 w-3.5 rounded accent-[var(--accent-primary)]" />
      <span className="text-base" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <Tip field={field} />
    </label>
  );
}

/* ─── Form ──────────────────────────────────────────────────────────────── */
export function AddTradeForm({ backtestId }: { backtestId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [outcome, setOutcome] = useState<string>("WIN");
  const [followedRules, setFollowedRules] = useState<"" | "true" | "false">("");
  const [error, setError] = useState<string | null>(null);
  // savedTradeId is set after the trade row is persisted; used by MediaUpload.
  const [savedTradeId, setSavedTradeId] = useState<string | null>(null);
  // tempMedia holds uploads done before the trade exists (tradeId="temp")
  const [tempMedia, setTempMedia] = useState<UploadedMedia[]>([]);
  const handleTempUploaded = useCallback((media: UploadedMedia[]) => setTempMedia(media), []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(formRef.current!);
    fd.set("direction", direction);
    fd.set("outcome", outcome);
    if (followedRules !== "") fd.set("followedRules", followedRules);
    startTransition(async () => {
      try {
        const storageKeys = tempMedia.map((m) => m.storageKey).filter(Boolean) as string[];
        const tradeId = await addBacktestTrade(backtestId, fd, storageKeys);
        // Reveal the MediaUpload component bound to the real trade ID.
        setSavedTradeId(tradeId);
        setTempMedia([]);
        formRef.current?.reset();
        setDirection("LONG");
        setOutcome("WIN");
        setFollowedRules("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add trade.");
      }
    });
  }

  const today = new Date().toISOString().slice(0, 16);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 px-4 py-4">

      {/* ── 1. Direction & Outcome ── */}
      <Section title="Direction & Result">
        <GL field="direction">Direction</GL>
        <div className="flex gap-2 mb-3">
          {(["LONG", "SHORT"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDirection(d)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-base font-semibold transition-all"
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
              className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-base font-semibold transition-all"
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

      {/* ── 2. Timing ── */}
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="entryDate" field="entryDate" req>Entry Date</L>
            <input id="entryDate" name="entryDate" type="datetime-local" required
              defaultValue={today} className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="exitDate" field="exitDate">Exit Date</L>
            <input id="exitDate" name="exitDate" type="datetime-local"
              className={iCls} style={iStyle} />
          </div>
        </div>
      </Section>

      {/* ── 3. Prices ── */}
      <Section title="Prices">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="entryPrice" field="entryPrice">Entry</L>
            <input id="entryPrice" name="entryPrice" type="number" step="any" placeholder="0.00"
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="exitPrice" field="exitPrice">Exit</L>
            <input id="exitPrice" name="exitPrice" type="number" step="any" placeholder="0.00"
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="stopLoss" field="stopLoss">Stop Loss</L>
            <input id="stopLoss" name="stopLoss" type="number" step="any" placeholder="SL"
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="takeProfit" field="takeProfit">Take Profit</L>
            <input id="takeProfit" name="takeProfit" type="number" step="any" placeholder="TP"
              className={iCls} style={iStyle} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <L htmlFor="rMultiple" field="rMultiple">R-Multiple</L>
            <input id="rMultiple" name="rMultiple" type="number" step="0.01" placeholder="auto"
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="pnlDollars" field="pnlDollars">P&L ($)</L>
            <input id="pnlDollars" name="pnlDollars" type="number" step="0.01" placeholder="0.00"
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="pnlPoints" field="pnlPoints">P&L (pts)</L>
            <input id="pnlPoints" name="pnlPoints" type="number" step="0.01" placeholder="0.0"
              className={iCls} style={iStyle} />
          </div>
        </div>

        <div>
          <L htmlFor="quantity" field="quantity">Quantity</L>
          <input id="quantity" name="quantity" type="number" step="0.01" min="0" defaultValue="1"
            className={iCls} style={iStyle} />
        </div>
      </Section>

      {/* ── 4. Market Context ── */}
      <Section title="Market Context" collapsible>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="marketSession" field="marketSession">Session</L>
            <Sel name="marketSession" options={SESSIONS} />
          </div>
          <div>
            <L htmlFor="timeframeEntry" field="timeframeEntry">TF Entry</L>
            <Sel name="timeframeEntry" options={TIMEFRAMES} />
          </div>
          <div>
            <L htmlFor="timeframeTrend" field="timeframeTrend">TF Trend</L>
            <Sel name="timeframeTrend" options={TIMEFRAMES} />
          </div>
          <div>
            <L htmlFor="liquiditySwept" field="liquiditySwept">Liq. Swept</L>
            <Sel name="liquiditySwept" options={LIQUIDITIES} />
          </div>
          <div>
            <L htmlFor="biasHTF" field="biasHTF">Bias HTF</L>
            <Sel name="biasHTF" options={BIASES} />
          </div>
          <div>
            <L htmlFor="biasMTF" field="biasMTF">Bias MTF</L>
            <Sel name="biasMTF" options={BIASES} />
          </div>
        </div>
        <div>
          <L htmlFor="marketStructure" field="marketStructure">Market Structure</L>
          <Sel name="marketStructure" options={STRUCTURES} />
        </div>
      </Section>

      {/* ── 5. ICT / SMC ── */}
      <Section title="ICT / SMC" collapsible>
        <div>
          <L htmlFor="ictModel" field="ictModel">Model</L>
          <Sel name="ictModel" options={ICT_MODELS} />
        </div>
        <div>
          <L htmlFor="poi" field="poi">Point of Interest (POI)</L>
          <Sel name="poi" options={POI_TYPES} />
        </div>
      </Section>

      {/* ── 6. Evaluation ── */}
      <Section title="Evaluation">
        <div>
          <L htmlFor="grade" field="grade">Grade (1-5)</L>
          <input id="grade" name="grade" type="number" min="1" max="5" step="1" placeholder="—"
            className={iCls} style={iStyle} />
        </div>

        <div>
          <GL field="followedRules">Followed Rules?</GL>
          <div className="flex gap-2">
            {[{ v: "true", l: "Yes", c: "var(--accent-tertiary-light)" }, { v: "false", l: "No", c: "#f87171" }, { v: "", l: "N/A", c: "var(--text-muted)" }].map(({ v, l, c }) => (
              <button key={v} type="button" onClick={() => setFollowedRules(v as "" | "true" | "false")}
                className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-base font-semibold transition-all"
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
          <CheckField name="isFomo" label="FOMO (entré par peur de rater)" field="isFomo" />
          <CheckField name="isRevenge" label="Revenge trade" field="isRevenge" />
          <CheckField name="isImpulsive" label="Entrée impulsive (sans confirmation)" field="isImpulsive" />
        </div>
      </Section>

      {/* ── 7. Notes & Media ── */}
      <Section title="Notes & Media" collapsible>
        <div>
          <L htmlFor="tags" field="tags">Tags</L>
          <input id="tags" name="tags" type="text" placeholder="clean_entry, fomo, missed_tp…"
            className={iCls} style={iStyle} />
        </div>
        <div>
          <L htmlFor="notes" field="notes">Notes</L>
          <textarea id="notes" name="notes" rows={3} placeholder="Contexte, raison du trade, ce à améliorer…"
            className={iCls} style={{ ...iStyle, resize: "none" }} />
        </div>
        <div>
          <p className={lCls} style={lStyle}>Screenshots<Tip field="screenshotUrl" /></p>
          {savedTradeId ? (
            <MediaUpload tradeId={savedTradeId} />
          ) : (
            <MediaUpload
              tradeId="temp"
              initialMedia={tempMedia}
              onTempUploaded={handleTempUploaded}
            />
          )}
        </div>
      </Section>

      {error && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}>
          {error}
        </p>
      )}

      {savedTradeId ? (
        <button
          type="button"
          onClick={() => { setSavedTradeId(null); setTempMedia([]); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-base font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "rgba(0,200,150,0.15)", border: "1px solid rgba(0,200,150,0.3)", color: "var(--accent-tertiary-light)" }}
        >
          ✓ Trade saved — Add another
        </button>
      ) : (
        <button type="submit" disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-base font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <span>Add Trade</span>}
        </button>
      )}
    </form>
  );
}
