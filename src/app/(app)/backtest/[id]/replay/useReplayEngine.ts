"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OrderType = "MARKET" | "LIMIT" | "STOP";

export type PendingOrder = {
  direction: "LONG" | "SHORT";
  orderType: OrderType;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  placedAtIndex: number;
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
  onOrderActivated?: (order: PendingOrder, activationBar: Bar) => void;
};

const MIN_START_INDEX = 50;

export function useReplayEngine(
  bars: Bar[],
  { onTradeFilled, onOrderActivated }: UseReplayEngineOpts
) {
  const [currentIndex, setCurrentIndex] = useState(MIN_START_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [activeOrder, setActiveOrder] = useState<PendingOrder | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<PendingOrder | null>(null);
  const activeOrderRef = useRef<PendingOrder | null>(null);
  pendingOrderRef.current = pendingOrder;
  activeOrderRef.current = activeOrder;

  const onOrderActivatedRef = useRef(onOrderActivated);
  onOrderActivatedRef.current = onOrderActivated;

  // Pending activation fired AFTER state commits (Finding #2: avoid async in state updater)
  const pendingActivationRef = useRef<{ order: PendingOrder; bar: Bar } | null>(null);

  const visibleBars = bars.slice(0, currentIndex + 1);
  const currentBar = bars[currentIndex] ?? null;

  useEffect(() => {
    setCurrentIndex(MIN_START_INDEX);
    setIsPlaying(false);
    setPendingOrder(null);
    setActiveOrder(null);
  }, [bars]);

  // Fire the onOrderActivated callback AFTER React has committed state (Finding #2).
  // activeOrder is listed as dependency so this runs when activation commits.
  useEffect(() => {
    const activation = pendingActivationRef.current;
    if (!activation) return;
    pendingActivationRef.current = null;
    onOrderActivatedRef.current?.(activation.order, activation.bar);
  }, [activeOrder]);

  const checkOrderActivation = useCallback(
    (bar: Bar, index: number) => {
      const order = pendingOrderRef.current;
      if (!order || order.orderType === "MARKET") return;

      const { direction, orderType, entryPrice } = order;
      let activated = false;

      if (direction === "LONG") {
        activated = orderType === "LIMIT"
          ? bar.low <= entryPrice
          : bar.high >= entryPrice; // STOP
      } else {
        activated = orderType === "LIMIT"
          ? bar.high >= entryPrice
          : bar.low <= entryPrice; // STOP
      }

      if (!activated) return;

      const activatedOrder: PendingOrder = { ...order, entryBarIndex: index };
      // Update ref immediately so checkOrderExit can read it in the same tick (Finding #3)
      activeOrderRef.current = activatedOrder;
      setPendingOrder(null);
      setActiveOrder(activatedOrder);
      // Store activation for deferred callback — fires after state commits (Finding #2)
      pendingActivationRef.current = { order: activatedOrder, bar };
    },
    []
  );

  const checkOrderExit = useCallback(
    (bar: Bar) => {
      const order = activeOrderRef.current;
      if (!order) return;

      const { direction, entryPrice, stopLoss, takeProfit } = order;
      let exitPrice: number | null = null;
      let outcome: "WIN" | "LOSS" | null = null;

      if (direction === "LONG") {
        if (bar.low <= stopLoss) { exitPrice = stopLoss; outcome = "LOSS"; }
        else if (bar.high >= takeProfit) { exitPrice = takeProfit; outcome = "WIN"; }
      } else {
        if (bar.high >= stopLoss) { exitPrice = stopLoss; outcome = "LOSS"; }
        else if (bar.low <= takeProfit) { exitPrice = takeProfit; outcome = "WIN"; }
      }

      if (exitPrice === null || outcome === null) return;

      const risk = Math.abs(entryPrice - stopLoss);
      const rMultiple = direction === "LONG"
        ? (exitPrice - entryPrice) / risk
        : (entryPrice - exitPrice) / risk;
      const pnlPoints = direction === "LONG"
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

      setActiveOrder(null);
      onTradeFilled(filled);
    },
    [bars, onTradeFilled]
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, bars.length - 1);
      if (next !== prev) {
        checkOrderActivation(bars[next], next);
        checkOrderExit(bars[next]);
      }
      return next;
    });
  }, [bars, checkOrderActivation, checkOrderExit]);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, MIN_START_INDEX));
    setPendingOrder(null);
    setActiveOrder(null);
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(MIN_START_INDEX, Math.min(index, bars.length - 1)));
      setPendingOrder(null);
      setActiveOrder(null);
    },
    [bars.length]
  );

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const placeOrder = useCallback((order: PendingOrder) => {
    if (order.orderType === "MARKET") {
      setActiveOrder(order);
    } else {
      setPendingOrder(order);
    }
  }, []);

  const activateOrder = useCallback((order: PendingOrder) => {
    setPendingOrder(null);
    setActiveOrder(order);
  }, []);

  const cancelPendingOrder = useCallback(() => setPendingOrder(null), []);
  const cancelActiveOrder = useCallback(() => setActiveOrder(null), []);

  const updateActiveOrderLevels = useCallback((sl: number, tp: number) => {
    setActiveOrder((prev) => {
      if (!prev) return prev;
      return { ...prev, stopLoss: sl, takeProfit: tp };
    });
    // Update ref after scheduling the state update.
    // The interval runs on the next tick after this synchronous call completes,
    // so the ref will be current when checkOrderExit reads it.
    if (activeOrderRef.current) {
      activeOrderRef.current = { ...activeOrderRef.current, stopLoss: sl, takeProfit: tp };
    }
  }, []);

  const updatePendingOrderLevels = useCallback((sl: number, tp: number) => {
    setPendingOrder((prev) => {
      if (!prev) return prev;
      return { ...prev, stopLoss: sl, takeProfit: tp };
    });
    if (pendingOrderRef.current) {
      pendingOrderRef.current = { ...pendingOrderRef.current, stopLoss: sl, takeProfit: tp };
    }
  }, []);

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
    activeOrder,
    play,
    pause,
    stepForward,
    stepBackward,
    jumpTo,
    setSpeed,
    placeOrder,
    activateOrder,
    cancelPendingOrder,
    cancelActiveOrder,
    updateActiveOrderLevels,
    updatePendingOrderLevels,
  };
}
