import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div
      className="container text-center"
      style={{ minHeight: "100vh", padding: "80px 20px" }}
    >
      <h1 className="display-3">404</h1>
      <h2 className="mb-4">Page Not Found</h2>
      <p className="mb-4">
        I don't know what page you want go to but here's the link to go home
      </p>
      <Link to="/" className="btn btn-primary">
        Go Home
      </Link>
    </div>
  );
};

export default NotFound;
