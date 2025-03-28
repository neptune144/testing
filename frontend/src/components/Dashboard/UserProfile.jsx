import React from 'react';
import { useAuth } from '../../context/AuthContext';

const UserProfile = () => {
  const { user, logout } = useAuth();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Profile</h2>
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <div className="space-y-2">
            <p><span className="font-semibold">Username:</span> {user?.username}</p>
            <p><span className="font-semibold">Name:</span> {user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 