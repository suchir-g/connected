import React, { useState } from "react";
import { auth } from "../../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import Loading from "../../components/loading/Loading";
import { getFirebaseErrorMessage } from "../../config/errors";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); 

  const navigate = useNavigate();

  const { darkMode } = useTheme(); 

  const signInEmailPassword = async () => {
    setError("");
    setLoading(true); 
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      const friendlyMessage = getFirebaseErrorMessage(err);
      setError(friendlyMessage);
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div
      className={`container mt-5 ${darkMode ? "bg-dark text-white" : ""}`}
      style={{ minHeight: "100vh", padding: "20px" }}
    >
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card-body">
            <h2 className="card-title text-center mb-4">Login</h2>

            {error && (
              <div className="alert alert-danger w-100" role="alert">
                {error}
              </div>
            )}

            {loading && <Loading />}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                signInEmailPassword();
              }}
            >
              <div className="mb-3">
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <input
                  type="email"
                  className={`form-control ${
                    darkMode ? "bg-dark text-white" : ""
                  }`}
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  className={`form-control ${
                    darkMode ? "bg-dark text-white" : ""
                  }`}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={loading} 
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="mt-3 text-center">
              <p>
                Don't have an account?{" "}
                <Link to="/register" className="link-primary">
                  Register here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
