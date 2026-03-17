import ProjectedRoutes from "./route";
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import BarLoader from "./components/common/BarLoader";


export default function App() {
  const isReady = useAuthBootstrap();

  if (!isReady) {
    return <BarLoader fullScreen/>;
  }

  return <ProjectedRoutes />;
}