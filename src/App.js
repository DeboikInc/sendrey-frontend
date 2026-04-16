import { useEffect, } from 'react';
import ProjectedRoutes from "./route";
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import BarLoader from "./components/common/BarLoader";
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const { socket } = useSocket();
  const isReady = useAuthBootstrap();

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

  if (!isReady) {
    return <BarLoader fullScreen />;
  }

  return <ProjectedRoutes />;
}