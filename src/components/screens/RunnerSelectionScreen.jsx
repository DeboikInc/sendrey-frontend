import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { useDispatch, useSelector } from "react-redux";
import { Star, X, Clock, ChevronDown, Trophy } from "lucide-react";
import BarLoader from "../common/BarLoader";
import { useSocket } from "../../hooks/useSocket";

// ─── Ranking helpers ──────────────────────────────────────────────────────────

/**
 * Rank runners according to PRD 3 §5.1 priority order:
 *  1. Proximity  2. Workload  3. Completion rate  4. Rating
 
 */
function rankRunners(runners) {
  return [...runners].sort((a, b) => {
    // 1. Proximity (lower distanceKm = better; treat missing as far)
    const distA = a.distanceKm ?? 9999;
    const distB = b.distanceKm ?? 9999;
    if (distA !== distB) return distA - distB;

    // 2. Workload (fewer active tasks = better)
    const loadA = a.activeTaskCount ?? 0;
    const loadB = b.activeTaskCount ?? 0;
    if (loadA !== loadB) return loadA - loadB;

    // 3. Completion rate
    const rateA = a.totalRuns ?? 0;
    const rateB = b.totalRuns ?? 0;
    if (rateA !== rateB) return rateB - rateA;

    // 4. Rating
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

/** Derive a human-readable ETA string from distanceKm (rough walking/driving estimate) */
function etaFromDistance(distanceKm) {
  if (distanceKm == null) return null;
  const minutes = Math.max(2, Math.round(distanceKm * 3)); // ~3 min/km
  return minutes < 60 ? `~${minutes} min away` : `~${Math.round(minutes / 60)}h away`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const VISIBLE_COUNT_STEP = 5; // how many runners to show per "load more"
const REQUEST_TIMEOUT_MS  = 35_000;

export default function RunnerSelectionScreen({
  selectedVehicle,
  selectedService,
  onSelectRunner,
  darkMode,
  isOpen,
  onClose,
  userData,
  className = "",
  runnerResponseData,
}) {
  const [isVisible, setIsVisible]             = useState(false);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId]     = useState(null);
  const [isMobile, setIsMobile]               = useState(false);
  const [visibleCount, setVisibleCount]        = useState(VISIBLE_COUNT_STEP);
  const [autoAssignMsg, setAutoAssignMsg]      = useState(null); // e.g. "Runner declined — trying next…"

  const dispatch = useDispatch();
  const { socket, isConnected } = useSocket();

  const timeoutRef      = useRef(null);
  const pendingRequestRef = useRef(null);
  const rankedRunnersRef  = useRef([]); // keeps ranked order stable between renders

  // ── Derive & rank runners ────────────────────────────────────────────────
  const rawRunners = runnerResponseData?.runners || [];
  const count      = runnerResponseData?.count   || rawRunners.length;
  const error      = runnerResponseData?.error;

  // Re-rank only when raw list changes
  const rankedRunners = rankRunners(rawRunners);
  rankedRunnersRef.current = rankedRunners;

  const visibleRunners = rankedRunners.slice(0, visibleCount);
  const hasMore        = visibleCount < rankedRunners.length;

  // Most-rated runner (by rating, then completion count as tiebreak)
  const mostRatedRunner = [...rawRunners].sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.totalRuns ?? 0) - (a.totalRuns ?? 0)
  )[0] ?? null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRequestRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);
    setAutoAssignMsg(null);
    clearPending();
    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 200);
  }, [onClose, clearPending]);

  /**
   * Core emit: emit requestRunner, start timeout that auto-reassigns
   * to the next ranked runner on no-response / rejection.
   */
  const requestRunner = useCallback(
    (runner, autoAssign = false) => {
      const runnerId = runner._id || runner.id;
      const userId   = userData?._id;

      if (!socket || !isConnected || !userId) {
        alert("Connection issue. Please try again.");
        return;
      }

      const chatId = `user-${userId}-runner-${runnerId}`;

      pendingRequestRef.current = {
        runnerId,
        userId,
        chatId,
        serviceType: selectedService,
        timestamp: Date.now(),
      };

      setSelectedRunnerId(runnerId);
      setIsWaitingForRunner(true);
      if (autoAssign) {
        setAutoAssignMsg(`Runner unavailable — trying ${runner.firstName}…`);
      } else {
        setAutoAssignMsg(null);
      }

      socket.emit("requestRunner", { runnerId, userId, chatId, serviceType: selectedService });

      // Timeout → auto-reassign to next ranked runner
      timeoutRef.current = setTimeout(() => {
        const pending = pendingRequestRef.current;
        if (!pending || pending.runnerId !== runnerId) return;

        clearPending();
        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);

        // Find current runner index in ranked list
        const ranked  = rankedRunnersRef.current;
        const curIdx  = ranked.findIndex((r) => (r._id || r.id) === runnerId);
        const nextRunner = ranked[curIdx + 1] ?? null;

        if (nextRunner) {
          // Auto-offer to next ranked runner (PRD §5.3)
          requestRunner(nextRunner, true);
        } else {
          setAutoAssignMsg(null);
          alert("No available runners responded. Please try again later.");
        }
      }, REQUEST_TIMEOUT_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket, isConnected, userData, selectedService, clearPending]
  );

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ── Body scroll lock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => setIsVisible(true), 50);
    } else {
      document.body.style.overflow = "";
      setIsVisible(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;
    const userId = userData?._id;
    if (!userId) return;

    const handleEnterPreRoom = (data) => {
      console.log("✅ enterPreRoom:", data);
    };

    const handleProceedToChat = (data) => {
      console.log("✅ proceedToChat:", data);
      const pending = pendingRequestRef.current;
      if (!pending) return;

      if (data.chatId === pending.chatId && data.chatReady) {
        clearPending();

        socket.emit("userJoinChat", {
          userId,
          runnerId: data.runnerId,
          chatId: data.chatId,
          serviceType: selectedService,
        });

        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);
        setAutoAssignMsg(null);

        const runnerData = rankedRunnersRef.current.find(
          (r) => (r._id || r.id) === data.runnerId
        );
        if (onSelectRunner) {
          onSelectRunner(runnerData || { _id: data.runnerId, id: data.runnerId });
        }
      }
    };

    /** Runner explicitly rejected — auto-offer next ranked runner (PRD §5.3) */
    const handleRunnerRejected = (data) => {
      console.log("❌ runnerRejected:", data);
      const pending = pendingRequestRef.current;
      if (!pending || pending.runnerId !== data.runnerId) return;

      clearPending();
      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);

      const ranked  = rankedRunnersRef.current;
      const curIdx  = ranked.findIndex((r) => (r._id || r.id) === data.runnerId);
      const nextRunner = ranked[curIdx + 1] ?? null;

      if (nextRunner) {
        requestRunner(nextRunner, true);
      } else {
        setAutoAssignMsg(null);
        alert("All nearby runners are unavailable. Please try again later.");
      }
    };

    socket.on("enterPreRoom",    handleEnterPreRoom);
    socket.on("proceedToChat",   handleProceedToChat);
    socket.on("runnerRejected",  handleRunnerRejected);

    return () => {
      socket.off("enterPreRoom",   handleEnterPreRoom);
      socket.off("proceedToChat",  handleProceedToChat);
      socket.off("runnerRejected", handleRunnerRejected);
      clearPending();
    };
  }, [socket, isConnected, userData, selectedService, onSelectRunner, clearPending, requestRunner]);

  // ── Click handlers ────────────────────────────────────────────────────────

  const handleRunnerClick = (runner) => {
    if (isWaitingForRunner || pendingRequestRef.current) return;
    requestRunner(runner, false);
  };

  const handleMostRatedClick = () => {
    if (!mostRatedRunner || isWaitingForRunner || pendingRequestRef.current) return;
    requestRunner(mostRatedRunner, false);
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        onTouchStart={(e) => e.preventDefault()}
      />

      <div className="fixed bottom-0 left-0 right-0 z-[10000] flex justify-center px-4">
        <div
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"} 
            rounded-t-3xl shadow-2xl 
            lg:h-full
            h-[85vh]
            w-full max-w-4xl mx-auto
            flex flex-col 
            transition-transform duration-300 ease-out 
            ${isVisible ? "translate-y-0" : "translate-y-full"}`}
        >
          {/* Header - Fixed */}
          <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-black dark:text-white">
              Available Runners Nearby
            </h2>
            <button
              onClick={handleClose}
              aria-label="Close runner selection"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 pb-8 min-h-0">

            {/* Auto-assign status banner */}
            {autoAssignMsg && (
              <div className="mb-3 max-w-md mx-auto bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                <BarLoader />
                <span>{autoAssignMsg}</span>
              </div>
            )}

            {/* Error / Empty */}
            {error || rawRunners.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                  {error || "No available runners nearby"}
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  Try again in a few moments or adjust your service type
                </p>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    Found {count} available runner{count !== 1 ? "s" : ""} nearby. Who would you like?
                  </p>
                </div>

                {/* Runner cards */}
                <div className="space-y-3">
                  {visibleRunners.map((runner) => {
                    const id                 = runner._id || runner.id;
                    const isThisWaiting      = isWaitingForRunner && selectedRunnerId === id;
                    const eta                = etaFromDistance(runner.distanceKm);

                    return (
                      <Card
                        key={id}
                        className={`transition-all ${isThisWaiting ? "opacity-70" : "cursor-pointer hover:shadow-lg"} ${isWaitingForRunner && !isThisWaiting ? "opacity-50 pointer-events-none" : ""}`}
                        onClick={() => !isWaitingForRunner && handleRunnerClick(runner)}
                      >
                        <CardBody className="flex flex-row items-center p-3">
                          <img
                            src={runner.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                            alt={`${runner.firstName} ${runner.lastName || ""}`}
                            className="w-12 h-12 rounded-full mr-3 object-cover"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-black dark:text-gray-800">
                                {runner.firstName} {runner.lastName || ""}
                              </h4>
                              <div className="flex items-center">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm ml-1 text-black dark:text-white">
                                  {runner.rating?.toFixed(1) || "5.0"}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span>{runner.totalRuns || 0} deliveries</span>
                              <div className="flex items-center gap-2">
                                <Chip
                                  value={runner.fleetType || "N/A"}
                                  size="sm"
                                  className="capitalize"
                                  color="blue"
                                />
                                {runner.isOnline && (
                                  <Chip value="Online" size="sm" color="green" />
                                )}
                              </div>
                            </div>

                            {/* ── ETA row (PRD §5.2) ── */}
                            {eta && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <Clock className="h-3 w-3" />
                                <span>{eta}</span>
                              </div>
                            )}
                          </div>

                          {isThisWaiting && (
                            <div className="ml-auto pl-3">
                              <BarLoader />
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>

                {/* Show more options (PRD §5.2) */}
                {hasMore && (
                  <button
                    onClick={() => setVisibleCount((c) => c + VISIBLE_COUNT_STEP)}
                    className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Show more options ({rankedRunners.length - visibleCount} more)
                  </button>
                )}

                {/* ── Get Most Rated Runner */}
                {mostRatedRunner && (
                  <div className="mt-5">
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <button
                        onClick={handleMostRatedClick}
                        disabled={isWaitingForRunner}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20
                          hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-all
                          ${isWaitingForRunner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-yellow-400 dark:bg-yellow-500">
                            <Trophy className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                              Get Most Rated Runner
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {mostRatedRunner.firstName} {mostRatedRunner.lastName || ""} ·{" "}
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {mostRatedRunner.rating?.toFixed(1) || "5.0"}
                              </span>{" "}
                              · {mostRatedRunner.totalRuns || 0} deliveries
                            </p>
                          </div>
                        </div>

                        {isWaitingForRunner && selectedRunnerId === (mostRatedRunner._id || mostRatedRunner.id) ? (
                          <BarLoader />
                        ) : (
                          <Chip
                            value={mostRatedRunner.fleetType || "N/A"}
                            size="sm"
                            className="capitalize"
                            color="blue"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}