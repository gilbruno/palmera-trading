"use client";

import { useRef, useState, useEffect, useTransition, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, TrendingDown, Loader2, HelpCircle, X, ChevronDown,
} from "lucide-react";
import { createTrade, updateTrade } from "./actions";
import { Combobox } from "@/components/ui/Combobox";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { SuccessToast } from "@/components/ui/SuccessToast";

/* ─── Shared input styles ───────────────────────────────────────────────── */
const iStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  outline: "none",
};
const iCls =
  "block w-full px-2.5 py-2 text-base transition-all focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:opacity-30";
const lCls = "mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-widest";
const lStyle: React.CSSProperties = { color: "var(--text-muted)" };

/* ─── Symbols by asset class ────────────────────────────────────────────── */
const SYMBOLS_BY_CLASS: Record<string, string[]> = {
  FOREX: [
    "EUR/USD","GBP/USD","USD/JPY","USD/CHF","AUD/USD","NZD/USD","USD/CAD",
    "EUR/GBP","EUR/JPY","EUR/CHF","EUR/AUD","EUR/CAD","EUR/NZD",
    "GBP/JPY","GBP/CHF","GBP/AUD","GBP/CAD","GBP/NZD",
    "AUD/JPY","AUD/CHF","AUD/CAD","AUD/NZD",
    "NZD/JPY","NZD/CHF","NZD/CAD",
    "CHF/JPY","CAD/JPY","CAD/CHF",
    "USD/MXN","USD/ZAR","USD/TRY","USD/SEK","USD/NOK","USD/DKK","USD/SGD","USD/HKD",
    "EUR/SEK","EUR/NOK","EUR/DKK","EUR/PLN","EUR/HUF","EUR/CZK",
    "GBP/SEK","GBP/NOK","GBP/DKK",
    "XAU/USD","XAG/USD",
  ],
  CRYPTO: [
    "BTC/USD","BTC/USDT","ETH/USD","ETH/USDT","BTC/ETH",
    "SOL/USD","SOL/USDT","BNB/USD","BNB/USDT",
    "XRP/USD","XRP/USDT","ADA/USD","ADA/USDT",
    "DOGE/USD","DOGE/USDT","AVAX/USD","AVAX/USDT",
    "DOT/USD","LINK/USD","MATIC/USD","LTC/USD","NEAR/USD","APT/USD","SUI/USD",
    "BTCUSD","ETHUSD","SOLUSD","BNBUSD",
  ],
  FUTURES: [
    "ES","NQ","YM","RTY","CL","GC","SI","NG","ZB","ZN","ZF","ZT",
    "6E","6B","6J","6A","6C","6S","6N",
    "MES","MNQ","MYM","M2K","MCL","MGC",
    "HG","PL","PA","LE","GF","HE","ZC","ZS","ZW","ZL","ZM","KC","SB","CT","CC",
    "VX","UB",
  ],
  STOCKS: [
    "AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","TSLA","AVGO","AMD",
    "JPM","BAC","GS","MS","WFC","C","BRK.B",
    "SPY","QQQ","IWM","DIA","GLD","SLV","USO","TLT","HYG","VIX",
    "NFLX","DIS","UBER","LYFT","SNAP","COIN","HOOD","PLTR","RBLX",
    "V","MA","PYPL","SQ","SHOP","CRM","ADBE","ORCL","INTC","QCOM",
    "WMT","TGT","COST","HD","LOW","MCD","SBUX","NKE","BA","GE","F","GM",
    "XOM","CVX","OXY","PFE","JNJ","MRNA","ABBV","UNH","LLY","MRK",
  ],
  INDICES: [
    "US500","US100","US30","US2000",
    "GER40","FRA40","UK100","EU50","JPN225","AUS200","HK50",
    "SPX","NDX","DJI","RUT","VIX",
  ],
  CFD: [
    "US500","US100","US30","GER40","UK100","JPN225",
    "XAUUSD","XAGUSD","XTIUSD","XBRUSD","XNGUSD",
    "BTCUSD","ETHUSD",
  ],
  COMMODITIES: [
    "XAUUSD","XAGUSD","XPTUSD","XPDUSD",
    "XTIUSD","XBRUSD","XNGUSD",
    "CORN","WHEAT","SOYBEAN","SUGAR","COFFEE","COTTON","COCOA",
    "COPPER","ALUMINUM","NICKEL","ZINC","LEAD","IRON",
  ],
  OPTIONS: ["SPY","QQQ","AAPL","TSLA","NVDA","AMZN","META","MSFT","SPX","NDX"],
  BONDS: ["ZB","ZN","ZF","ZT","UB","TLT","IEF","SHY","BND","AGG"],
};

/* ─── SymbolInput ────────────────────────────────────────────────────────── */
function SymbolInput({
  assetClass, defaultValue,
}: { assetClass: string; defaultValue?: string }) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const symbols = SYMBOLS_BY_CLASS[assetClass] ?? Object.values(SYMBOLS_BY_CLASS).flat();
  const q = query.trim().toUpperCase();
  const filtered = q.length === 0
    ? symbols.slice(0, 40)
    : symbols.filter((s) => s.toUpperCase().includes(q)).slice(0, 40);

  function handleSelect(s: string) {
    setQuery(s);
    setOpen(false);
    inputRef.current?.focus();
  }

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (inputRef.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const listEl = open && filtered.length > 0 && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={listRef}
          style={{
            position: "fixed",
            top: (inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: inputRef.current?.getBoundingClientRect().left ?? 0,
            width: inputRef.current?.getBoundingClientRect().width ?? 200,
            zIndex: 9999,
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            overflow: "hidden auto",
            maxHeight: 220,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="flex w-full items-center px-2.5 py-1.5 text-base transition-colors hover:bg-white/5"
              style={{ color: s === query ? "var(--text-primary)" : "var(--text-secondary)", textAlign: "left" }}
            >
              {s}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <input type="hidden" name="symbol" value={query} />
      <input
        ref={inputRef}
        id="symbol"
        type="text"
        required
        placeholder="EUR/USD, NQ, AAPL…"
        value={query}
        autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && filtered.length === 1) { e.preventDefault(); handleSelect(filtered[0]); }
        }}
        className={iCls}
        style={iStyle}
      />
      {listEl}
    </>
  );
}

/* ─── Option maps ───────────────────────────────────────────────────────── */
export const ASSET_CLASSES = [
  { value: "FOREX",       label: "Forex" },
  { value: "CRYPTO",      label: "Crypto" },
  { value: "STOCKS",      label: "Stocks" },
  { value: "FUTURES",     label: "Futures" },
  { value: "OPTIONS",     label: "Options" },
  { value: "CFD",         label: "CFD" },
  { value: "COMMODITIES", label: "Commodities" },
  { value: "INDICES",     label: "Indices" },
  { value: "BONDS",       label: "Bonds" },
];

const TIMEFRAMES = [
  { value: "",    label: "— Select —" },
  { value: "M1",  label: "1m" },
  { value: "M5",  label: "5m" },
  { value: "M15", label: "15m" },
  { value: "M30", label: "30m" },
  { value: "H1",  label: "1H" },
  { value: "H4",  label: "4H" },
  { value: "D1",  label: "Daily" },
  { value: "W1",  label: "Weekly" },
  { value: "MN",  label: "Monthly" },
];

const SESSIONS = [
  { value: "",                label: "— Select —" },
  { value: "ASIA",            label: "Asia" },
  { value: "LONDON",          label: "London" },
  { value: "LONDON_CLOSE",    label: "London Close" },
  { value: "NEW_YORK_AM",     label: "New York AM" },
  { value: "NEW_YORK_PM",     label: "New York PM" },
  { value: "SILVER_BULLET_AM",label: "Silver Bullet AM (10-11)" },
  { value: "SILVER_BULLET_PM",label: "Silver Bullet PM (2-3)" },
  { value: "OVERLAP",         label: "London/NY Overlap" },
  { value: "OFF_HOURS",       label: "Off Hours" },
];

const OUTCOMES = [
  { value: "WIN",       label: "Win",  color: "var(--accent-tertiary-light)" },
  { value: "LOSS",      label: "Loss", color: "#f87171" },
  { value: "BREAKEVEN", label: "B/E",  color: "var(--text-muted)" },
];

const PLAN_ADHERENCES = [
  { value: "YES",     label: "Yes",     color: "var(--accent-tertiary-light)" },
  { value: "PARTIAL", label: "Partial", color: "var(--accent-secondary-light)" },
  { value: "NO",      label: "No",      color: "#f87171" },
];

const EMOTIONS = [
  { value: "",           label: "— Select —" },
  { value: "CONFIDENT",  label: "Confident" },
  { value: "CALM",       label: "Calm" },
  { value: "NEUTRAL",    label: "Neutral" },
  { value: "ANXIOUS",    label: "Anxious" },
  { value: "FEARFUL",    label: "Fearful" },
  { value: "GREEDY",     label: "Greedy" },
  { value: "FRUSTRATED", label: "Frustrated" },
  { value: "EUPHORIC",   label: "Euphoric" },
];

/* ─── Tooltips ──────────────────────────────────────────────────────────── */
const TIPS: Record<string, string> = {
  symbol:        "Symbole de l'instrument tradé. Ex: EUR/USD, NQ, AAPL, BTC/USD.",
  assetClass:    "Classe d'actif : Forex, Futures, Crypto, Stocks…",
  direction:     "LONG si tu achètes en espérant une hausse. SHORT si tu vends à découvert.",
  entryTime:     "Date et heure exactes de l'entrée en position.",
  exitTime:      "Date et heure de la sortie. Laisse vide si le trade est encore ouvert.",
  entryPrice:    "Prix d'exécution à l'entrée.",
  exitPrice:     "Prix de sortie. Laisse vide si encore ouvert.",
  stopLoss:      "Niveau de coupe-perte. Nécessaire pour le calcul auto du R-multiple.",
  takeProfit:    "Niveau cible de prise de bénéfices.",
  quantity:      "Nombre de contrats, lots, actions ou unités tradées.",
  riskPercent:   "Risque exprimé en % du capital. Ex: 1 = 1% du compte.",
  riskAmount:    "Montant risqué en devise du compte.",
  pnlGross:      "P&L brut avant frais. Calculé automatiquement si Entry, Exit et Quantité sont renseignés.",
  pnlNet:        "P&L net après commissions et swap.",
  commission:    "Frais de courtage pour ce trade.",
  swap:          "Frais de financement overnight (swap).",
  rMultiple:     "R-multiple : ratio gain/risque réalisé. +2R = gagné 2× le risque initial. Calculé auto si SL et prix sont renseignés.",
  outcome:       "Résultat : Win, Loss ou Breakeven.",
  timeframeEntry:"Timeframe sur lequel tu as exécuté l'entrée (trigger).",
  timeframeTrend:"Timeframe de la tendance ou du biais directionnel.",
  marketSession: "Session de marché au moment de l'entrée.",
  qualityScore:  "Note d'exécution 1-5. Evalue ton processus indépendamment du P&L.",
  planAdherence: "As-tu respecté ton plan de trading pour ce trade ?",
  emotion:       "Etat émotionnel dominant lors de l'entrée.",
  preTradeNotes: "Raison de l'entrée, contexte de marché, setup identifié.",
  postTradeNotes:"Analyse post-trade : ce qui s'est bien passé, ce que tu referais différemment.",
  mistakeNotes:  "Erreurs commises : entrée prématurée, SL trop serré, FOMO…",
  screenshotUrl: "URL d'une capture d'écran du chart (TradingView, etc.).",
  tags:          "Mots-clés séparés par virgule. Ex: fomo, early_exit, clean_entry, missed_tp",
  setupId:       "Setup ou stratégie utilisée pour ce trade (depuis ton Playbook).",
  isFomo:        "Trade pris par peur de rater le mouvement.",
  isRevenge:     "Trade de revanche après une perte pour 'récupérer'.",
  isImpulsive:   "Entrée sans attendre la confirmation ou le setup complet.",
};

/* ─── Tooltip component ─────────────────────────────────────────────────── */
function Tip({ field }: { field: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tip = TIPS[field];

  if (!tip) return null;

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.top, left: Math.min(rect.left, window.innerWidth - 232) });
    }
    setOpen((v) => !v);
  }

  const tooltipEl =
    open && coords
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
function L({
  htmlFor, field, children, req,
}: { htmlFor?: string; field: string; children: React.ReactNode; req?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={lCls} style={lStyle}>
      {children}
      {req && <span style={{ color: "#f87171" }}>*</span>}
      <Tip field={field} />
    </label>
  );
}

function GL({ field, children }: { field: string; children: React.ReactNode }) {
  return <p className={lCls} style={lStyle}>{children}<Tip field={field} /></p>;
}

/* ─── Section wrapper ───────────────────────────────────────────────────── */
function Section({
  title, children, collapsible = false, defaultOpen = true,
}: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
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

/* ─── Combobox wrapper (controlled) ────────────────────────────────────── */
function Sel({
  name, options, defaultValue,
}: { name: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const [val, setVal] = useState(defaultValue ?? "");
  return <Combobox name={name} options={options} value={val} onChange={setVal} />;
}

/* ─── Checkbox field ────────────────────────────────────────────────────── */
function CheckField({ name, label, field, defaultChecked }: { name: string; label: string; field: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" name={name} value="true"
        defaultChecked={defaultChecked}
        className="h-3.5 w-3.5 rounded accent-[var(--accent-primary)]" />
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <Tip field={field} />
    </label>
  );
}

/* ─── Toggle button group ───────────────────────────────────────────────── */
function ToggleGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; color: string }[];
  value: T | "";
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? ("" as T | "") : o.value)}
          className="flex flex-1 items-center justify-center rounded-xl py-1.5 text-base font-semibold transition-all"
          style={
            value === o.value
              ? { backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid ${o.color}`, color: o.color }
              : { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Props ─────────────────────────────────────────────────────────────── */
export interface Setup {
  id: string;
  name: string;
}

export interface TradeData {
  id: string;
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTime: Date;
  exitTime: Date | null;
  entryPrice: string | number;
  exitPrice: string | number | null;
  stopLoss: string | number | null;
  takeProfit: string | number | null;
  quantity: string | number;
  commission: string | number | null;
  swap: string | number | null;
  rMultiple: string | number | null;
  outcome: string | null;
  timeframeTrend: string | null;
  timeframeEntry: string | null;
  qualityScore: number | null;
  planAdherence: string | null;
  emotion: string | null;
  preTradeNotes: string | null;
  postTradeNotes: string | null;
  mistakeNotes: string | null;
  isFomo: boolean;
  isRevenge: boolean;
  isImpulsive: boolean;
  tags: string[];
  setupId: string | null;
  media?: UploadedMedia[];
}

interface TradeFormProps {
  setups: Setup[];
  /** If provided, renders in edit mode */
  trade?: TradeData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function fmtDatetimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
}

function fmtNum(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

/* ─── Main form component ───────────────────────────────────────────────── */
export function TradeForm({ setups, trade, onSuccess, onCancel }: TradeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isEdit = !!trade;

  const [direction, setDirection] = useState<"LONG" | "SHORT">(
    trade?.direction ?? "LONG"
  );
  const [assetClass, setAssetClass] = useState<string>(trade?.assetClass ?? "FOREX");
  const [outcome, setOutcome] = useState<string>(trade?.outcome ?? "");
  const [planAdherence, setPlanAdherence] = useState<string>(trade?.planAdherence ?? "");

  // In add mode: set after the trade is saved to reveal MediaUpload.
  const [savedTradeId, setSavedTradeId] = useState<string | null>(null);
  // Temp uploads done before the trade exists (tradeId="temp")
  const [tempMedia, setTempMedia] = useState<UploadedMedia[]>([]);
  const handleTempUploaded = useCallback((media: UploadedMedia[]) => setTempMedia(media), []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(formRef.current!);
    fd.set("direction", direction);
    if (outcome) fd.set("outcome", outcome);
    if (planAdherence) fd.set("planAdherence", planAdherence);

    startTransition(async () => {
      try {
        if (isEdit && trade) {
          await updateTrade(trade.id, fd);
          setToastMessage("Trade mis à jour");
          setToastOpen(true);
        } else {
          const storageKeys = tempMedia.map((m) => m.storageKey).filter(Boolean) as string[];
          const newId = await createTrade(fd, storageKeys);
          formRef.current?.reset();
          setDirection("LONG");
          setAssetClass("FOREX");
          setOutcome("");
          setPlanAdherence("");
          setTempMedia([]);
          setSavedTradeId(newId);
          setToastMessage("Trade enregistré");
          setToastOpen(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    });
  }

  const nowLocal = fmtDatetimeLocal(new Date());

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 px-4 py-4">

      {/* ── 1. Identity ── */}
      <Section title="Identity">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="assetClass" field="assetClass">Asset Class</L>
            <Combobox
              name="assetClass"
              options={ASSET_CLASSES}
              value={assetClass}
              onChange={setAssetClass}
            />
          </div>
          <div>
            <L htmlFor="symbol" field="symbol" req>Symbol</L>
            <SymbolInput assetClass={assetClass} defaultValue={trade?.symbol ?? ""} />
          </div>
        </div>

        <div>
          <GL field="direction">Direction</GL>
          <div className="flex gap-2">
            {(["LONG", "SHORT"] as const).map((d) => (
              <button
                key={d} type="button"
                onClick={() => setDirection(d)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-base font-semibold transition-all"
                style={
                  direction === d
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
        </div>

        {setups.length > 0 && (
          <div>
            <L htmlFor="setupId" field="setupId">Setup (Playbook)</L>
            <Sel
              name="setupId"
              options={[{ value: "", label: "— No setup —" }, ...setups.map((s) => ({ value: s.id, label: s.name }))]}
              defaultValue={trade?.setupId ?? ""}
            />
          </div>
        )}
      </Section>

      {/* ── 2. Timing ── */}
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="entryTime" field="entryTime" req>Entry Time</L>
            <input
              id="entryTime" name="entryTime" type="datetime-local" required
              defaultValue={trade ? fmtDatetimeLocal(trade.entryTime) : nowLocal}
              className={iCls} style={iStyle}
            />
          </div>
          <div>
            <L htmlFor="exitTime" field="exitTime">Exit Time</L>
            <input
              id="exitTime" name="exitTime" type="datetime-local"
              defaultValue={fmtDatetimeLocal(trade?.exitTime)}
              className={iCls} style={iStyle}
            />
          </div>
        </div>
      </Section>

      {/* ── 3. Prices & Sizing ── */}
      <Section title="Prices & Sizing">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="entryPrice" field="entryPrice" req>Entry Price</L>
            <input id="entryPrice" name="entryPrice" type="number" step="any" required
              placeholder="0.00" defaultValue={fmtNum(trade?.entryPrice)}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="exitPrice" field="exitPrice">Exit Price</L>
            <input id="exitPrice" name="exitPrice" type="number" step="any"
              placeholder="0.00" defaultValue={fmtNum(trade?.exitPrice)}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="stopLoss" field="stopLoss">Stop Loss</L>
            <input id="stopLoss" name="stopLoss" type="number" step="any"
              placeholder="SL" defaultValue={fmtNum(trade?.stopLoss)}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="takeProfit" field="takeProfit">Take Profit</L>
            <input id="takeProfit" name="takeProfit" type="number" step="any"
              placeholder="TP" defaultValue={fmtNum(trade?.takeProfit)}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="quantity" field="quantity">Quantity</L>
            <input id="quantity" name="quantity" type="number" step="any" min="0"
              defaultValue={fmtNum(trade?.quantity) || "1"}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="rMultiple" field="rMultiple">R-Multiple</L>
            <input id="rMultiple" name="rMultiple" type="number" step="0.01"
              placeholder="auto" defaultValue={fmtNum(trade?.rMultiple)}
              className={iCls} style={iStyle} />
          </div>
        </div>
      </Section>

      {/* ── 4. P&L ── */}
      <Section title="P&L & Fees" collapsible defaultOpen={isEdit}>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <L htmlFor="pnlGross" field="pnlGross">P&L Gross</L>
            <input id="pnlGross" name="pnlGross" type="number" step="0.01"
              placeholder="auto" className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="commission" field="commission">Commission</L>
            <input id="commission" name="commission" type="number" step="0.01"
              placeholder="0.00" defaultValue={fmtNum(trade?.commission)}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="swap" field="swap">Swap</L>
            <input id="swap" name="swap" type="number" step="0.01"
              placeholder="0.00" defaultValue={fmtNum(trade?.swap)}
              className={iCls} style={iStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="riskPercent" field="riskPercent">Risk %</L>
            <input id="riskPercent" name="riskPercent" type="number" step="0.01"
              placeholder="1.0" className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="riskAmount" field="riskAmount">Risk $</L>
            <input id="riskAmount" name="riskAmount" type="number" step="0.01"
              placeholder="100.00" className={iCls} style={iStyle} />
          </div>
        </div>
      </Section>

      {/* ── 5. Result ── */}
      <Section title="Result">
        <div>
          <GL field="outcome">Outcome</GL>
          <ToggleGroup
            options={OUTCOMES}
            value={outcome}
            onChange={setOutcome}
          />
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Leave unset to auto-detect from P&L
          </p>
        </div>

        <div>
          <GL field="planAdherence">Plan Adherence</GL>
          <ToggleGroup
            options={PLAN_ADHERENCES}
            value={planAdherence}
            onChange={setPlanAdherence}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="qualityScore" field="qualityScore">Quality Score (1-5)</L>
            <input id="qualityScore" name="qualityScore" type="number" min="1" max="5" step="1"
              placeholder="—" defaultValue={trade?.qualityScore ?? ""}
              className={iCls} style={iStyle} />
          </div>
          <div>
            <L htmlFor="emotion" field="emotion">Emotion</L>
            <Sel name="emotion" options={EMOTIONS} defaultValue={trade?.emotion ?? ""} />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <GL field="isFomo">Psychology</GL>
          <CheckField name="isFomo" label="FOMO (entered out of fear of missing)" field="isFomo" defaultChecked={trade?.isFomo} />
          <CheckField name="isRevenge" label="Revenge trade" field="isRevenge" defaultChecked={trade?.isRevenge} />
          <CheckField name="isImpulsive" label="Impulsive entry (no confirmation)" field="isImpulsive" defaultChecked={trade?.isImpulsive} />
        </div>
      </Section>

      {/* ── 6. Market Context ── */}
      <Section title="Market Context" collapsible defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <L htmlFor="timeframeEntry" field="timeframeEntry">TF Entry</L>
            <Sel name="timeframeEntry" options={TIMEFRAMES} defaultValue={trade?.timeframeEntry ?? ""} />
          </div>
          <div>
            <L htmlFor="timeframeTrend" field="timeframeTrend">TF Trend</L>
            <Sel name="timeframeTrend" options={TIMEFRAMES} defaultValue={trade?.timeframeTrend ?? ""} />
          </div>
        </div>
      </Section>

      {/* ── 7. Notes & Media ── */}
      <Section title="Notes & Media" collapsible defaultOpen={isEdit}>
        <div>
          <L htmlFor="preTradeNotes" field="preTradeNotes">Pre-Trade Notes</L>
          <textarea id="preTradeNotes" name="preTradeNotes" rows={2}
            placeholder="Setup rationale, market context, thesis…"
            defaultValue={trade?.preTradeNotes ?? ""}
            className={iCls} style={{ ...iStyle, resize: "none" }} />
        </div>
        <div>
          <L htmlFor="postTradeNotes" field="postTradeNotes">Post-Trade Notes</L>
          <textarea id="postTradeNotes" name="postTradeNotes" rows={3}
            placeholder="What went well, what to improve, lessons learned…"
            defaultValue={trade?.postTradeNotes ?? ""}
            className={iCls} style={{ ...iStyle, resize: "none" }} />
        </div>
        <div>
          <L htmlFor="mistakeNotes" field="mistakeNotes">Mistakes</L>
          <textarea id="mistakeNotes" name="mistakeNotes" rows={2}
            placeholder="Errors: early entry, tight SL, ignored setup rules…"
            defaultValue={trade?.mistakeNotes ?? ""}
            className={iCls} style={{ ...iStyle, resize: "none" }} />
        </div>
        <div>
          <L htmlFor="tags" field="tags">Tags</L>
          <input id="tags" name="tags" type="text"
            placeholder="clean_entry, fomo, missed_tp, early_exit…"
            defaultValue={trade?.tags?.join(", ") ?? ""}
            className={iCls} style={iStyle} />
        </div>
        <div>
          <p className={lCls} style={lStyle}>Screenshots</p>
          {isEdit ? (
            <MediaUpload
              tradeId={trade.id}
              type="journal"
              initialMedia={trade.media ?? []}
            />
          ) : savedTradeId ? (
            <MediaUpload tradeId={savedTradeId} type="journal" />
          ) : (
            <MediaUpload
              tradeId="temp"
              type="journal"
              initialMedia={tempMedia}
              onTempUploaded={handleTempUploaded}
            />
          )}
        </div>
      </Section>

      {error && (
        <p className="rounded-lg px-3 py-2 text-base" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171" }}>
          {error}
        </p>
      )}

      {/* After add: trade saved, uploader visible — show Done instead of re-submit */}
      {!isEdit && savedTradeId ? (
        <button
          type="button"
          onClick={() => onSuccess?.()}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-base font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
        >
          Done
        </button>
      ) : (
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl py-2.5 text-base font-semibold transition-all hover:bg-white/5"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-base font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              isEdit ? "Save Changes" : "Add Trade"
            )}
          </button>
        </div>
      )}
    </form>

    <SuccessToast
      open={toastOpen}
      message={toastMessage}
      description={isEdit ? "Les modifications ont été sauvegardées." : "Le trade a bien été ajouté au journal."}
      onClose={() => {
        setToastOpen(false);
        if (isEdit) onSuccess?.();
      }}
    />
    </>
  );
}
