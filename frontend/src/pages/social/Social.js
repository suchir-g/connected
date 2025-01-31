import React from "react";
import FriendsList from "../../components/friends/FriendsList";
import FriendRequests from "../../components/friends/FriendRequests";
import SearchUser from "../../components/friends/SearchUser";
import FriendRecommendations from "../../components/friends/FriendRecommendations";

const Social = () => {
  return (
    <div className="container mt-4" style={{ minHeight: "100vh" }}>
      <h2 className="mb-4">Social</h2>

      <div className="row mb-4">
        <div className="col-12">
          <div className="p-3 border rounded-3">
            <SearchUser />
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-4 col-md-6">
          <div className="p-3 border rounded-3 h-100">
            <FriendsList />
          </div>
        </div>
        <div className="col-lg-4 col-md-6">
          <div className="p-3 border rounded-3 h-100">
            <FriendRequests />
          </div>
        </div>
        <div className="col-lg-4 col-md-12">
          <div className="p-3 border rounded-3 h-100">
            <FriendRecommendations />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Social;
