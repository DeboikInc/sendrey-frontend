import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

export default function RunnerProtectedRoute({ children }) {
  const { runner, token } = useSelector((s) => s.auth);

  if (!runner || !token) {
    return <Navigate to="/raw" replace />;
  }

  return children;
}