"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type Bar = {
  time: number; // Unix secondes UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PendingOrder = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryBarIndex: number;
};

export type FilledTrade = {
  order: PendingOrder;
  entryBar: Bar;
  exitBar: Bar;
  exitPrice: number;
  outcome: "WIN" | "LOSS";
  rMultiple: number;
  pnlPoints: number;
};

type UseReplayEngineOpts = {
  onTradeFilled: (trade: FilledTrade) => void;
};

const MIN_START_INDEX = 50;

export function useReplayEngine(
  bars: Bar[],
  { onTradeFilled }: UseReplayEngineOpts
) {
  const [currentIndex, setCurrentIndex] = useState(MIN_START_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<PendingOrder | null>(null);
  pendingOrderRef.current = pendingOrder;

  const visibleBars = bars.slice(0, currentIndex + 1);
  const currentBar = bars[currentIndex] ?? null;

  // Reset position when bars array changes (TF switch)
  useEffect(() => {
    setCurrentIndex(MIN_START_INDEX);
    setIsPlaying(false);
    setPendingOrder(null);
  }, [bars]);

  const checkOrderFill = useCallback(
    (bar: Bar) => {
      const order = pendingOrderRef.current;
      if (!order) return;

      const { direction, entryPrice, stopLoss, takeProfit } = order;
      let exitPrice: number | null = null;
      let outcome: "WIN" | "LOSS" | null = null;

      if (direction === "LONG") {
        if (bar.low <= stopLoss) {
          exitPrice = stopLoss;
          outcome = "LOSS";
        } else if (bar.high >= takeProfit) {
          exitPrice = takeProfit;
          outcome = "WIN";
        }
      } else {
        if (bar.high >= stopLoss) {
          exitPrice = stopLoss;
          outcome = "LOSS";
        } else if (bar.low <= takeProfit) {
          exitPrice = takeProfit;
          outcome = "WIN";
        }
      }

      if (exitPrice === null || outcome === null) return;

      const risk = Math.abs(entryPrice - stopLoss);
      const rMultiple =
        direction === "LONG"
          ? (exitPrice - entryPrice) / risk
          : (entryPrice - exitPrice) / risk;
      const pnlPoints =
        direction === "LONG"
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;

      const filled: FilledTrade = {
        order,
        entryBar: bars[order.entryBarIndex],
        exitBar: bar,
        exitPrice,
        outcome,
        rMultiple: Math.round(rMultiple * 100) / 100,
        pnlPoints: Math.round(pnlPoints * 10000) / 10000,
      };

      setPendingOrder(null);
      onTradeFilled(filled);
    },
    [bars, onTradeFilled]
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, bars.length - 1);
      if (next !== prev) checkOrderFill(bars[next]);
      return next;
    });
  }, [bars, checkOrderFill]);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, MIN_START_INDEX));
    setPendingOrder(null);
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
      setCurrentIndex(
        Math.max(MIN_START_INDEX, Math.min(index, bars.length - 1))
      );
      setPendingOrder(null);
    },
    [bars.length]
  );

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const placeOrder = useCallback(
    (order: PendingOrder) => setPendingOrder(order),
    []
  );
  const cancelOrder = useCallback(() => setPendingOrder(null), []);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(stepForward, Math.round(1000 / speed));
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, stepForward]);

  return {
    visibleBars,
    currentIndex,
    currentBar,
    isPlaying,
    speed,
    pendingOrder,
    play,
    pause,
    stepForward,
    stepBackward,
    jumpTo,
    setSpeed,
    placeOrder,
    cancelOrder,
  };
}
