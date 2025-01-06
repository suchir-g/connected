import React, { useState, useContext, useEffect } from "react";
import { auth, db } from "../../config/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext"; 

const Register = () => {
  const { currentUser } = useContext(AuthContext); 
  const navigate = useNavigate();

  const [username, setUsername] = useState(""); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); 

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard");
    }
  }, [currentUser, navigate]);

  const isUsernameUnique = async (username) => {
    try {
      const normalizedUsername = username.toLowerCase(); // Normalize to lowercase
      const usersRef = collection(db, "players");
      const q = query(usersRef, where("username", "==", normalizedUsername));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (err) {
      console.error("Error checking username uniqueness:", err);
      throw new Error(`Failed to verify username uniqueness: ${err.message}`);
    }
  };

  const registerEmailPassword = async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      setError("Username is required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setError("");
    setLoading(true); 

    try {
      const unique = await isUsernameUnique(trimmedUsername);
      if (!unique) {
        setError("Username is already taken. Please choose another one.");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: trimmedUsername,
      });

      await setDoc(doc(db, "players", user.uid), {
        email: user.email,
        username: trimmedUsername.toLowerCase(), 
      });

      navigate("/dashboard");
    } catch (err) {
      console.error("Registration error:", err);
      let errorMessage = "Registration failed. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already in use.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      } else if (err.message.includes("username uniqueness")) {
        errorMessage =
          "Can't verify username uniqueness. Please try again.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div>
      <h2>Register</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Username Field */}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required // Added required attribute
      />

      {/* Email Field */}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required // Added required attribute
      />

      {/* Password Field */}
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required // Added required attribute
      />

      {/* Confirm Password Field */}
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required // Added required attribute
      />

      {/* Register Button */}
      <button onClick={registerEmailPassword} disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>
    </div>
  );
};

export default Register;
