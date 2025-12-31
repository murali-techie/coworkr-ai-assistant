'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchTeamUsers();
    fetchCurrentUser();
  }, []);

  const fetchTeamUsers = async () => {
    try {
      const res = await fetch('/api/team/users?includeWorkload=true');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error('Failed to fetch team users:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    // Get current user from cookie
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      acc[key] = val;
      return acc;
    }, {});
    const userId = cookies['coworkr_user_id'];
    if (userId) {
      const user = users.find(u => u.id === userId);
      setCurrentUser(user || { id: userId });
    }
  };

  useEffect(() => {
    if (users.length > 0) {
      fetchCurrentUser();
    }
  }, [users]);

  const switchUser = async (user) => {
    // Set cookie to switch user (for demo purposes)
    document.cookie = `coworkr_user_id=${user.id}; path=/; max-age=86400`;
    document.cookie = `coworkr_session=demo-session; path=/; max-age=86400`;
    setCurrentUser(user);
    setShowSwitchModal(false);
    // Reload to refresh data
    window.location.reload();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'manager': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getWorkloadColor = (score) => {
    if (score <= 5) return 'text-green-600 bg-green-50';
    if (score <= 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getWorkloadLabel = (score) => {
    if (score <= 5) return 'Light';
    if (score <= 10) return 'Moderate';
    return 'Heavy';
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500',
      'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const index = name?.charCodeAt(0) % colors.length || 0;
    return colors[index];
  };

  // Sort users by workload (least busy first)
  const sortedUsers = [...users].sort((a, b) =>
    (a.workload?.score || 0) - (b.workload?.score || 0)
  );

  const leastBusy = sortedUsers[0];
  const mostBusy = sortedUsers[sortedUsers.length - 1];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">
            {users.length} team members
          </p>
        </div>

        {currentUser && (
          <button
            onClick={() => setShowSwitchModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            <div className={`w-6 h-6 rounded-full ${getAvatarColor(currentUser.firstName)} flex items-center justify-center text-white text-xs font-medium`}>
              {getInitials(currentUser.firstName, currentUser.lastName)}
            </div>
            <span>Switch User</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </button>
        )}
      </div>

      {/* Workload Summary */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500">Least Busy</p>
                <p className="text-sm font-medium text-slate-900">
                  {leastBusy ? `${leastBusy.firstName} ${leastBusy.lastName}` : '-'}
                </p>
                <p className="text-xs text-green-600">
                  {leastBusy?.workload?.openTasks || 0} open tasks
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500">Most Busy</p>
                <p className="text-sm font-medium text-slate-900">
                  {mostBusy ? `${mostBusy.firstName} ${mostBusy.lastName}` : '-'}
                </p>
                <p className="text-xs text-red-600">
                  {mostBusy?.workload?.openTasks || 0} open tasks
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Open Tasks</p>
                <p className="text-sm font-medium text-slate-900">
                  {users.reduce((sum, u) => sum + (u.workload?.openTasks || 0), 0)}
                </p>
                <p className="text-xs text-blue-600">
                  {users.reduce((sum, u) => sum + (u.workload?.highPriorityTasks || 0), 0)} high priority
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Members Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded w-full mb-2" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors ${
                currentUser?.id === user.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full ${getAvatarColor(user.firstName)} flex items-center justify-center text-white font-medium`}>
                  {getInitials(user.firstName, user.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-900 truncate">
                      {user.firstName} {user.lastName}
                    </h3>
                    {currentUser?.id === user.id && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">You</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{user.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                    <span className="text-xs text-slate-400">{user.department}</span>
                  </div>
                </div>
              </div>

              {/* Workload */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Workload</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getWorkloadColor(user.workload?.score || 0)}`}>
                    {getWorkloadLabel(user.workload?.score || 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{user.workload?.openTasks || 0}</p>
                    <p className="text-xs text-slate-500">Open</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-orange-600">{user.workload?.highPriorityTasks || 0}</p>
                    <p className="text-xs text-slate-500">High</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-600">{user.workload?.tasksDueToday || 0}</p>
                    <p className="text-xs text-slate-500">Due Today</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setShowSwitchModal(true);
                  }}
                  className="flex-1 text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  View as User
                </button>
                <button
                  onClick={() => window.location.href = `/tasks?assignee=${user.id}`}
                  className="flex-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  View Tasks
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Switch User Modal */}
      {showSwitchModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowSwitchModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Switch User</h2>
                <button
                  onClick={() => setShowSwitchModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-slate-500 mb-4">
                  Select a team member to view the app as them (demo mode)
                </p>
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => switchUser(user)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        currentUser?.id === user.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.firstName)} flex items-center justify-center text-white text-sm font-medium`}>
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-slate-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{user.title} - {user.email}</p>
                      </div>
                      {currentUser?.id === user.id && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Current</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
