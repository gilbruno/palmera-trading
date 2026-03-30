"use client";

import { useState } from "react";
import { Square, TrendingUp, RefreshCw } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type ConceptKey = "order-block" | "fvg" | "breaker-block";

interface Badge {
  label: string;
  color: string;
  bg: string;
  border: string;
}

interface Section {
  label: string;
  content: string;
}

interface ValidationRule {
  number: number;
  title: string;
  description: string;
  detail: string;
  accentColor: string;
  diagram: React.ReactNode;
}

interface Concept {
  key: ConceptKey;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  badges: Badge[];
  definition: string;
  identification: string;
  rules: string[];
  application: string;
  sections: Section[];
  validationRules?: ValidationRule[];
  featuredVideo?: {
    youtubeId: string;
    title: string;
    description: string;
  };
}

/* ─── SVG Diagrams ──────────────────────────────────────────────────────── */

/** Diagram 1 — Kill Zone: price forms an OB inside a highlighted KZ window */
const DiagramKillZone = () => (
  <svg viewBox="0 0 280 140" xmlns="http://www.w3.org/2000/svg" className="w-full">
    {/* Background */}
    <rect width="280" height="140" fill="#1a1710" rx="8" />

    {/* Kill Zone highlight band */}
    <rect x="90" y="0" width="100" height="140" fill="rgba(255,214,0,0.07)" />
    <line x1="90" y1="0" x2="90" y2="140" stroke="#FFD600" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
    <line x1="190" y1="0" x2="190" y2="140" stroke="#FFD600" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
    <text x="140" y="12" textAnchor="middle" fill="#FFD600" fontSize="8" fontFamily="monospace" opacity="0.9">KILL ZONE</text>

    {/* Price candles — outside KZ (left) */}
    <rect x="20" y="55" width="8" height="30" fill="#ef4444" rx="1" />
    <line x1="24" y1="50" x2="24" y2="90" stroke="#ef4444" strokeWidth="1" />
    <rect x="36" y="60" width="8" height="20" fill="#00C896" rx="1" />
    <line x1="40" y1="55" x2="40" y2="85" stroke="#00C896" strokeWidth="1" />
    <rect x="52" y="58" width="8" height="25" fill="#ef4444" rx="1" />
    <line x1="56" y1="53" x2="56" y2="88" stroke="#ef4444" strokeWidth="1" />
    <rect x="68" y="62" width="8" height="18" fill="#00C896" rx="1" />
    <line x1="72" y1="57" x2="72" y2="85" stroke="#00C896" strokeWidth="1" />

    {/* OB candle — inside KZ, bearish (last red before impulse) */}
    <rect x="104" y="58" width="12" height="28" fill="#ef4444" rx="1.5" />
    <line x1="110" y1="52" x2="110" y2="90" stroke="#ef4444" strokeWidth="1.5" />
    {/* OB zone box */}
    <rect x="100" y="56" width="90" height="33" fill="rgba(255,214,0,0.08)" stroke="#FFD600" strokeWidth="1" strokeDasharray="3,2" rx="3" />
    <text x="192" y="66" fill="#FFD600" fontSize="7" fontFamily="monospace">OB zone</text>

    {/* Impulse candles — inside KZ */}
    <rect x="122" y="42" width="12" height="35" fill="#00C896" rx="1.5" />
    <line x1="128" y1="36" x2="128" y2="82" stroke="#00C896" strokeWidth="1.5" />
    <rect x="140" y="28" width="12" height="40" fill="#00C896" rx="1.5" />
    <line x1="146" y1="22" x2="146" y2="72" stroke="#00C896" strokeWidth="1.5" />
    <rect x="158" y="18" width="12" height="38" fill="#00C896" rx="1.5" />
    <line x1="164" y1="12" x2="164" y2="60" stroke="#00C896" strokeWidth="1.5" />

    {/* Arrow showing impulse direction */}
    <path d="M175,40 L210,20" stroke="#00C896" strokeWidth="1.5" markerEnd="url(#arr)" opacity="0.7" />
    <defs>
      <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#00C896" />
      </marker>
    </defs>

    {/* Labels */}
    <text x="108" y="104" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontFamily="monospace">Last red candle</text>
    <text x="108" y="113" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontFamily="monospace">= Bullish OB</text>
    <text x="20" y="128" fill="#a89d7a" fontSize="7" fontFamily="monospace">Outside KZ → ignore</text>
    <text x="95" y="128" fill="#FFD600" fontSize="7" fontFamily="monospace">Inside KZ → valid</text>
  </svg>
);

/** Diagram 2 — SSL sweep: bullish OB valid only after an SSL is taken */
const DiagramSSL = () => (
  <svg viewBox="0 0 280 150" xmlns="http://www.w3.org/2000/svg" className="w-full">
    <rect width="280" height="150" fill="#1a1710" rx="8" />

    {/* SSL level */}
    <line x1="10" y1="100" x2="220" y2="100" stroke="#ef4444" strokeWidth="1" strokeDasharray="5,3" opacity="0.7" />
    <text x="222" y="103" fill="#ef4444" fontSize="8" fontFamily="monospace">SSL</text>
    <text x="222" y="112" fill="#ef4444" fontSize="7" fontFamily="monospace">(Buy Stops)</text>

    {/* Candles before sweep */}
    <rect x="20" y="72" width="9" height="22" fill="#00C896" rx="1" />
    <line x1="24.5" y1="68" x2="24.5" y2="98" stroke="#00C896" strokeWidth="1" />
    <rect x="36" y="75" width="9" height="19" fill="#ef4444" rx="1" />
    <line x1="40.5" y1="71" x2="40.5" y2="99" stroke="#ef4444" strokeWidth="1" />
    <rect x="52" y="74" width="9" height="21" fill="#00C896" rx="1" />
    <line x1="56.5" y1="70" x2="56.5" y2="101" stroke="#00C896" strokeWidth="1" />

    {/* Wick sweeping below SSL */}
    <rect x="72" y="80" width="9" height="18" fill="#ef4444" rx="1" />
    <line x1="76.5" y1="73" x2="76.5" y2="115" stroke="#ef4444" strokeWidth="1.5" />
    {/* SSL sweep arrow */}
    <path d="M76.5,110 L76.5,120" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrRed)" />
    <defs>
      <marker id="arrRed" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
      </marker>
    </defs>
    <text x="76.5" y="133" textAnchor="middle" fill="#ef4444" fontSize="7" fontFamily="monospace">Sweep!</text>

    {/* OB candle (last red before impulse, after sweep) */}
    <rect x="95" y="75" width="10" height="25" fill="#ef4444" rx="1.5" />
    <line x1="100" y1="70" x2="100" y2="103" stroke="#ef4444" strokeWidth="1.5" />
    {/* OB box */}
    <rect x="91" y="73" width="75" height="32" fill="rgba(255,214,0,0.09)" stroke="#FFD600" strokeWidth="1" strokeDasharray="3,2" rx="3" />
    <text x="130" y="118" textAnchor="middle" fill="#FFD600" fontSize="7.5" fontFamily="monospace">Bullish OB</text>
    <text x="130" y="127" textAnchor="middle" fill="#FFD600" fontSize="7" fontFamily="monospace">(validated by SSL sweep)</text>

    {/* Impulse up */}
    <rect x="112" y="52" width="10" height="35" fill="#00C896" rx="1.5" />
    <line x1="117" y1="44" x2="117" y2="90" stroke="#00C896" strokeWidth="1.5" />
    <rect x="130" y="38" width="10" height="42" fill="#00C896" rx="1.5" />
    <line x1="135" y1="30" x2="135" y2="83" stroke="#00C896" strokeWidth="1.5" />
    <rect x="148" y="25" width="10" height="46" fill="#00C896" rx="1.5" />
    <line x1="153" y1="17" x2="153" y2="74" stroke="#00C896" strokeWidth="1.5" />

    {/* Annotations */}
    <text x="20" y="143" fill="#a89d7a" fontSize="7" fontFamily="monospace">No SSL sweep → OB not valid</text>
    <text x="6" y="12" fill="#a89d7a" fontSize="7.5" fontFamily="monospace">Bullish OB requires prior SSL sweep (sell-side liquidity taken)</text>
  </svg>
);

/** Diagram 3 — Displacement close: the impulse candle must close beyond the OB */
const DiagramDisplacement = () => (
  <svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" className="w-full">
    <rect width="280" height="160" fill="#1a1710" rx="8" />

    {/* ── LEFT: INVALID (no close beyond) ── */}
    <text x="60" y="14" textAnchor="middle" fill="#ef4444" fontSize="8" fontFamily="monospace">✗ INVALID</text>
    {/* OB */}
    <rect x="22" y="72" width="11" height="28" fill="#ef4444" rx="1.5" />
    <line x1="27.5" y1="66" x2="27.5" y2="104" stroke="#ef4444" strokeWidth="1.5" />
    {/* OB box top line */}
    <line x1="18" y1="72" x2="100" y2="72" stroke="#FFD600" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.6" />
    <text x="10" y="70" fill="#FFD600" fontSize="6.5" fontFamily="monospace">OB high</text>

    {/* Impulse candle — close does NOT exceed OB high */}
    <rect x="42" y="65" width="11" height="32" fill="#00C896" rx="1.5" />
    <line x1="47.5" y1="59" x2="47.5" y2="100" stroke="#00C896" strokeWidth="1.5" />
    {/* Close marker — still below OB high */}
    <line x1="38" y1="65" x2="58" y2="65" stroke="#00C896" strokeWidth="1" opacity="0.6" />
    <text x="60" y="64" fill="#00C896" fontSize="6.5" fontFamily="monospace">close</text>
    {/* Arrow showing close is below OB zone top */}
    <path d="M47.5,65 L47.5,76" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrR2)" opacity="0.8" />
    <defs>
      <marker id="arrR2" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#ef4444" />
      </marker>
    </defs>
    <text x="60" y="110" textAnchor="middle" fill="#ef4444" fontSize="7" fontFamily="monospace">Close inside OB</text>
    <text x="60" y="119" textAnchor="middle" fill="#ef4444" fontSize="7" fontFamily="monospace">→ not valid</text>

    {/* Divider */}
    <line x1="120" y1="10" x2="120" y2="150" stroke="#2e2a1a" strokeWidth="1" />

    {/* ── RIGHT: VALID (close beyond) ── */}
    <text x="200" y="14" textAnchor="middle" fill="#00C896" fontSize="8" fontFamily="monospace">✓ VALID</text>
    {/* OB */}
    <rect x="135" y="80" width="11" height="28" fill="#ef4444" rx="1.5" />
    <line x1="140.5" y1="74" x2="140.5" y2="112" stroke="#ef4444" strokeWidth="1.5" />
    {/* OB box top line */}
    <line x1="130" y1="80" x2="260" y2="80" stroke="#FFD600" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.6" />
    <text x="122" y="78" fill="#FFD600" fontSize="6.5" fontFamily="monospace">OB high</text>

    {/* Impulse candle — close ABOVE OB high */}
    <rect x="155" y="55" width="11" height="42" fill="#00C896" rx="1.5" />
    <line x1="160.5" y1="47" x2="160.5" y2="100" stroke="#00C896" strokeWidth="1.5" />
    {/* Close marker — above OB high */}
    <line x1="150" y1="55" x2="172" y2="55" stroke="#00C896" strokeWidth="1" opacity="0.9" />
    <text x="174" y="57" fill="#00C896" fontSize="6.5" fontFamily="monospace">close ↑</text>
    {/* Green fill zone above OB high to close */}
    <rect x="150" y="55" width="25" height="25" fill="rgba(0,200,150,0.12)" rx="2" />

    {/* Second impulse candle */}
    <rect x="174" y="38" width="11" height="40" fill="#00C896" rx="1.5" />
    <line x1="179.5" y1="30" x2="179.5" y2="82" stroke="#00C896" strokeWidth="1.5" />

    <text x="200" y="110" textAnchor="middle" fill="#00C896" fontSize="7" fontFamily="monospace">Close above OB high</text>
    <text x="200" y="119" textAnchor="middle" fill="#00C896" fontSize="7" fontFamily="monospace">→ displacement confirmed</text>

    <text x="140" y="145" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">Bullish OB: impulse candle must close above OB high</text>
    <text x="140" y="155" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">Bearish OB: impulse candle must close below OB low</text>
  </svg>
);

/* ─── FVG SVG Diagrams ──────────────────────────────────────────────────── */

/** FVG Diagram 1 — Kill Zone: FVG forms inside highlighted KZ window */
const DiagramFvgKillZone = () => (
  <svg viewBox="0 0 280 145" xmlns="http://www.w3.org/2000/svg" className="w-full">
    <rect width="280" height="145" fill="#1a1710" rx="8" />

    {/* Kill Zone band */}
    <rect x="95" y="0" width="105" height="145" fill="rgba(0,200,150,0.06)" />
    <line x1="95" y1="0" x2="95" y2="145" stroke="#00C896" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
    <line x1="200" y1="0" x2="200" y2="145" stroke="#00C896" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
    <text x="147" y="12" textAnchor="middle" fill="#00C896" fontSize="8" fontFamily="monospace" opacity="0.9">KILL ZONE</text>

    {/* Candles outside KZ (left) — no FVG */}
    <rect x="16" y="62" width="9" height="22" fill="#ef4444" rx="1" />
    <line x1="20.5" y1="57" x2="20.5" y2="88" stroke="#ef4444" strokeWidth="1" />
    <rect x="32" y="65" width="9" height="18" fill="#00C896" rx="1" />
    <line x1="36.5" y1="61" x2="36.5" y2="87" stroke="#00C896" strokeWidth="1" />
    <rect x="48" y="63" width="9" height="20" fill="#ef4444" rx="1" />
    <line x1="52.5" y1="59" x2="52.5" y2="87" stroke="#ef4444" strokeWidth="1" />
    <rect x="64" y="64" width="9" height="19" fill="#00C896" rx="1" />
    <line x1="68.5" y1="60" x2="68.5" y2="87" stroke="#00C896" strokeWidth="1" />
    <text x="44" y="118" textAnchor="middle" fill="#5a5238" fontSize="7" fontFamily="monospace">Outside KZ</text>
    <text x="44" y="127" textAnchor="middle" fill="#5a5238" fontSize="7" fontFamily="monospace">→ ignore FVG</text>

    {/* 3-candle FVG pattern inside KZ */}
    {/* Candle 1 */}
    <rect x="110" y="68" width="10" height="20" fill="#ef4444" rx="1.5" />
    <line x1="115" y1="63" x2="115" y2="91" stroke="#ef4444" strokeWidth="1.5" />
    {/* Candle 2 — strong bullish impulse */}
    <rect x="128" y="42" width="10" height="38" fill="#00C896" rx="1.5" />
    <line x1="133" y1="35" x2="133" y2="83" stroke="#00C896" strokeWidth="1.5" />
    {/* Candle 3 */}
    <rect x="146" y="38" width="10" height="22" fill="#00C896" rx="1.5" />
    <line x1="151" y1="33" x2="151" y2="63" stroke="#00C896" strokeWidth="1.5" />

    {/* FVG gap: between high of C1 (68) and low of C3 (60) — actually high of C1 = 63, low of C3 = 60 */}
    {/* Let's define: C1 high = 63, C3 low = 60 → gap 60–63 */}
    <rect x="105" y="60" width="60" height="8" fill="rgba(0,200,150,0.18)" stroke="#00C896" strokeWidth="1" strokeDasharray="3,2" rx="2" />
    <text x="168" y="63" fill="#00C896" fontSize="7" fontFamily="monospace">FVG</text>
    <text x="168" y="71" fill="#00C896" fontSize="7" fontFamily="monospace">gap</text>

    {/* Labels C1, C2, C3 */}
    <text x="115" y="100" textAnchor="middle" fill="#a89d7a" fontSize="7" fontFamily="monospace">C1</text>
    <text x="133" y="100" textAnchor="middle" fill="#a89d7a" fontSize="7" fontFamily="monospace">C2</text>
    <text x="151" y="100" textAnchor="middle" fill="#a89d7a" fontSize="7" fontFamily="monospace">C3</text>

    {/* Continuation candles */}
    <rect x="164" y="28" width="10" height="32" fill="#00C896" rx="1.5" />
    <line x1="169" y1="21" x2="169" y2="63" stroke="#00C896" strokeWidth="1.5" />

    <text x="147" y="118" textAnchor="middle" fill="#00C896" fontSize="7" fontFamily="monospace">FVG inside KZ → valid</text>
    <text x="147" y="128" textAnchor="middle" fill="#00C896" fontSize="7" fontFamily="monospace">Bullish FVG shown here</text>

    {/* Session labels */}
    <text x="95" y="140" fill="#00C896" fontSize="6.5" fontFamily="monospace" opacity="0.7">London / NY Open</text>
  </svg>
);

/** FVG Diagram 2 — Premium/Discount: FVG must sit in correct half of the range */
const DiagramFvgPremiumDiscount = () => (
  <svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" className="w-full">
    <rect width="280" height="160" fill="#1a1710" rx="8" />

    {/* ── LEFT panel: Bullish FVG in Discount ── */}
    <text x="62" y="13" textAnchor="middle" fill="#a89d7a" fontSize="8" fontFamily="monospace">Bullish FVG</text>

    {/* Range bracket left */}
    {/* High of range */}
    <line x1="10" y1="22" x2="110" y2="22" stroke="#5a5238" strokeWidth="0.8" strokeDasharray="3,2" />
    <text x="6" y="21" fill="#5a5238" fontSize="6.5" fontFamily="monospace">H</text>
    {/* Low of range */}
    <line x1="10" y1="130" x2="110" y2="130" stroke="#5a5238" strokeWidth="0.8" strokeDasharray="3,2" />
    <text x="6" y="133" fill="#5a5238" fontSize="6.5" fontFamily="monospace">L</text>
    {/* 50% equilibrium */}
    <line x1="10" y1="76" x2="110" y2="76" stroke="#a89d7a" strokeWidth="1" strokeDasharray="4,2" opacity="0.6" />
    <text x="112" y="79" fill="#a89d7a" fontSize="7" fontFamily="monospace">50%</text>

    {/* Premium zone (above 50%) */}
    <rect x="10" y="22" width="95" height="54" fill="rgba(239,68,68,0.06)" rx="0" />
    <text x="57" y="36" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontFamily="monospace" opacity="0.8">PREMIUM</text>
    <text x="57" y="46" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontFamily="monospace" opacity="0.6">(sell zone)</text>

    {/* Discount zone (below 50%) */}
    <rect x="10" y="76" width="95" height="54" fill="rgba(0,200,150,0.06)" rx="0" />
    <text x="57" y="97" textAnchor="middle" fill="#00C896" fontSize="7.5" fontFamily="monospace" opacity="0.8">DISCOUNT</text>
    <text x="57" y="107" textAnchor="middle" fill="#00C896" fontSize="6.5" fontFamily="monospace" opacity="0.6">(buy zone)</text>

    {/* Bullish FVG in discount zone */}
    <rect x="28" y="92" width="52" height="14" fill="rgba(0,200,150,0.2)" stroke="#00C896" strokeWidth="1.2" rx="2" />
    <text x="54" y="118" textAnchor="middle" fill="#00C896" fontSize="7" fontFamily="monospace">Bullish FVG ✓</text>
    <text x="54" y="127" textAnchor="middle" fill="#00C896" fontSize="6.5" fontFamily="monospace">in discount → valid</text>

    {/* ✗ Bullish FVG in premium (invalid) */}
    <rect x="28" y="30" width="52" height="14" fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" rx="2" />
    <text x="54" y="52" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontFamily="monospace">Bullish FVG ✗</text>
    <text x="54" y="60" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontFamily="monospace">in premium → skip</text>

    {/* Divider */}
    <line x1="138" y1="10" x2="138" y2="150" stroke="#2e2a1a" strokeWidth="1" />

    {/* ── RIGHT panel: Bearish FVG in Premium ── */}
    <text x="208" y="13" textAnchor="middle" fill="#a89d7a" fontSize="8" fontFamily="monospace">Bearish FVG</text>

    {/* Range bracket right */}
    <line x1="148" y1="22" x2="270" y2="22" stroke="#5a5238" strokeWidth="0.8" strokeDasharray="3,2" />
    <text x="144" y="21" fill="#5a5238" fontSize="6.5" fontFamily="monospace">H</text>
    <line x1="148" y1="130" x2="270" y2="130" stroke="#5a5238" strokeWidth="0.8" strokeDasharray="3,2" />
    <text x="144" y="133" fill="#5a5238" fontSize="6.5" fontFamily="monospace">L</text>
    <line x1="148" y1="76" x2="270" y2="76" stroke="#a89d7a" strokeWidth="1" strokeDasharray="4,2" opacity="0.6" />
    <text x="272" y="79" fill="#a89d7a" fontSize="7" fontFamily="monospace">50%</text>

    {/* Premium zone */}
    <rect x="148" y="22" width="116" height="54" fill="rgba(239,68,68,0.06)" rx="0" />
    <text x="206" y="36" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontFamily="monospace" opacity="0.8">PREMIUM</text>
    <text x="206" y="46" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontFamily="monospace" opacity="0.6">(sell zone)</text>

    {/* Discount zone */}
    <rect x="148" y="76" width="116" height="54" fill="rgba(0,200,150,0.06)" rx="0" />
    <text x="206" y="97" textAnchor="middle" fill="#00C896" fontSize="7.5" fontFamily="monospace" opacity="0.8">DISCOUNT</text>
    <text x="206" y="107" textAnchor="middle" fill="#00C896" fontSize="6.5" fontFamily="monospace" opacity="0.6">(buy zone)</text>

    {/* Bearish FVG in premium (valid) */}
    <rect x="168" y="30" width="76" height="14" fill="rgba(255,140,0,0.18)" stroke="#FF8C00" strokeWidth="1.2" rx="2" />
    <text x="206" y="52" textAnchor="middle" fill="#FF8C00" fontSize="7" fontFamily="monospace">Bearish FVG ✓</text>
    <text x="206" y="60" textAnchor="middle" fill="#FF8C00" fontSize="6.5" fontFamily="monospace">in premium → valid</text>

    {/* ✗ Bearish FVG in discount (invalid) */}
    <rect x="168" y="92" width="76" height="14" fill="rgba(239,68,68,0.10)" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" rx="2" />
    <text x="206" y="118" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontFamily="monospace">Bearish FVG ✗</text>
    <text x="206" y="127" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontFamily="monospace">in discount → skip</text>

    {/* Bottom note */}
    <text x="140" y="150" textAnchor="middle" fill="#5a5238" fontSize="6.5" fontFamily="monospace">Range = swing high to swing low of the relevant dealing range</text>
  </svg>
);

/** FVG Diagram 3 — Anatomy: 3-candle structure + gap zone + 50% OTE */
const DiagramFvgAnatomy = () => (
  <svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" className="w-full">
    <rect width="280" height="160" fill="#1a1710" rx="8" />

    {/* ── LEFT: Bullish FVG anatomy ── */}
    <text x="70" y="13" textAnchor="middle" fill="#00C896" fontSize="8" fontFamily="monospace">Bullish FVG</text>

    {/* Candle 1 — bearish or small bullish */}
    <rect x="18" y="88" width="12" height="24" fill="#ef4444" rx="1.5" />
    <line x1="24" y1="82" x2="24" y2="116" stroke="#ef4444" strokeWidth="1.5" />
    {/* C1 high marker */}
    <line x1="14" y1="82" x2="36" y2="82" stroke="#a89d7a" strokeWidth="0.7" strokeDasharray="2,2" />
    <text x="6" y="81" fill="#a89d7a" fontSize="6" fontFamily="monospace">C1</text>
    <text x="6" y="89" fill="#a89d7a" fontSize="6" fontFamily="monospace">hi</text>

    {/* Candle 2 — strong bullish */}
    <rect x="42" y="54" width="14" height="48" fill="#00C896" rx="1.5" />
    <line x1="49" y1="44" x2="49" y2="105" stroke="#00C896" strokeWidth="1.5" />

    {/* Candle 3 — bullish, opens above C1 high */}
    <rect x="68" y="48" width="12" height="26" fill="#00C896" rx="1.5" />
    <line x1="74" y1="42" x2="74" y2="76" stroke="#00C896" strokeWidth="1.5" />
    {/* C3 low marker */}
    <line x1="62" y1="74" x2="88" y2="74" stroke="#a89d7a" strokeWidth="0.7" strokeDasharray="2,2" />
    <text x="88" y="73" fill="#a89d7a" fontSize="6" fontFamily="monospace">C3 lo</text>

    {/* FVG zone: between C1 high (82) and C3 low (74) */}
    <rect x="14" y="74" width="78" height="8" fill="rgba(0,200,150,0.22)" stroke="#00C896" strokeWidth="1.2" rx="2" />

    {/* 50% OTE line inside FVG */}
    <line x1="14" y1="78" x2="92" y2="78" stroke="#FFD600" strokeWidth="1.2" strokeDasharray="3,2" />
    <text x="93" y="81" fill="#FFD600" fontSize="6.5" fontFamily="monospace">50% OTE</text>

    {/* Arrow: price returns to fill */}
    <path d="M49,45 C49,30 90,30 90,78" stroke="#00C896" strokeWidth="1" fill="none" strokeDasharray="3,2" opacity="0.6" markerEnd="url(#arrG)" />
    <defs>
      <marker id="arrG" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#00C896" />
      </marker>
    </defs>

    {/* Labels */}
    <text x="24" y="128" textAnchor="middle" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">C1</text>
    <text x="49" y="128" textAnchor="middle" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">C2</text>
    <text x="74" y="128" textAnchor="middle" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">C3</text>
    <text x="49" y="142" textAnchor="middle" fill="#00C896" fontSize="7" fontFamily="monospace">Gap = C1.high → C3.low</text>
    <text x="49" y="152" textAnchor="middle" fill="#FFD600" fontSize="6.5" fontFamily="monospace">Enter at 50% (OTE)</text>

    {/* Divider */}
    <line x1="138" y1="10" x2="138" y2="155" stroke="#2e2a1a" strokeWidth="1" />

    {/* ── RIGHT: Bearish FVG anatomy ── */}
    <text x="208" y="13" textAnchor="middle" fill="#FF8C00" fontSize="8" fontFamily="monospace">Bearish FVG</text>

    {/* Candle 1 — bullish */}
    <rect x="150" y="55" width="12" height="24" fill="#00C896" rx="1.5" />
    <line x1="156" y1="50" x2="156" y2="82" stroke="#00C896" strokeWidth="1.5" />
    {/* C1 low marker */}
    <line x1="146" y1="79" x2="168" y2="79" stroke="#a89d7a" strokeWidth="0.7" strokeDasharray="2,2" />
    <text x="142" y="78" fill="#a89d7a" fontSize="6" fontFamily="monospace">C1</text>
    <text x="142" y="86" fill="#a89d7a" fontSize="6" fontFamily="monospace">lo</text>

    {/* Candle 2 — strong bearish */}
    <rect x="174" y="60" width="14" height="50" fill="#ef4444" rx="1.5" />
    <line x1="181" y1="52" x2="181" y2="114" stroke="#ef4444" strokeWidth="1.5" />

    {/* Candle 3 — bearish, low below C1 low */}
    <rect x="200" y="82" width="12" height="26" fill="#ef4444" rx="1.5" />
    <line x1="206" y1="76" x2="206" y2="112" stroke="#ef4444" strokeWidth="1.5" />
    {/* C3 high marker */}
    <line x1="196" y1="76" x2="222" y2="76" stroke="#a89d7a" strokeWidth="0.7" strokeDasharray="2,2" />
    <text x="222" y="75" fill="#a89d7a" fontSize="6" fontFamily="monospace">C3 hi</text>

    {/* FVG zone: between C3 high (76) and C1 low (79) */}
    <rect x="146" y="76" width="80" height="3" fill="rgba(255,140,0,0.22)" stroke="#FF8C00" strokeWidth="1.2" rx="1" />
    {/* Wider for readability */}
    <rect x="146" y="74" width="80" height="8" fill="rgba(255,140,0,0.18)" stroke="#FF8C00" strokeWidth="1.2" rx="2" />

    {/* 50% OTE */}
    <line x1="146" y1="78" x2="226" y2="78" stroke="#FFD600" strokeWidth="1.2" strokeDasharray="3,2" />
    <text x="227" y="81" fill="#FFD600" fontSize="6.5" fontFamily="monospace">50% OTE</text>

    {/* Arrow: price returns to fill */}
    <path d="M181,113 C181,130 225,130 225,78" stroke="#FF8C00" strokeWidth="1" fill="none" strokeDasharray="3,2" opacity="0.6" markerEnd="url(#arrO)" />
    <defs>
      <marker id="arrO" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#FF8C00" />
      </marker>
    </defs>

    {/* Labels */}
    <text x="156" y="128" textAnchor="middle" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">C1</text>
    <text x="181" y="128" textAnchor="middle" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">C2</text>
    <text x="206" y="128" textAnchor="middle" fill="#a89d7a" fontSize="6.5" fontFamily="monospace">C3</text>
    <text x="181" y="142" textAnchor="middle" fill="#FF8C00" fontSize="7" fontFamily="monospace">Gap = C3.high → C1.low</text>
    <text x="181" y="152" textAnchor="middle" fill="#FFD600" fontSize="6.5" fontFamily="monospace">Enter at 50% (OTE)</text>
  </svg>
);

/* ─── Concept data ──────────────────────────────────────────────────────── */
const CONCEPTS: Concept[] = [
  {
    key: "order-block",
    name: "Order Block",
    tagline: "Institutional footprint in price",
    icon: <Square size={18} strokeWidth={1.5} />,
    accentColor: "#FFD600",
    accentBg: "rgba(255,214,0,0.10)",
    accentBorder: "rgba(255,214,0,0.25)",
    badges: [
      { label: "Bullish OB", color: "#00E6AC", bg: "rgba(0,200,150,0.12)", border: "rgba(0,200,150,0.25)" },
      { label: "Bearish OB", color: "#FF8C00", bg: "rgba(255,140,0,0.12)", border: "rgba(255,140,0,0.25)" },
    ],
    definition:
      "An Order Block is the last opposing candle before a significant impulse move — the last bearish candle before a bullish impulse, or the last bullish candle before a bearish impulse. It represents a zone where institutional orders were placed, leaving a footprint in price that the market tends to revisit. Not every counter-candle qualifies: three strict conditions must be met for an OB to be considered valid.",
    identification:
      "Look for strong displacement moves that leave clear imbalances. The Order Block is identified as the final candle of the opposing color immediately preceding that impulse. For a Bullish OB, find the last red (bearish) candle before a sharp upward move. For a Bearish OB, find the last green (bullish) candle before a sharp downward move. Then verify the three validation rules below before trading it.",
    rules: [
      "Price frequently returns to the OB zone to rebalance institutional orders before continuing the original direction.",
      "A valid OB must precede a significant displacement — not just any counter-candle.",
      "The OB zone is typically defined by the high and low (or open and close) of that candle.",
      "Higher timeframe OBs carry more weight — always align with the higher timeframe bias.",
      "An OB loses validity once price closes decisively through it (it may then become a Breaker Block).",
    ],
    application:
      "Use Order Blocks as premium and discount zones for entry. When price returns to mitigate a Bullish OB in a bullish structure, look for confirmation (e.g., bullish candlestick patterns, rejection wicks) to enter long. Set your stop loss below the OB and target the next significant level — liquidity pool or FVG above. Combine with higher timeframe Market Structure Shifts (MSS) for the highest probability setups.",
    sections: [
      {
        label: "Bullish Order Block",
        content:
          "The last bearish (red) candle before an upward impulse. Price will often return to this zone to collect orders before pushing higher. Look for it in discount zones (below the 50% level of the dealing range).",
      },
      {
        label: "Bearish Order Block",
        content:
          "The last bullish (green) candle before a downward impulse. Price will often return to this zone before continuing lower. Look for it in premium zones (above the 50% level of the dealing range).",
      },
    ],
    validationRules: [
      {
        number: 1,
        title: "Kill Zone Formation",
        accentColor: "#FFD600",
        description: "The Order Block must form inside a Kill Zone.",
        detail:
          "A Kill Zone is a specific time window when institutional order flow is most active: London Open (02:00–05:00 NY), New York Open (07:00–10:00 NY), or London Close (10:00–12:00 NY). An OB that forms outside these windows carries significantly less weight — it may be a random candle, not an institutional imprint. Always check the session timestamp before labelling a candle as an OB.",
        diagram: <DiagramKillZone />,
      },
      {
        number: 2,
        title: "Liquidity Sweep (SSL / BSL)",
        accentColor: "#00C896",
        description: "A Bullish OB requires a prior SSL sweep. A Bearish OB requires a prior BSL sweep.",
        detail:
          "Before a valid Bullish OB forms, price must sweep Sell-Side Liquidity (SSL) — taking out the buy-stop orders resting below a prior swing low or equal lows. This sweep fuels the institutional reversal and is what gives the OB its validity. Symmetrically, a valid Bearish OB requires price to first sweep Buy-Side Liquidity (BSL) above prior swing highs or equal highs. Without the liquidity sweep, there is no institutional justification for the OB.",
        diagram: <DiagramSSL />,
      },
      {
        number: 3,
        title: "Displacement Close",
        accentColor: "#FF8C00",
        description: "The impulse candle following the OB must close beyond the OB's boundary.",
        detail:
          "For a Bullish OB, the first (or subsequent) impulse candle must close decisively above the OB's high — not just pierce it with a wick. For a Bearish OB, the impulse candle must close below the OB's low. This closing confirmation proves that institutional buying/selling was strong enough to displace price, validating the OB as a genuine point of interest. A candle that only wicks through without a body close does not confirm the displacement.",
        diagram: <DiagramDisplacement />,
      },
    ],
    featuredVideo: {
      youtubeId: "5fv2MjuPKE4",
      title: "ICT Order Block — Full Breakdown",
      description: "Deep-dive walkthrough of Order Block identification, Kill Zone timing, liquidity sweeps, and real chart examples by ICT.",
    },
  },
  {
    key: "fvg",
    name: "FVG",
    tagline: "Fair Value Gap — price imbalance",
    icon: <TrendingUp size={18} strokeWidth={1.5} />,
    accentColor: "#00C896",
    accentBg: "rgba(0,200,150,0.10)",
    accentBorder: "rgba(0,200,150,0.25)",
    badges: [
      { label: "Bullish FVG", color: "#00E6AC", bg: "rgba(0,200,150,0.12)", border: "rgba(0,200,150,0.25)" },
      { label: "Bearish FVG", color: "#FF8C00", bg: "rgba(255,140,0,0.12)", border: "rgba(255,140,0,0.25)" },
    ],
    definition:
      "A Fair Value Gap (FVG) is a 3-candle pattern where the wicks of candle 1 and candle 3 do not overlap — creating an imbalance (gap) in price delivery. It signals that price moved so aggressively that it left an inefficiency the market will typically return to fill.",
    identification:
      "For a Bullish FVG: the low of candle 3 is higher than the high of candle 1 — the gap exists between candle 1's high and candle 3's low, with candle 2 as the strong bullish impulse. For a Bearish FVG: the high of candle 3 is lower than the low of candle 1 — the gap exists between candle 1's low and candle 3's high, with candle 2 as the strong bearish impulse.",
    rules: [
      "Price tends to return to fill FVGs as part of the natural fair value delivery process.",
      "The 50% equilibrium level of the FVG is the key entry zone — referred to as the 'optimal trade entry' within the gap.",
      "Not all FVGs fill immediately; some take multiple sessions or days.",
      "FVGs on higher timeframes (4H, Daily) are more significant and reliable than lower timeframe gaps.",
      "Once an FVG is fully filled (price closes through it), it loses its power as a support/resistance zone.",
      "Overlapping FVGs with Order Blocks creates a high-probability confluence zone.",
    ],
    application:
      "Use FVGs as entry zones when price returns to fill the gap. The optimal entry is at the 50% level of the gap — this is where you get the best risk-to-reward ratio. Set your stop loss beyond the far edge of the FVG. For highest probability, combine FVGs with Order Blocks and confirm with Market Structure Shifts on a lower timeframe. FVGs that align with key liquidity levels (old highs/lows) are particularly powerful.",
    sections: [
      {
        label: "Bullish FVG",
        content:
          "The gap exists above candle 1's high and below candle 3's low. When price returns into this zone from above (pulling back), it acts as support. The 50% level is the optimal entry for a long position.",
      },
      {
        label: "Bearish FVG",
        content:
          "The gap exists below candle 1's low and above candle 3's high. When price returns into this zone from below (rallying), it acts as resistance. The 50% level is the optimal entry for a short position.",
      },
    ],
    validationRules: [
      {
        number: 1,
        title: "Kill Zone Formation",
        accentColor: "#00C896",
        description: "The FVG must form inside an active Kill Zone.",
        detail:
          "Just like an Order Block, a Fair Value Gap only carries institutional weight when it forms during a high-activity session window: London Open (02:00–05:00 NY), New York Open (07:00–10:00 NY), or London Close (10:00–12:00 NY). A 3-candle imbalance that develops outside these windows is likely a retail coincidence, not an engineered inefficiency. Always verify the session timestamp of the middle impulse candle (C2) — it defines when the gap was created.",
        diagram: <DiagramFvgKillZone />,
      },
      {
        number: 2,
        title: "Premium / Discount Positioning",
        accentColor: "#FFD600",
        description: "A Bullish FVG must sit in a Discount zone. A Bearish FVG must sit in a Premium zone.",
        detail:
          "The dealing range (swing high to swing low) is divided at its 50% equilibrium level into two halves: Premium (upper 50%) and Discount (lower 50%). Institutions buy at a discount and sell at a premium — so a Bullish FVG that sits in the lower half of the range is in the right location for a buy reaction. A Bullish FVG sitting above the 50% is in premium and should be skipped. Inversely, a Bearish FVG is only valid when it sits in the upper premium half of the range.",
        diagram: <DiagramFvgPremiumDiscount />,
      },
      {
        number: 3,
        title: "Gap Anatomy & OTE Level",
        accentColor: "#FF8C00",
        description: "Understand the gap structure and enter at the 50% Optimal Trade Entry (OTE).",
        detail:
          "A valid FVG is defined by a strict 3-candle anatomy: C1 (any direction), C2 (strong impulse), C3 (same direction as C2). For a Bullish FVG the gap spans from C1's high to C3's low; for a Bearish FVG it spans from C3's high to C1's low. The 50% midpoint of that gap is the Optimal Trade Entry (OTE) — where you get the best R:R. Entering at the far edge gives a worse ratio; entering before price reaches the gap is premature. Wait for price to return to the gap in the right session window.",
        diagram: <DiagramFvgAnatomy />,
      },
    ],
  },
  {
    key: "breaker-block",
    name: "Breaker Block",
    tagline: "Failed OB — polarity shift",
    icon: <RefreshCw size={18} strokeWidth={1.5} />,
    accentColor: "#FF8C00",
    accentBg: "rgba(255,140,0,0.10)",
    accentBorder: "rgba(255,140,0,0.25)",
    badges: [
      { label: "Bullish Breaker", color: "#00E6AC", bg: "rgba(0,200,150,0.12)", border: "rgba(0,200,150,0.25)" },
      { label: "Bearish Breaker", color: "#FF8C00", bg: "rgba(255,140,0,0.12)", border: "rgba(255,140,0,0.25)" },
    ],
    definition:
      "A Breaker Block is a failed Order Block — when price takes out an Order Block's protective liquidity and then reverses direction, that OB transforms into a Breaker Block with the opposite directional bias. It represents a structural shift where former support becomes resistance and vice versa.",
    identification:
      "First, identify an existing Order Block. Then observe if price breaks through that OB — taking out the liquidity resting beyond it (stop loss orders). If price then reverses sharply from that level, the original OB has become a Breaker Block. A Bullish OB that gets taken out (price closes below it) becomes a Bearish Breaker Block. A Bearish OB that gets taken out (price closes above it) becomes a Bullish Breaker Block.",
    rules: [
      "The Breaker Block only forms after a confirmed liquidity sweep — price must take out the stops beyond the original OB.",
      "The polarity flips: a former Bullish OB (support) becomes a Bearish Breaker Block (resistance).",
      "Breaker Blocks are strong reversal areas — they tend to generate powerful, fast moves.",
      "Combine with liquidity sweeps for confirmation — the sweep validates the formation.",
      "Higher timeframe Breaker Blocks (Daily, 4H) create the most reliable trading opportunities.",
      "Once price returns to and rejects from a Breaker Block, it has been 'mitigated' and loses its potency.",
    ],
    application:
      "Look for Breaker Blocks after liquidity sweeps of significant highs or lows. When price sweeps a level and then reverses, look left to identify if there was an OB at that reversal zone — that OB is now your Breaker Block. Enter on the return to the Breaker Block zone with confirmation from a lower timeframe Market Structure Shift. Breaker Blocks combined with FVGs at the same level create extremely high-probability setups with excellent risk-to-reward ratios.",
    sections: [
      {
        label: "Bearish Breaker Block",
        content:
          "A former Bullish OB that price broke through (sweeping sell stops below it). When price rallies back into this zone, it now acts as strong resistance. Ideal for short entries with stops above the Breaker.",
      },
      {
        label: "Bullish Breaker Block",
        content:
          "A former Bearish OB that price broke through (sweeping buy stops above it). When price pulls back into this zone, it now acts as strong support. Ideal for long entries with stops below the Breaker.",
      },
    ],
  },
];

/* ─── Component ─────────────────────────────────────────────────────────── */
export function IctConceptsClient() {
  const [selected, setSelected] = useState<ConceptKey>("order-block");
  const [animating, setAnimating] = useState(false);

  const concept = CONCEPTS.find((c) => c.key === selected)!;

  function selectConcept(key: ConceptKey) {
    if (key === selected) return;
    setAnimating(true);
    setTimeout(() => {
      setSelected(key);
      setAnimating(false);
    }, 160);
  }

  return (
    <>
      {/* ── Concept selector ── */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {CONCEPTS.map((c) => {
          const isActive = c.key === selected;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => selectConcept(c.key)}
              className="group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200 outline-none focus-visible:ring-2"
              style={
                isActive
                  ? {
                      backgroundColor: c.accentBg,
                      borderColor: c.accentColor,
                      boxShadow: `0 0 20px ${c.accentBg}, 0 0 0 1px ${c.accentBorder}`,
                      "--tw-ring-color": c.accentColor,
                    } as React.CSSProperties
                  : {
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border)",
                      "--tw-ring-color": c.accentColor,
                    } as React.CSSProperties
              }
            >
              {/* Icon */}
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200"
                style={{
                  backgroundColor: isActive ? c.accentBg : "rgba(255,255,255,0.04)",
                  color: isActive ? c.accentColor : "var(--text-muted)",
                  border: `1px solid ${isActive ? c.accentBorder : "var(--border)"}`,
                }}
              >
                {c.icon}
              </span>

              {/* Name */}
              <div>
                <p
                  className="text-sm font-semibold leading-tight transition-colors duration-200"
                  style={{ color: isActive ? c.accentColor : "var(--text-primary)" }}
                >
                  {c.name}
                </p>
                <p
                  className="mt-0.5 text-[11px] leading-snug"
                  style={{ color: isActive ? c.accentColor : "var(--text-muted)", opacity: isActive ? 0.8 : 1 }}
                >
                  {c.tagline}
                </p>
              </div>

              {/* Active dot */}
              {isActive && (
                <span
                  className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: c.accentColor }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content area ── */}
      <div
        className="transition-opacity duration-150"
        style={{ opacity: animating ? 0 : 1 }}
      >
        {/* Header card */}
        <div
          className="mb-4 rounded-xl border p-5"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                Definition
              </p>
              <h2
                className="mb-3 text-xl font-semibold"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "0.01em",
                }}
              >
                {concept.name}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {concept.definition}
              </p>
            </div>
            {/* Accent badge cluster */}
            <div className="flex shrink-0 flex-col gap-1.5">
              {concept.badges.map((b) => (
                <span
                  key={b.label}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: b.color, backgroundColor: b.bg, border: `1px solid ${b.border}` }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column: Identification + Application */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Identification */}
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <p
              className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              How to Identify
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {concept.identification}
            </p>
          </div>

          {/* Application */}
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <p
              className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Trading Application
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {concept.application}
            </p>
          </div>
        </div>

        {/* ── Validation Rules (OB only) ── */}
        {concept.validationRules && (
          <div className="mb-4">
            <div className="mb-3 flex items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Validation Conditions
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                style={{ color: "#FFD600", backgroundColor: "rgba(255,214,0,0.10)", border: "1px solid rgba(255,214,0,0.25)" }}
              >
                All 3 required
              </span>
            </div>
            <div className="space-y-3">
              {concept.validationRules.map((vr) => (
                <div
                  key={vr.number}
                  className="overflow-hidden rounded-xl border"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: "1px solid var(--border)", backgroundColor: "rgba(255,255,255,0.015)" }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ backgroundColor: vr.accentColor, color: "#0d0c08" }}
                    >
                      {vr.number}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {vr.title}
                      </p>
                      <p className="text-xs" style={{ color: vr.accentColor }}>
                        {vr.description}
                      </p>
                    </div>
                  </div>

                  {/* Body: text + diagram */}
                  <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {vr.detail}
                    </p>
                    <div
                      className="overflow-hidden rounded-lg"
                      style={{ border: "1px solid var(--border)", backgroundColor: "#1a1710" }}
                    >
                      {vr.diagram}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key rules */}
        <div
          className="mb-4 rounded-xl border p-5"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p
            className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Key Rules
          </p>
          <ul className="space-y-2.5">
            {concept.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: concept.accentColor }}
                />
                <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {rule}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Variants */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {concept.sections.map((section) => (
            <div
              key={section.label}
              className="rounded-xl border p-5"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border)",
                borderLeft: `2px solid ${concept.accentColor}`,
              }}
            >
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: concept.accentColor }}
              >
                {section.label}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* ── Featured Video ── */}
        {concept.featuredVideo && (
          <div className="mt-4">
            {/* Section label */}
            <div className="mb-3 flex items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Featured Video
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                style={{ color: "#ef4444", backgroundColor: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                YouTube
              </span>
            </div>

            <div
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              {/* Video embed */}
              <div className="relative w-full" style={{ paddingBottom: "56.25%" /* 16:9 */ }}>
                <iframe
                  src={`https://www.youtube.com/embed/${concept.featuredVideo.youtubeId}?rel=0&modestbranding=1&color=white`}
                  title={concept.featuredVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                  style={{ border: "none" }}
                />
              </div>

              {/* Video metadata */}
              <div
                className="flex items-start gap-3 px-5 py-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                {/* YouTube icon */}
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#ef4444">
                    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {concept.featuredVideo.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {concept.featuredVideo.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
