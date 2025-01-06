import React, { useState } from "react";
import { auth, db } from "../../config/firebase";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  signOut,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";

const Settings = () => {
  const user = auth.currentUser;
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");
    if (!user) {
      setError("No user is logged in.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);
      setSuccess("Password updated successfully.");
      setNewPassword("");
      setCurrentPassword("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );
    if (!confirmDelete) return;

    try {
      if (!user) {
        setError("No user is logged in.");
        return;
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      await deleteDoc(doc(db, "players", user.uid));

      await deleteUser(user);

      await signOut(auth);
      window.location.reload(); 
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.reload(); 
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Profile</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <div>
        <h3>Change Password</h3>
        <input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button onClick={handleChangePassword}>Change Password</button>
      </div>

      <hr />

      <div>
        <h3>Delete Account</h3>
        <input
          type="password"
          placeholder="Confirm with Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <button
          onClick={handleDeleteAccount}
        >
          Delete Account
        </button>
      </div>

      <hr />

      <div>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    </div>
  );
};

export default Settings;
