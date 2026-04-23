import { useEffect, useState } from 'react';
import ProjectedRoutes from "./route";
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import BarLoader from "./components/common/BarLoader";
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSocket } from './hooks/useSocket';
import SplashScreen from "./components/common/SplashScreen";
import { useSelector } from "react-redux";

export default function App() {
  const { socket } = useSocket();
  const isReady = useAuthBootstrap();
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('splash_done') === 'true' // ← read on init
  );
  const authStatus = useSelector(s => s.auth.status);
  const [, setMinTimePassed] = useState(false);

  useEffect(() => {
    // Only wire up on native — pointless on web
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && socket && !socket.connected) {
        socket.connect();
      }
    });

    // Clean up listener on unmount
    return () => {
      listener.then(l => l.remove());
    };
  }, [socket]);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 2000); // min 2s
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authStatus !== "idle" && authStatus !== "loading" && isReady) {
      const t = setTimeout(() => {
        sessionStorage.setItem('splash_done', 'true'); // ← persist
        setSplashDone(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [authStatus, isReady, splashDone]);

  if (!splashDone) return <SplashScreen />;

  if (!isReady) {
    return <BarLoader fullScreen />;
  }

  return <ProjectedRoutes />;
}