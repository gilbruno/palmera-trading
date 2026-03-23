"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  name: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Combobox({ name, options, value, onChange, placeholder = "— Select —" }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isHoveringDropdown = useRef(false);

  const selected = options.find((o) => o.value === value);
  const isEmpty = !value;

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(options.length * 28 + 8, 220);
    const openAbove = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight + 8;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setHighlightedIndex(options.findIndex((o) => o.value === value));
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleSelect(optValue: string) {
    onChange(optValue);
    closeDropdown();
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) handleSelect(options[highlightedIndex].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeDropdown();
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || highlightedIndex < 0 || !dropdownRef.current) return;
    const el = dropdownRef.current.children[highlightedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  // Close on outside click or scroll
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      closeDropdown();
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      if (!isHoveringDropdown.current) closeDropdown();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, handleOutsideClick]);

  const dropdown =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            onMouseEnter={() => { isHoveringDropdown.current = true; }}
            onMouseLeave={() => { isHoveringDropdown.current = false; }}
            style={{
              ...dropdownStyle,
              backgroundColor: "var(--bg-sidebar)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              overflow: "hidden auto",
              maxHeight: 220,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              animation: "cbx-in 120ms ease",
            }}
          >
            <style>{`
              @keyframes cbx-in {
                from { opacity: 0; transform: translateY(-4px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div ref={dropdownRef} className="py-1">
              {options.map((o, i) => {
                const isSelected = o.value === value;
                const isHighlighted = i === highlightedIndex;
                const isPlaceholder = o.value === "";
                return (
                  <button
                    key={o.value}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(o.value); }}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-sm transition-colors"
                    style={{
                      backgroundColor: isHighlighted ? "rgba(255,255,255,0.05)" : "transparent",
                      color: isPlaceholder
                        ? "var(--text-muted)"
                        : isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      textAlign: "left",
                    }}
                  >
                    <span>{o.label}</span>
                    {isSelected && !isPlaceholder && (
                      <Check size={10} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => { e.preventDefault(); open ? closeDropdown() : openDropdown(); }}
        onKeyDown={handleKeyDown}
        className="block w-full px-2.5 py-2 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "var(--accent-primary)" : "var(--border)"}`,
          borderRadius: "0.5rem",
          color: isEmpty ? "var(--text-muted)" : "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          textAlign: "left",
          cursor: "pointer",
          userSelect: "none",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          {selected && selected.value !== "" ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={12}
          className="shrink-0 transition-transform duration-150"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {dropdown}
    </>
  );
}
