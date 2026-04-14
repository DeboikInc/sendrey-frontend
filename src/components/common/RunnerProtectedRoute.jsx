// components/common/RunnerProtectedRoute.jsx
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router';

export default function RunnerProtectedRoute({ children }) {
  const { runner, token } = useSelector((s) => s.auth);

  // Token exists in store or storage — let the app mount and fetch /runner/me
  if (!token && !runner?._id) {
    return <Navigate to="/raw" replace />;
  }

  return children;
}