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
import ToggleThemeButton from "../../components/navbar/ToggleThemeButton";
import { useTheme } from "../../contexts/ThemeContext";

const Settings = () => {
  const user = auth.currentUser;
  const { darkMode } = useTheme(); // Access darkMode from ThemeContext
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentDeletePassword, setCurrentDeletePassword] = useState("");

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
        currentDeletePassword
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
    <div className="container my-5">
      <h2 className="mb-4 text-center">Profile Settings</h2>

      {/* Display Error and Success Messages */}
      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
        >
          {error}
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
            onClick={() => setError("")}
          ></button>
        </div>
      )}
      {success && (
        <div
          className="alert alert-success alert-dismissible fade show"
          role="alert"
        >
          {success}
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="alert"
            aria-label="Close"
            onClick={() => setSuccess("")}
          ></button>
        </div>
      )}

      {/* Change Password Section */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Change Password</h5>
        </div>
        <div className="card-body">
          <form>
            <div className="mb-3">
              <label htmlFor="currentPassword" className="form-label">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                className="form-control"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="newPassword" className="form-label">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                className="form-control"
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <div id="passwordHelp" className="form-text">
                Password must be at least 6 characters long.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleChangePassword}
            >
              Change Password
            </button>
          </form>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Delete Account</h5>
        </div>
        <div className="card-body">
          <form>
            <div className="mb-3">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm with Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                className="form-control"
                placeholder="Enter your password to confirm"
                value={currentDeletePassword}
                onChange={(e) => setCurrentDeletePassword(e.target.value)}
                required
              />
              <div id="deleteHelp" className="form-text text-danger">
                This action cannot be undone.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteAccount}
            >
              Delete Account
            </button>
          </form>
        </div>
      </div>

      {/* Sign Out Section */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Sign Out</h5>
        </div>
        <div className="card-body">
          <button className="btn btn-secondary" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Toggle Theme Button */}
      <div className="text-center">
        <ToggleThemeButton />
      </div>
    </div>
  );
};

export default Settings;
