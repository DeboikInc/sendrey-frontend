import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { isCapacitor } from "../../utils/api";

export default function ProtectedRoute({ children }) {
  const user = useSelector(s => s.auth.user);
  const token = useSelector(s => s.auth.token);
  const runner = useSelector(s => s.auth.runner);
  const runnerToken = useSelector(s => s.auth.runnerToken);

  const isAuthenticated = isCapacitor
    ? (user && token) || (runner && runnerToken)
    : user || runner;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}