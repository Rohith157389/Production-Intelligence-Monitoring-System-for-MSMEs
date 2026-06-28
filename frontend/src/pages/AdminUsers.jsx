import { useState, useEffect } from 'react';
import api from '../api/client';
import { KPICard, THEME } from '../components/IndustrialUI';

export default function AdminUsers() {
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'activities'
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/users'),
      api.get('/users/activity')
    ])
      .then(([usersRes, activityRes]) => {
        setUsers(usersRes.data);
        setActivities(activityRes.data);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load user and activity logs');
      })
      .finally(() => setLoading(false));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearch('');
  };

  const filteredUsers = users.filter(user => {
    const q = appliedSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (user.full_name || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q) ||
      (user.role || '').toLowerCase().includes(q) ||
      (user.industry_name || '').toLowerCase().includes(q) ||
      (user.location || '').toLowerCase().includes(q)
    );
  });

  const filteredActivities = activities.filter(act => {
    const q = appliedSearch.toLowerCase().trim();
    if (!q) return true;
    const details = act.details || {};
    const methodLabel = details.method === 'google' ? 'Google Auth' : (details.method === 'email' ? 'Email/Password' : '');
    return (
      (act.full_name || '').toLowerCase().includes(q) ||
      (act.email || '').toLowerCase().includes(q) ||
      (act.activity_type || '').toLowerCase().includes(q) ||
      methodLabel.toLowerCase().includes(q)
    );
  });

  // Calculate metrics
  const totalUsers = users.length;
  const uniqueLoggedInToday = new Set(
    activities
      .filter(act => {
        const date = new Date(act.created_at);
        const today = new Date();
        return date.toDateString() === today.toDateString();
      })
      .map(act => act.email)
  ).size;
  const loginCount = activities.filter(act => act.activity_type === 'login').length;

  const handleSelectUser = (user) => {
    setSelectedUser(selectedUser?.id === user.id ? null : user);
  };

  const handleViewUserActivity = (userEmail) => {
    setActiveTab('activities');
    setSearchQuery(userEmail);
    setAppliedSearch(userEmail);
    setSelectedUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Administration</h1>
          <p className="text-gray-500 text-sm mt-1">Manage users, view login methods, and track access logs.</p>
        </div>
        <button
          onClick={fetchData}
          className="btn-secondary flex items-center gap-2 self-end sm:self-auto"
        >
          <span>🔄</span> Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Total Registered Users" value={totalUsers} color="#6366F1" />
        <KPICard label="Active Users Today" value={uniqueLoggedInToday} color="#22C55E" />
        <KPICard label="Total Login Logs" value={loginCount} color="#F59E0B" />
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className={`bg-white shadow rounded-lg overflow-hidden border border-gray-200 ${selectedUser && activeTab === 'users' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {/* Card Header with Tabs and Search */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Tab Switcher */}
              <div className="flex border-b border-gray-200 md:border-b-0 gap-4">
                <button
                  onClick={() => {
                    setActiveTab('users');
                    setSelectedUser(null);
                  }}
                  className={`pb-2 md:pb-0 px-1 font-semibold text-sm transition-colors border-b-2 ${
                    activeTab === 'users'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Registered Users ({totalUsers})
                </button>
                <button
                  onClick={() => setActiveTab('activities')}
                  className={`pb-2 md:pb-0 px-1 font-semibold text-sm transition-colors border-b-2 ${
                    activeTab === 'activities'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  User Activity Logs ({activities.length})
                </button>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      activeTab === 'users'
                        ? 'Search users...'
                        : 'Search activity logs...'
                    }
                    className="w-full pl-9 pr-8 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Search
                </button>
              </form>
            </div>

            {/* List/Table */}
            <div className="overflow-x-auto">
              {activeTab === 'users' ? (
                /* Users Table */
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className={`cursor-pointer transition-colors ${
                          selectedUser?.id === user.id ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-inner">
                              {user.full_name ? user.full_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{user.full_name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.industry_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.location || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewUserActivity(user.email)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-5 hover:bg-indigo-100 px-2.5 py-1 rounded transition-colors"
                            title="View Activity Logs"
                          >
                            Logs
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                          No users found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* Activity Logs Table */
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredActivities.map((act) => {
                      const details = act.details || {};
                      const methodLabel = details.method === 'google' ? 'Google Auth' : (details.method === 'email' ? 'Email/Password' : '-');

                      return (
                        <tr key={act.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{act.full_name}</div>
                            <div className="text-xs text-gray-500">{act.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              act.activity_type === 'login' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {act.activity_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {methodLabel}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(act.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredActivities.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-sm text-gray-500">
                          No activity logs found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* User Details Sidebar (only visible when a user is selected and we are on Users tab) */}
          {activeTab === 'users' && selectedUser && (
            <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden flex flex-col h-fit lg:col-span-1">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">User Profile</h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* User Card Header */}
                <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-gray-100">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-2xl shadow-inner">
                    {selectedUser.full_name ? selectedUser.full_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900">{selectedUser.full_name}</h4>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    selectedUser.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedUser.role.toUpperCase()}
                  </span>
                </div>

                {/* Profile Fields */}
                <div className="grid grid-cols-2 gap-4 text-sm pb-6 border-b border-gray-100">
                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold">Location</span>
                    <p className="text-gray-800 font-medium mt-0.5">{selectedUser.location || 'Not Specified'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold">Industry</span>
                    <p className="text-gray-800 font-medium mt-0.5">{selectedUser.industry_name || 'Not Specified'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Registration Date</span>
                    <p className="text-gray-800 font-medium mt-0.5">
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Mini Activity Feed */}
                <div>
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h5>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {activities.filter(a => a.email === selectedUser.email).slice(0, 5).map((act) => {
                      const details = act.details || {};
                      const method = details.method === 'google' ? 'Google' : (details.method === 'email' ? 'Email/Password' : '');
                      return (
                        <div key={act.id} className="flex justify-between items-start gap-2 p-2 rounded bg-gray-50 border border-gray-100">
                          <div>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                              act.activity_type === 'login' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {act.activity_type}
                            </span>
                            {method && <span className="text-[10px] text-gray-400 ml-1.5">via {method}</span>}
                          </div>
                          <span className="text-[10px] text-gray-400 text-right">
                            {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                    {activities.filter(a => a.email === selectedUser.email).length === 0 && (
                      <p className="text-xs text-gray-500 italic text-center py-4 bg-gray-50 rounded">No login history recorded.</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2">
                  <button
                    onClick={() => handleViewUserActivity(selectedUser.email)}
                    className="w-full py-2 bg-indigo-600 text-white font-semibold text-sm rounded hover:bg-indigo-700 transition-colors shadow-sm text-center flex items-center justify-center gap-2"
                  >
                    <span>📊</span> Filter All Activity Logs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
