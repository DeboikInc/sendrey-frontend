// components/common/ProtectedRoute.jsx
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { user, token } = useSelector((s) => s.auth);

  if (!user || !token) {
    return <Navigate to="/" replace />;
  }

  return children;
}