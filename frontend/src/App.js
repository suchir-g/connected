import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Navbar from "./components/navbar/Navbar";
import Footer from "./components/footer/Footer";

import Landing from "./pages/landing/LandingPage";
import Dashboard from "./pages/dashboard/Dashboard";

import Register from "./pages/auth/Register";
import Login from "./pages/auth/Login";
import Settings from "./pages/auth/Settings";

import PlayLocal from "./pages/play/local/PlayLocal";
import PlayBot from "./pages/play/bot/PlayBot";

import Stats from "./pages/stats/Stats";

import PositionTrainer from "./pages/training/PositionTrainer";

import Profile from "./pages/social/Profile";
import Social from "./pages/social/Social";

import ReviewGame from "./pages/review/ReviewGame";
import SearchUser from "./components/friends/SearchUser";

import Loading from "./components/loading/Loading";
import NotFound from "./pages/404";
const App = () => {
  return (
    <div className="mainContainer">
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          <Route path="/player/:username" element={<Profile />} />
          <Route path="/review/:playerId/:gameId" element={<ReviewGame />} />

          <Route path="/trainer" element={<PositionTrainer />} />

          <Route path="/search" element={<SearchUser />} />
          <Route path="/social" element={<Social />} />

          <Route path="/loading" element={<Loading />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/play/local"
            element={
              <ProtectedRoute>
                <PlayLocal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/play/bot"
            element={
              <ProtectedRoute>
                <PlayBot />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </Router>
    </div>
  );
};

export default App;
