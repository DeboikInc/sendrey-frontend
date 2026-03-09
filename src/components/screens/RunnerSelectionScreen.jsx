import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { useDispatch } from "react-redux";
import { Star, X, Clock, ChevronDown, Trophy } from "lucide-react";
import BarLoader from "../common/BarLoader";
import { useSocket } from "../../hooks/useSocket";

// Sorts runners by who's most likely to do a good job quickly.
// Closest first, then least busy, then most experienced, then highest rated.
// Missing values get pushed to the bottom so they don't unfairly block good runners.
function rankRunners(runners) {
  return [...runners].sort((a, b) => {
    const distA = a.distanceKm ?? 9999;
    const distB = b.distanceKm ?? 9999;
    if (distA !== distB) return distA - distB;

    const loadA = a.activeTaskCount ?? 0;
    const loadB = b.activeTaskCount ?? 0;
    if (loadA !== loadB) return loadA - loadB;

    const rateA = a.totalRuns ?? 0;
    const rateB = b.totalRuns ?? 0;
    if (rateA !== rateB) return rateB - rateA;

    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

// Rough ETA based on distance — assumes ~3 minutes per km.
// Not GPS-accurate, just good enough to give the user a feel for how far the runner is.
function etaFromDistance(distanceKm) {
  if (distanceKm == null) return null;
  const minutes = Math.max(2, Math.round(distanceKm * 3));
  return minutes < 60 ? `~${minutes} min away` : `~${Math.round(minutes / 60)}h away`;
}

// How many runner cards to show before the "show more" button appears
const VISIBLE_COUNT_STEP = 5;
// Give the runner 35 seconds to respond before we move on to the next one
const REQUEST_TIMEOUT_MS = 35_000;

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
  const [isVisible, setIsVisible]               = useState(false);
  // tracks which UI triggered the current request — "card", "mostRated", or null when idle.
  // this is what keeps the card list and the trophy button from stepping on each other.
  const [waitingSource, setWaitingSource]        = useState(null);
  const [selectedRunnerId, setSelectedRunnerId]  = useState(null);
  const [isMobile, setIsMobile]                  = useState(false);
  const [visibleCount, setVisibleCount]          = useState(VISIBLE_COUNT_STEP);
  // shown in the yellow banner when we auto-jump to the next runner after a timeout or rejection
  const [autoAssignMsg, setAutoAssignMsg]        = useState(null);

  const dispatch = useDispatch();
  const { socket, isConnected } = useSocket();

  // keeping the timeout id in a ref so we can cancel it from anywhere without a re-render
  const timeoutRef        = useRef(null);
  // holds the details of whichever runner request is currently in flight
  const pendingRequestRef = useRef(null);
  // we need the latest ranked list inside setTimeout callbacks where state would be stale
  const rankedRunnersRef  = useRef([]);
  // same idea — lets the timeout always call the latest version of requestRunner
  const requestRunnerRef  = useRef(null);

  const rawRunners    = runnerResponseData?.runners || [];
  const count         = runnerResponseData?.count   || rawRunners.length;
  const error         = runnerResponseData?.error;
  const rankedRunners = rankRunners(rawRunners);
  rankedRunnersRef.current = rankedRunners;

  const visibleRunners = rankedRunners.slice(0, visibleCount);
  const hasMore        = visibleCount < rankedRunners.length;

  // separate sort from rankRunners because this one only cares about rating,
  // not proximity or workload — it's the "just give me the best one" shortcut
  const mostRatedRunner = [...rawRunners].sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.totalRuns ?? 0) - (a.totalRuns ?? 0)
  )[0] ?? null;

  // derived booleans so the JSX stays readable
  const isWaitingForRunner = waitingSource !== null;
  const isMostRatedWaiting = waitingSource === "mostRated";

  // cancels whatever is in flight — timeout, pending ref, the lot
  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRequestRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setWaitingSource(null);
    setSelectedRunnerId(null);
    setAutoAssignMsg(null);
    clearPending();
    // small delay so the slide-down animation finishes before we fully unmount
    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 200);
  }, [onClose, clearPending]);

  // the core function that actually sends a runner request over the socket.
  // `source` tells us which UI triggered it so loading states stay independent.
  // `autoAssign` means we got here automatically (timeout or rejection), not from a user tap.
  const requestRunner = useCallback(
    (runner, autoAssign = false, source = "card") => {
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
      setWaitingSource(source);
      setAutoAssignMsg(autoAssign ? `Runner unavailable — trying ${runner.firstName}…` : null);

      socket.emit("requestRunner", { runnerId, userId, chatId, serviceType: selectedService });

      // if the runner doesn't respond in time, automatically try the next one in the ranked list
      timeoutRef.current = setTimeout(() => {
        const pending = pendingRequestRef.current;
        // bail out if something else already handled this (e.g. a rejection event beat us here)
        if (!pending || pending.runnerId !== runnerId) return;

        clearPending();
        setWaitingSource(null);
        setSelectedRunnerId(null);

        const ranked     = rankedRunnersRef.current;
        const curIdx     = ranked.findIndex((r) => (r._id || r.id) === runnerId);
        const nextRunner = ranked[curIdx + 1] ?? null;

        if (nextRunner) {
          // call via ref so we always get the latest closure, not the one captured at mount
          requestRunnerRef.current?.(nextRunner, true, source);
        } else {
          setAutoAssignMsg(null);
          alert("No available runners responded. Please try again later.");
        }
      }, REQUEST_TIMEOUT_MS);
    },
    [socket, isConnected, userData, selectedService, clearPending]
  );

  // keep the ref up to date whenever requestRunner gets a new closure
  useEffect(() => {
    requestRunnerRef.current = requestRunner;
  }, [requestRunner]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // lock body scroll while the sheet is open so the page doesn't scroll behind it.
  // the 50ms delay before setIsVisible lets the DOM paint first so the animation actually runs.
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

  useEffect(() => {
    if (!socket || !isConnected) return;
    const userId = userData?._id;
    if (!userId) return;

    const handleEnterPreRoom = (data) => {
      console.log("enterPreRoom:", data);
    };

    // runner accepted — join the actual chat room and hand off to the parent
    const handleProceedToChat = (data) => {
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

        setWaitingSource(null);
        setSelectedRunnerId(null);
        setAutoAssignMsg(null);

        // try to pass back the full runner object so the parent has all the info it needs
        const runnerData = rankedRunnersRef.current.find(
          (r) => (r._id || r.id) === data.runnerId
        );
        if (onSelectRunner) {
          onSelectRunner(runnerData || { _id: data.runnerId, id: data.runnerId });
        }
      }
    };

    // runner said no — move on to the next ranked runner automatically
    const handleRunnerRejected = (data) => {
      const pending = pendingRequestRef.current;
      if (!pending || pending.runnerId !== data.runnerId) return;

      // hang onto the source before we clear it so the next request knows where it came from
      const prevSource = waitingSource;
      clearPending();
      setWaitingSource(null);
      setSelectedRunnerId(null);

      const ranked     = rankedRunnersRef.current;
      const curIdx     = ranked.findIndex((r) => (r._id || r.id) === data.runnerId);
      const nextRunner = ranked[curIdx + 1] ?? null;

      if (nextRunner) {
        requestRunnerRef.current?.(nextRunner, true, prevSource ?? "card");
      } else {
        setAutoAssignMsg(null);
        alert("All nearby runners are unavailable. Please try again later.");
      }
    };

    socket.on("enterPreRoom",   handleEnterPreRoom);
    socket.on("proceedToChat",  handleProceedToChat);
    socket.on("runnerRejected", handleRunnerRejected);

    return () => {
      socket.off("enterPreRoom",   handleEnterPreRoom);
      socket.off("proceedToChat",  handleProceedToChat);
      socket.off("runnerRejected", handleRunnerRejected);
      clearPending();
    };
  }, [socket, isConnected, userData, selectedService, onSelectRunner, clearPending, waitingSource]);

  // tags the request as coming from a card so only that card shows a loader
  const handleRunnerClick = (runner) => {
    if (isWaitingForRunner || pendingRequestRef.current) return;
    requestRunner(runner, false, "card");
  };

  // tags the request as "mostRated" so only the trophy button shows a loader, not the cards
  const handleMostRatedClick = () => {
    if (!mostRatedRunner || isWaitingForRunner || pendingRequestRef.current) return;
    requestRunner(mostRatedRunner, false, "mostRated");
  };

  if (!isOpen) return null;

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

          <div className="flex-1 overflow-y-auto p-4 pb-8 min-h-0">
            {autoAssignMsg && (
              <div className="mb-3 max-w-md mx-auto bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                <BarLoader />
                <span>{autoAssignMsg}</span>
              </div>
            )}

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

                <div className="space-y-3">
                  {visibleRunners.map((runner) => {
                    const id             = runner._id || runner.id;
                    // only go into loading state if a card (not the trophy button) triggered the wait
                    const isThisWaiting  = waitingSource === "card" && selectedRunnerId === id;
                    // dim all other cards while we're waiting on one, but don't touch them if mostRated is active
                    const isOtherWaiting = waitingSource === "card" && selectedRunnerId !== id;
                    const eta            = etaFromDistance(runner.distanceKm);

                    return (
                      <Card
                        key={id}
                        className={`transition-all 
                          ${isThisWaiting ? "opacity-70" : "cursor-pointer hover:shadow-lg"} 
                          ${isOtherWaiting ? "opacity-50 pointer-events-none" : ""}`}
                        onClick={() => handleRunnerClick(runner)}
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

                {hasMore && (
                  <button
                    onClick={() => setVisibleCount((c) => c + VISIBLE_COUNT_STEP)}
                    className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Show more options ({rankedRunners.length - visibleCount} more)
                  </button>
                )}

                {mostRatedRunner && (
                  <div className="mt-5">
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <button
                        onClick={handleMostRatedClick}
                        disabled={isMostRatedWaiting}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 border-black dark:border-gray-500 bg-gray-50 dark:bg-yellow-900/20
                          hover:bg-gray-100 dark:hover:bg-gray-900/40 transition-all
                          ${isMostRatedWaiting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-black dark:bg-gray-500">
                            <Trophy className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                              Get Most Rated Runner
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {mostRatedRunner.firstName} {mostRatedRunner.lastName || ""} ·{" "}
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-gray-400 text-yellow-400" />
                                {mostRatedRunner.rating?.toFixed(1) || "5.0"}
                              </span>{" "}
                              · {mostRatedRunner.totalRuns || 0} deliveries
                            </p>
                          </div>
                        </div>

                        {isMostRatedWaiting ? (
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