import React from "react";
import FriendsList from "../../components/friends/FriendsList";
import FriendRequests from "../../components/friends/FriendRequests";
import SearchUser from "../../components/friends/SearchUser";
import FriendRecommendations from "../../components/friends/FriendRecommendations";

const Social = () => {
  return (
    <div className="container mt-4">
      <h2>Social</h2>
      <div className="row">
        <div className="col-md-4">
          <FriendsList />
        </div>
        <div className="col-md-4">
          <FriendRequests />
        </div>
        <div className="col-md-4">
          <SearchUser />
        </div>
      </div>
      <div className="row">
        <div className="col-md-4">
          <FriendRecommendations />
        </div>
      </div>
    </div>
  );
};

export default Social;
