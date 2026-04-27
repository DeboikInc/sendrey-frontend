import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { Star, X } from "lucide-react";
import BarLoader from "../common/BarLoader";
import { useSocket } from "../../hooks/useSocket";

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
  specialInstructions = null,
  onFindMore,
  onFetchTopRated,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [isMobile, setIsMobile] = useState(false); // eslint-disable-line no-unused-vars
  const [topRatedLoading, setTopRatedLoading] = useState(false);
  const [topRatedStatus, setTopRatedStatus] = useState(null);

  const { socket, isConnected } = useSocket();
  const [currentOrder, setCurrentOrder] = useState(null);
  const [timedOutRunnerId, setTimedOutRunnerId] = useState(null);
  const [networkError, setNetworkError] = useState(false);

  const timeoutRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const selectedRunnerIdRef = useRef(null);
  const proceedBufferRef = useRef(null);
  const runnersRef = useRef([]);
  const userIdRef = useRef(userData?._id);

  const runners = useMemo(() => runnerResponseData?.runners || [], [runnerResponseData]);
  const count = runnerResponseData?.count || runners.length;
  const error = runnerResponseData?.error;

  useEffect(() => { userIdRef.current = userData?._id; }, [userData]);
  useEffect(() => { runnersRef.current = runners; }, [runners]);

  // ── Mobile check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      pendingRequestRef.current = null;
      selectedRunnerIdRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ── Body scroll lock ──────────────────────────────────────────────────────
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

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);
    selectedRunnerIdRef.current = null;
    pendingRequestRef.current = null;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setTimeout(() => { if (typeof onClose === "function") onClose(); }, 200);
  }, [onClose]);

  // ── Helper: advance to chat screen ───────────────────────────────────────
  const advanceToChat = useCallback((runnerId, order) => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    pendingRequestRef.current = null;
    selectedRunnerIdRef.current = null;
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);

    const runnerData = runnersRef.current.find(r => (r._id || r.id) === runnerId);
    onSelectRunner?.(runnerData || { _id: runnerId, id: runnerId }, order);
  }, [onSelectRunner]);

  // ── Core socket events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleProceedToChat = (data) => {
      console.log("[RSS] proceedToChat received:", data.chatId, "| pending:", pendingRequestRef.current?.chatId);

      if (!data.chatReady) return;

      const userId = userIdRef.current;
      const pending = pendingRequestRef.current;
      const expectedId = `user-${userId}-runner-${data.runnerId}`;
      const matches = data.chatId === pending?.chatId || data.chatId === expectedId;

      if (!matches) {
        // Store it — pendingRequestRef may not be set yet (race between emit and listener)
        console.log("[RSS] buffering proceedToChat, no pending match yet");
        proceedBufferRef.current = data;
        return;
      }

      pendingRequestRef.current = null;
      selectedRunnerIdRef.current = null;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      advanceToChat(data.runnerId, currentOrder);
    };

    const handleOrderCreated = (data) => {
      const order = data.order || data;
      setCurrentOrder(order);
    };

    const handleChatReset = (data) => {
      console.log("[RSS] chatReset received:", data.chatId);
      if (pendingRequestRef.current?.chatId === data.chatId) {
        pendingRequestRef.current = null;
        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);
        selectedRunnerIdRef.current = null;
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      }
    };

    const handleRunnerTimeout = (data) => {
      if (data.chatId !== pendingRequestRef.current?.chatId) return;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      pendingRequestRef.current = null;
      selectedRunnerIdRef.current = null;
      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);
      setTimedOutRunnerId(data.runnerId);
    };

    const handleDisconnect = () => setNetworkError(true);
    const handleReconnectSuccess = () => setNetworkError(false);

    socket.on('runnerTimeout', handleRunnerTimeout);
    socket.on('connect', handleReconnectSuccess);
    socket.on("proceedToChat", handleProceedToChat);
    socket.on("orderCreated", handleOrderCreated);
    socket.on("chatReset", handleChatReset);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off("proceedToChat", handleProceedToChat);
      socket.off("orderCreated", handleOrderCreated);
      socket.off("chatReset", handleChatReset);
      socket.off('runnerTimeout', handleRunnerTimeout);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleReconnectSuccess);
    };
  }, [socket, isConnected, advanceToChat, currentOrder]);

  // ── On reconnect: re-emit pending request AND rejoin user room ────────────
  // This is the KEY fix — when socket reconnects with a new ID, the pre-room
  // membership is lost. We rejoin the user room and re-emit the request so the
  // server can re-emit proceedToChat to the new socket.
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReconnect = () => {
      const pending = pendingRequestRef.current;
      const userId = userIdRef.current;

      console.log("[RSS] socket reconnected — pending:", pending?.chatId);

      // Always rejoin user room first
      if (userId) {
        socket.emit("rejoinUserRoom", { userId, userType: "user" });
      }

      if (!pending) return;

      // Re-emit the runner request — server will re-emit proceedToChat
      // if the pre-room is already ready, or queue it if runner hasn't accepted yet
      socket.emit("requestRunner", {
        runnerId: pending.runnerId,
        userId: pending.userId,
        chatId: pending.chatId,
        serviceType: selectedService,
        specialInstructions: specialInstructions || null,
        isReconnect: true, // ← hint to server: don't re-notify runner
      });
    };

    socket.on("connect", handleReconnect);
    return () => socket.off("connect", handleReconnect);
  }, [socket, isConnected, selectedService, specialInstructions]);

  // ── Send runner request ───────────────────────────────────────────────────
  const doRequest = useCallback((runnerId, userId) => {
    console.log("[RSS] doRequest → runnerId:", runnerId, "userId:", userId);

    // Debounce: block duplicate requests to same runner within 15s
    if (pendingRequestRef.current) {
      const same = pendingRequestRef.current.runnerId === runnerId;
      const recent = Date.now() - pendingRequestRef.current.timestamp < 35000;
      if (same && recent) {
        console.warn("[RSS] BLOCKED — already waiting for this runner");
        return;
      }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      pendingRequestRef.current = null;
      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);
      selectedRunnerIdRef.current = null;
    }

    const chatId = `user-${userId}-runner-${runnerId}`;

    pendingRequestRef.current = { runnerId, userId, chatId, serviceType: selectedService, timestamp: Date.now() };
    selectedRunnerIdRef.current = runnerId;
    setSelectedRunnerId(runnerId);
    setIsWaitingForRunner(true);

    // Consume buffered proceedToChat if it already arrived
    if (proceedBufferRef.current?.chatId === chatId) {
      console.log("[RSS] consuming buffered proceedToChat");
      const buffered = proceedBufferRef.current;
      proceedBufferRef.current = null;
      advanceToChat(buffered.runnerId, currentOrder);
      return;
    }

    socket.emit("requestRunner", {
      runnerId,
      userId,
      chatId,
      serviceType: selectedService,
      specialInstructions: specialInstructions || null,
    });

    // Timeout after 15s
    timeoutRef.current = setTimeout(() => {
      if (pendingRequestRef.current?.runnerId === runnerId) {
        pendingRequestRef.current = null;
        selectedRunnerIdRef.current = null;
        timeoutRef.current = null;
        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);
        setTimedOutRunnerId(runnerId);
      }
    }, 15000);
  }, [socket, selectedService, specialInstructions, advanceToChat, currentOrder]);

  const handleRunnerClick = useCallback((runner) => {
    const runnerId = runner._id || runner.id;
    const userId = userData?._id;

    if (!socket || !userId) { alert("Connection issue. Please try again."); return; }

    if (!isConnected) {
      socket.connect();
      let attempts = 0;
      const wait = setInterval(() => {
        attempts++;
        if (socket.connected) { clearInterval(wait); doRequest(runnerId, userId); }
        else if (attempts >= 10) { clearInterval(wait); alert("Could not reconnect. Check your connection."); }
      }, 500);
      return;
    }

    doRequest(runnerId, userId);
  }, [socket, isConnected, userData, doRequest]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onTouchStart={(e) => e.preventDefault()}
      />

      <div className="fixed bottom-0 left-0 right-0 z-[10000] flex justify-center px-4">
        <div
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"}
            rounded-t-3xl shadow-2xl
            lg:h-full h-[85vh]
            w-full max-w-4xl mx-auto
            flex flex-col
            transition-transform duration-300 ease-out
            ${isVisible ? "translate-y-0" : "translate-y-full"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-black dark:text-white">
              Available Runners Nearby
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 pb-8 min-h-0">
            {error || runners.length === 0 ? (
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

                {networkError && (
                  <div className={`rounded-2xl p-4 mb-4 border ${darkMode ? "bg-amber-950/40 border-amber-800/40" : "bg-amber-50 border-amber-200"}`}>
                    <p className={`text-sm font-semibold ${darkMode ? "text-amber-300" : "text-amber-700"}`}>
                      Connection lost — reconnecting, your request is preserved.
                    </p>
                  </div>
                )}

                {timedOutRunnerId && (
                  <div className={`rounded-2xl p-4 mb-4 border ${darkMode ? "bg-red-950/40 border-red-800/40" : "bg-red-50 border-red-200"}`}>
                    <p className={`text-sm font-semibold mb-2 ${darkMode ? "text-red-300" : "text-red-700"}`}>
                      {runners.find(r => (r._id || r.id) === timedOutRunnerId)?.firstName || 'Runner'} didn't respond.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const runner = runners.find(r => (r._id || r.id) === timedOutRunnerId);
                          setTimedOutRunnerId(null);
                          if (runner) handleRunnerClick(runner);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 text-white active:scale-95"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => setTimedOutRunnerId(null)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border active:scale-95 ${darkMode ? "border-red-700 text-red-300" : "border-red-300 text-red-600"}`}
                      >
                        Choose another
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {runners.map((runner) => {
                    const rid = runner._id || runner.id;
                    const isThisWaiting = isWaitingForRunner && selectedRunnerId === rid;
                    return (
                      <Card
                        key={rid}
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
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const full = runner.rating >= star;
                                  const half = !full && runner.rating >= star - 0.5;
                                  return (
                                    <div key={star} className="relative h-4 w-4 flex-shrink-0">
                                      <Star className="absolute h-4 w-4" style={{ fill: "none", color: "#c0c4ca" }} />
                                      {full && <Star className="absolute h-4 w-4" style={{ fill: "#facc15", color: "#facc15" }} />}
                                      {half && (
                                        <div className="absolute overflow-hidden" style={{ width: "50%" }}>
                                          <Star className="h-4 w-4" style={{ fill: "#facc15", color: "#facc15" }} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <span className="text-sm ml-1" style={{ color: "#6b7280" }}>
                                  {runner.rating > 0 ? Number(runner.rating).toFixed(1) : "New"}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span>{runner.totalRuns || 0} deliveries</span>
                              <div className="flex items-center gap-2">
                                <Chip value={runner.fleetType || "N/A"} size="sm" className="capitalize" color="blue" />
                                {runner.isOnline && <Chip value="Online" size="sm" color="green" />}
                              </div>
                            </div>
                          </div>
                          {isThisWaiting && (
                            <div className="ml-3 w-4 h-4 flex-shrink-0">
                              <BarLoader size="small" />
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center gap-2 pt-3">
                  <button
                    onClick={async () => {
                      setTopRatedLoading(true);
                      setTopRatedStatus(null);
                      try {
                        await onFetchTopRated();
                        setTopRatedStatus("success");
                      } catch {
                        setTopRatedStatus("error");
                      } finally {
                        setTopRatedLoading(false);
                        setTimeout(() => setTopRatedStatus(null), 3000);
                      }
                    }}
                    disabled={topRatedLoading}
                    className={`text-sm font-semibold border rounded-lg px-5 py-2 transition flex items-center gap-2
                      ${topRatedLoading
                        ? "text-yellow-300 border-yellow-300 opacity-60 cursor-not-allowed"
                        : "text-yellow-500 border-yellow-500 hover:bg-yellow-500/10"
                      }`}
                  >
                    {topRatedLoading ? (
                      <><BarLoader size="small" /><span>Fetching...</span></>
                    ) : (
                      "⭐ Show Top Rated Runner"
                    )}
                  </button>
                  {topRatedStatus === "success" && <p className="text-xs text-green-500 font-medium">✓ Top rated runners loaded</p>}
                  {topRatedStatus === "error" && <p className="text-xs text-red-400 font-medium">✗ Failed to fetch. Try again.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}