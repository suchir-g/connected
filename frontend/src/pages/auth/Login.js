import React, { useState, useContext } from "react";
import { auth } from "../../config/firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { setCurrentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const signInEmailPassword = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      setCurrentUser(userCredential.user);

      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button onClick={signInEmailPassword}>Sign In</button>
    </div>
  );
};

export default Login;
