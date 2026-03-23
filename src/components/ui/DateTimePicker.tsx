"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar, Clock, X } from "lucide-react";
import gsap from "gsap";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface DateTimePickerProps {
  /** Input name for form submission */
  name: string;
  /** Controlled value — ISO datetime-local string "YYYY-MM-DDTHH:mm" */
  value?: string;
  /** Uncontrolled default value */
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  /** If true, shows only date picker (no time) */
  dateOnly?: boolean;
  disabled?: boolean;
}

/* ─── Constants ────────────────────────────────────────────────────────────── */

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDisplayString(iso: string, dateOnly: boolean) {
  if (!iso) return "";
  const [datePart, timePart] = iso.split("T");
  if (!datePart) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  const dateStr = `${pad(d)} ${MONTHS[m - 1]?.slice(0, 3) ?? ""} ${y}`;
  if (dateOnly || !timePart) return dateStr;
  return `${dateStr}  ${timePart.slice(0, 5)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns the weekday index (0=Mon … 6=Sun) of the first day of a month */
function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay(); // 0=Sun
  return (day + 6) % 7; // shift so Monday=0
}

function parseIso(iso: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  if (!iso) return null;
  const [datePart, timePart = "00:00"] = iso.split("T");
  const parts = datePart.split("-").map(Number);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  const [hour, minute] = timePart.split(":").map(Number);
  return { year, month: month - 1, day, hour: hour || 0, minute: minute || 0 };
}

function buildIso(year: number, month: number, day: number, hour: number, minute: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

interface NavButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}
function NavButton({ onClick, children, title }: NavButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => gsap.to(ref.current, { backgroundColor: "rgba(255,255,255,0.08)", duration: 0.15 })}
      onMouseLeave={() => gsap.to(ref.current, { backgroundColor: "rgba(255,255,255,0)", duration: 0.2 })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: "var(--text-secondary)",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

/* ─── Time wheel ───────────────────────────────────────────────────────────── */

interface TimeSegmentProps {
  value: number;
  max: number;
  label: string;
  onChange: (v: number) => void;
}

function TimeSegment({ value, max, label, onChange }: TimeSegmentProps) {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const inc = () => onChange((value + 1) % (max + 1));
  const dec = () => onChange((value - 1 + max + 1) % (max + 1));

  const btnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 18,
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 0,
    borderRadius: 4,
  };

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setDraft(raw);
  }

  function commitDraft(raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      onChange(Math.min(n, max));
    }
    setDraft(null);
  }

  function handleBlur() {
    commitDraft(draft ?? "");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab") {
      commitDraft(draft ?? "");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      inc();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      dec();
    }
  }

  function handleFocus() {
    setDraft(pad(value));
    setTimeout(() => inputRef.current?.select(), 0);
  }

  const displayValue = draft !== null ? draft : pad(value);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </span>
      <button
        ref={upRef}
        type="button"
        onClick={inc}
        style={btnStyle}
        onMouseEnter={() => gsap.to(upRef.current, { color: "var(--accent-primary)", duration: 0.15 })}
        onMouseLeave={() => gsap.to(upRef.current, { color: "var(--text-muted)", duration: 0.2 })}
      >
        <ChevronRight size={12} style={{ transform: "rotate(-90deg)" }} />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          width: 40,
          height: 34,
          textAlign: "center",
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          fontWeight: 600,
          fontSize: "1.25rem",
          letterSpacing: "0.04em",
          color: draft !== null ? "var(--accent-primary)" : "var(--text-primary)",
          backgroundColor: "rgba(255,255,255,0.04)",
          border: `1px solid ${draft !== null ? "var(--accent-primary)" : "var(--border)"}`,
          borderRadius: 6,
          outline: "none",
          cursor: "text",
          caretColor: "var(--accent-primary)",
          transition: "border-color 0.15s ease, color 0.15s ease",
        }}
      />
      <button
        ref={downRef}
        type="button"
        onClick={dec}
        style={btnStyle}
        onMouseEnter={() => gsap.to(downRef.current, { color: "var(--accent-primary)", duration: 0.15 })}
        onMouseLeave={() => gsap.to(downRef.current, { color: "var(--text-muted)", duration: 0.2 })}
      >
        <ChevronRight size={12} style={{ transform: "rotate(90deg)" }} />
      </button>
    </div>
  );
}

/* ─── Calendar grid ─────────────────────────────────────────────────────────── */

interface CalendarGridProps {
  viewYear: number;
  viewMonth: number;
  selectedYear: number | null;
  selectedMonth: number | null;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function CalendarGrid({
  viewYear, viewMonth,
  selectedYear, selectedMonth, selectedDay,
  onSelectDay, onPrevMonth, onNextMonth,
}: CalendarGridProps) {
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getFirstDayOffset(viewYear, viewMonth);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Month / Year nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <NavButton onClick={onPrevMonth} title="Previous month">
          <ChevronLeft size={14} />
        </NavButton>
        <span style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          fontWeight: 600,
          fontSize: "0.9rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
        }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <NavButton onClick={onNextMonth} title="Next month">
          <ChevronRight size={14} />
        </NavButton>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            textAlign: "center",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            paddingBottom: 4,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;

          const isSelected =
            selectedYear === viewYear &&
            selectedMonth === viewMonth &&
            selectedDay === day;

          const isToday =
            todayY === viewYear &&
            todayM === viewMonth &&
            todayD === day;

          const isWeekend = ((i % 7) === 5 || (i % 7) === 6);

          return (
            <DayCell
              key={day}
              day={day}
              isSelected={isSelected}
              isToday={isToday}
              isWeekend={isWeekend}
              onClick={() => onSelectDay(day)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Day cell ──────────────────────────────────────────────────────────────── */

interface DayCellProps {
  day: number;
  isSelected: boolean;
  isToday: boolean;
  isWeekend: boolean;
  onClick: () => void;
}

function DayCell({ day, isSelected, isToday, isWeekend, onClick }: DayCellProps) {
  const ref = useRef<HTMLButtonElement>(null);

  function handleEnter() {
    if (isSelected) return;
    gsap.to(ref.current, {
      backgroundColor: "rgba(255,214,0,0.1)",
      scale: 1.08,
      duration: 0.15,
      ease: "power2.out",
    });
  }

  function handleLeave() {
    if (isSelected) return;
    gsap.to(ref.current, {
      backgroundColor: "transparent",
      scale: 1,
      duration: 0.2,
      ease: "power3.out",
    });
  }

  function handleClick() {
    gsap.fromTo(ref.current,
      { scale: 0.85 },
      { scale: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" }
    );
    onClick();
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        width: "100%",
        aspectRatio: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.78rem",
        fontWeight: isSelected || isToday ? 700 : 400,
        fontFamily: isSelected ? "'Barlow Condensed', 'Arial Narrow', sans-serif" : "inherit",
        letterSpacing: isSelected ? "0.04em" : 0,
        borderRadius: 6,
        border: isToday && !isSelected
          ? "1px solid rgba(255,214,0,0.35)"
          : "1px solid transparent",
        background: isSelected
          ? "linear-gradient(135deg, #FFD600 0%, #FFA500 100%)"
          : "transparent",
        color: isSelected
          ? "#1a1710"
          : isToday
          ? "var(--accent-primary)"
          : isWeekend
          ? "var(--text-muted)"
          : "var(--text-secondary)",
        cursor: "pointer",
        padding: 0,
        transition: "border-color 0.15s ease",
        boxShadow: isSelected
          ? "0 2px 12px -2px rgba(255,214,0,0.4)"
          : "none",
      }}
    >
      {day}
    </button>
  );
}

/* ─── Popup panel ───────────────────────────────────────────────────────────── */

interface PopupProps {
  style: React.CSSProperties;
  popupRef: React.RefObject<HTMLDivElement | null>;
  viewYear: number;
  viewMonth: number;
  selectedYear: number | null;
  selectedMonth: number | null;
  selectedDay: number | null;
  hour: number;
  minute: number;
  dateOnly: boolean;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  onClear: () => void;
  onClose: () => void;
}

function Popup({
  style, popupRef, viewYear, viewMonth, selectedYear, selectedMonth, selectedDay,
  hour, minute, dateOnly, onSelectDay, onPrevMonth, onNextMonth,
  onHourChange, onMinuteChange, onClear, onClose,
}: PopupProps) {
  useEffect(() => {
    if (!popupRef.current) return;
    gsap.fromTo(
      popupRef.current,
      { opacity: 0, y: -8, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power3.out" }
    );
  }, [popupRef]);

  return createPortal(
    <div
      ref={popupRef}
      style={{
        ...style,
        position: "fixed",
        zIndex: 9999,
        backgroundColor: "var(--bg-sidebar)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 16px 48px -8px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,214,0,0.08)",
        padding: "14px 14px 10px",
        minWidth: 260,
        opacity: 0,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Subtle top accent line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "20%",
        right: "20%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,214,0,0.4), transparent)",
        borderRadius: "0 0 4px 4px",
      }} />

      <CalendarGrid
        viewYear={viewYear}
        viewMonth={viewMonth}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />

      {!dateOnly && (
        <>
          {/* Divider */}
          <div style={{
            margin: "10px 0 10px",
            height: 1,
            background: "linear-gradient(90deg, transparent, var(--border), transparent)",
          }} />

          {/* Time row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Clock size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TimeSegment value={hour} max={23} label="HH" onChange={onHourChange} />
              <span style={{
                fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
                fontWeight: 700,
                fontSize: "1.2rem",
                color: "var(--text-muted)",
                paddingBottom: 2,
              }}>:</span>
              <TimeSegment value={minute} max={59} label="MM" onChange={onMinuteChange} />
            </div>
          </div>
        </>
      )}

      {/* Footer actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <button
          type="button"
          onClick={onClear}
          style={{
            fontSize: "0.65rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: 4,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.65rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            background: "transparent",
            border: "1px solid rgba(255,214,0,0.25)",
            cursor: "pointer",
            padding: "3px 10px",
            borderRadius: 4,
            transition: "background 0.15s ease, border-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,214,0,0.1)";
            e.currentTarget.style.borderColor = "rgba(255,214,0,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(255,214,0,0.25)";
          }}
        >
          <X size={9} /> Done
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function DateTimePicker({
  name,
  value: controlledValue,
  defaultValue = "",
  onChange,
  placeholder,
  required,
  id: externalId,
  dateOnly = false,
  disabled = false,
}: DateTimePickerProps) {
  const internalId = useId();
  const inputId = externalId ?? internalId;

  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const isFocusedRef = useRef(false);

  // Derive state from current value
  const parsed = parseIso(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());
  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);

  const selectedYear = parsed?.year ?? null;
  const selectedMonth = parsed?.month ?? null;
  const selectedDay = parsed?.day ?? null;

  function commit(year: number, month: number, day: number, h: number, m: number) {
    const iso = buildIso(year, month, day, h, m);
    if (!isControlled) setInternalValue(iso);
    onChange?.(iso);
  }

  function openCalendar() {
    if (disabled) return;
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const panelHeight = dateOnly ? 230 : 310;
    const openAbove = spaceBelow < panelHeight + 8 && rect.top > panelHeight + 8;

    setPopupStyle({
      left: Math.min(rect.left, window.innerWidth - 270),
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });

    // Sync view to current value
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setHour(parsed.hour);
      setMinute(parsed.minute);
    }

    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function handleSelectDay(day: number) {
    const h = dateOnly ? 0 : hour;
    const m = dateOnly ? 0 : minute;
    commit(viewYear, viewMonth, day, h, m);
    if (dateOnly) close();
  }

  function handleHourChange(h: number) {
    setHour(h);
    if (selectedDay !== null && selectedYear !== null && selectedMonth !== null) {
      commit(selectedYear, selectedMonth, selectedDay, h, minute);
    }
  }

  function handleMinuteChange(m: number) {
    setMinute(m);
    if (selectedDay !== null && selectedYear !== null && selectedMonth !== null) {
      commit(selectedYear, selectedMonth, selectedDay, hour, m);
    }
  }

  function handleClear() {
    if (!isControlled) setInternalValue("");
    onChange?.("");
    close();
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  // Close on outside click — must not fire when clicking inside the portal popup
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (triggerRef.current?.contains(e.target as Node)) return;
    if (popupRef.current?.contains(e.target as Node)) return;
    close();
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [open, handleOutsideClick]);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Trigger button hover animation
  function handleTriggerEnter() {
    if (disabled) return;
    gsap.to(triggerRef.current, {
      borderColor: open ? "var(--accent-primary)" : "var(--text-muted)",
      duration: 0.18,
    });
  }

  function handleTriggerLeave() {
    if (open) return;
    gsap.to(triggerRef.current, {
      borderColor: "var(--border)",
      duration: 0.22,
    });
  }

  const displayPlaceholder = placeholder ?? (dateOnly ? "Select date" : "Select date & time");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&display=swap');
        .dtp-trigger:focus-visible {
          outline: 2px solid var(--accent-primary);
          outline-offset: 2px;
        }
      `}</style>

      {/* Hidden native input for form compatibility */}
      <input type="hidden" name={name} value={value} required={required} />

      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        className="dtp-trigger block w-full"
        disabled={disabled}
        onClick={() => open ? close() : openCalendar()}
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => { isFocusedRef.current = false; }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.5rem 0.625rem",
          backgroundColor: "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "var(--accent-primary)" : "var(--border)"}`,
          borderRadius: "0.5rem",
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          fontSize: "0.875rem",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
          textAlign: "left",
          userSelect: "none",
          transition: "border-color 0.15s ease, opacity 0.15s ease",
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? toDisplayString(value, dateOnly) : displayPlaceholder}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {!dateOnly && value && (
            <span style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
              fontWeight: 600,
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              color: "var(--accent-primary)",
              opacity: 0.8,
            }}>
              {value.split("T")[1]?.slice(0, 5)}
            </span>
          )}
          <Calendar
            size={12}
            style={{ color: open ? "var(--accent-primary)" : "var(--text-muted)", transition: "color 0.15s ease" }}
          />
        </span>
      </button>

      {/* Calendar popup */}
      {open && typeof document !== "undefined" && (
        <Popup
          style={popupStyle}
          popupRef={popupRef}
          viewYear={viewYear}
          viewMonth={viewMonth}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          hour={hour}
          minute={minute}
          dateOnly={dateOnly}
          onSelectDay={handleSelectDay}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onHourChange={handleHourChange}
          onMinuteChange={handleMinuteChange}
          onClear={handleClear}
          onClose={close}
        />
      )}
    </>
  );
}
