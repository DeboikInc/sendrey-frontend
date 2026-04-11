import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { isCapacitor } from "../../utils/api";

export default function ProtectedRoute({ children }) {
  const { user, token, runner, runnerToken } = useSelector((s) => s.auth);

  const isAuthenticated = isCapacitor
    ? (user && token) || (runner && runnerToken)
    : user || runner;                              

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}