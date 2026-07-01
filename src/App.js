import { useEffect, useState } from 'react';
import ProjectedRoutes from "./route";
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import BarLoader from "./components/common/BarLoader";
// import { useSocket } from './hooks/useSocket';
import SplashScreen from "./components/common/SplashScreen";
import { useSelector } from "react-redux";

const safeSession = {
  get: (key) => { try { return sessionStorage.getItem(key); } catch { return null; } },
  set: (key, val) => { try { sessionStorage.setItem(key, val); } catch { } }
};

export default function App() {
  // const { socket } = useSocket();
  const isReady = useAuthBootstrap();
  const [splashDone, setSplashDone] = useState(
    () => safeSession.get('splash_done') === 'true'
  );
  // const runnerInStore = useSelector(s => s.auth.runner);
  const authStatus = useSelector(s => s.auth.status);
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSession.set('splash_done', 'true');
      setSplashDone(true);
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authStatus !== "idle" && authStatus !== "loading" && isReady) {
      const t = setTimeout(() => {
        safeSession.set('splash_done', 'true');
        setSplashDone(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [minTimePassed, authStatus, isReady]);

  if (!splashDone) return <SplashScreen />;
  if (!isReady) return <BarLoader fullScreen />;

  return <ProjectedRoutes />;
}