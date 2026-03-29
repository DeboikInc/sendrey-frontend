import { Routes, Route } from "react-router";
import WhatsAppLikeChat from "./pages/runner/Raw";
import { Home } from "./pages/user/Home";
import { Auth } from "./pages/user/Auth";
import { Welcome } from "./pages/user/Welcome";
import { Profile } from "./pages/runner/Profile"
import { Wallet } from "./pages/runner/Wallet";
import { Orders } from "./pages/runner/Orders";
import Landing from "./pages/Landing";
import { Payout } from "./pages/runner/Payout";

import ProtectedRoute from "./components/common/ProtectedRoute";
// import RunnerProtectedRoute from "./components/common/RunnerProtectedRoute";


export default function ProjectedRoutes() {
  return (
    <Routes>
      <Route path="/raw" element={<WhatsAppLikeChat />} />
      <Route path="/auth" element={<Auth />} />

      <Route path="/welcome" element={
        <ProtectedRoute>
          <Welcome />
        </ProtectedRoute>
      } />

      <Route path="/profile" element={<Profile />} />

      <Route path="/all-orders" element={<Orders />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/wallet" element={
        // <RunnerProtectedRoute>
        // </RunnerProtectedRoute>
          <Wallet />
      } />

      <Route path="/payout" element={
        // <RunnerProtectedRoute>
        // </RunnerProtectedRoute>
          <Payout />
      } />

      <Route path="/" element={<Home />} />

      {/* <Route path="/reg" element={<BankHome />} /> */}
    </Routes>
  )
}


