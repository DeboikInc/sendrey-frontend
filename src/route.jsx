import { Routes, Route } from "react-router";
import WhatsAppLikeChat from "./pages/Raw";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { Welcome } from "./pages/Welcome";
import { Profile } from "./pages/Profile"
import { Location } from "./pages/Location"
import { Wallet } from "./pages/Wallet";
import { OngoingOrders } from "./pages/OngoingOrders";
import { OrderDetail } from "./components/common/OrderDetail";
import { TrackDeliveryScreen } from "./components/screens/TrackDeliveryScreen.jsx";

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
      <Route path="ongoing-orders" element={<OngoingOrders />} />
      <Route path="track-delivery" element={<TrackDeliveryScreen />} />
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


