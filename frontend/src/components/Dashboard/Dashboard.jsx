import React from 'react';
import CommunityArea from './CommunityArea';
import ProjectArea from './ProjectArea';
import ChatArea from './ChatArea';
import UserProfile from './UserProfile';
import JobSection from './JobSection';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <UserProfile />
            <CommunityArea />
            <ProjectArea />
            <ChatArea />
            <JobSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 