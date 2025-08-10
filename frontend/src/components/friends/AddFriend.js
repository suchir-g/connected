import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import './Friends.css';

const AddFriend = ({ targetUsername }) => {
  const { currentUser, userData } = useAuth();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendFriendRequest = async () => {
    if (!currentUser || !userData || !targetUsername) {
      setError('Missing required information');
      return;
    }

    if (targetUsername === userData.username) {
      setError("You can't add yourself as a friend");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Check if friend request already exists
      const existingRequestQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', userData.username),
        where('to', '==', targetUsername)
      );
      const existingRequests = await getDocs(existingRequestQuery);

      if (!existingRequests.empty) {
        setError('Friend request already sent');
        setLoading(false);
        return;
      }

      // Check if they're already friends
      const friendshipQuery = query(
        collection(db, 'friendRequests'),
        where('from', 'in', [userData.username, targetUsername]),
        where('to', 'in', [userData.username, targetUsername]),
        where('status', '==', 'accepted')
      );
      const friendships = await getDocs(friendshipQuery);

      if (!friendships.empty) {
        setError('You are already friends with this user');
        setLoading(false);
        return;
      }

      // Send friend request
      await addDoc(collection(db, 'friendRequests'), {
        from: userData.username,
        to: targetUsername,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      setMessage('Friend request sent successfully!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      setError('Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-friend-container">
      <button 
        className={`btn ${darkMode ? 'btn-outline-light' : 'btn-outline-primary'} btn-sm`}
        onClick={handleSendFriendRequest}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Sending...
          </>
        ) : (
          'Add Friend'
        )}
      </button>
      
      {message && (
        <div className="alert alert-success mt-2 mb-0 py-2" role="alert">
          <small>{message}</small>
        </div>
      )}
      
      {error && (
        <div className="alert alert-danger mt-2 mb-0 py-2" role="alert">
          <small>{error}</small>
        </div>
      )}
    </div>
  );
};

export default AddFriend;
