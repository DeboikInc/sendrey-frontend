import { Routes, Route } from "react-router";
import WhatsAppLikeChat from "./pages/runner/Raw";
import { Home } from "./pages/user/Home";
import { Auth } from "./pages/user/Auth";
import { Welcome } from "./pages/user/Welcome";
import { Profile } from "./pages/runner/Profile"
import { Location } from "./pages/runner/Location"
import { Wallet } from "./pages/runner/Wallet";
import { OngoingOrders } from "./pages/runner/OngoingOrders";
import Landing from "./pages/Landing";

export default function ProjectedRoutes() {
  return (
    <Routes>
      <Route path="raw" element={<WhatsAppLikeChat />} />
      <Route path="" element={<Home />} />
      <Route path="auth" element={<Auth />} />
      <Route path="welcome" element={<Welcome />} />
      <Route path="profile" element={<Profile />} />
      <Route path="locations" element={<Location />} />
      <Route path="wallet" element={<Wallet />} />
      <Route path="landing" element={<Landing/>} />
      {/* 
      <Route path="track-delivery" element={<TrackDeliveryScreen />} /> */}
      {/* <Route path="order" element={<OrderDetail />} /> */}

      {/* <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route> */}

      {/* <Route path="concerts">
        <Route index element={<ConcertsHome />} />
        <Route path=":city" element={<City />} />
        <Route path="trending" element={<Trending />} />
      </Route> */}

    </Routes>
  )
}


