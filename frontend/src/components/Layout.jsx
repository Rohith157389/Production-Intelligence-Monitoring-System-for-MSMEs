import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIndustry } from '../context/IndustryContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const adminNavItems = [
    { to: '/users', label: 'Activity Log', icon: '👥' },
    { to: '/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/machines', label: 'Machines', icon: '🏭' },
    { to: '/data-reading', label: 'Data Reading', icon: '📡' },
    { to: '/alerts', label: 'Alerts', icon: '⚠️' },
    { to: '/reports', label: 'Reports', icon: '📄' },
  ];

  const userNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/alerts', label: 'Alerts', icon: '⚠️' },
    { to: '/reports', label: 'Reports', icon: '📄' },
  ];

  const allowedNavItems = user?.role === 'admin' ? adminNavItems : userNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm bg-gray-800 text-white">
                PI
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900 tracking-wide">PIMS</h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Production Intelligence</p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-0.5 flex-1">
            {allowedNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  setSidebarOpen(false);
                  if (item.action) item.action();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="absolute bottom-0 w-full p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate" title={user?.email}>
                {user?.email || 'User'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span>🚪</span>
              Logout
            </button>
          </div>
        </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200 sticky top-0 z-30 transition-colors duration-300">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-gray-900 font-bold text-sm hidden sm:inline">PIMS Dashboard</span>
          </div>
          
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}


