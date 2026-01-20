import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import { useNavigate } from 'react-router-dom';
import { Users, QrCode, RefreshCw, Activity, Shield, PhoneCall } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAlert } from '../components/AlertContext';
import WhatsAppStatus from '../components/WhatsAppStatus';
import SWControls from '../components/SWControls';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useAlert();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStaff: 0,
    totalHODs: 0,
    totalAdmins: 0
  });
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const getUserDisplayName = (user = {}) => user.name || user.email || 'Unknown User';
  const getUserInitial = (user = {}) => (user.name || user.email || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    // Check if user is admin
    const authStr = localStorage.getItem('auth');
    if (!authStr) {
      navigate('/login');
      return;
    }

    const auth = JSON.parse(authStr);
    if (auth.role !== 'admin') {
      showWarning('Access Denied', 'Admin only area');
      navigate('/');
      return;
    }

    fetchUsers();
  }, [navigate, showWarning]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      const data = await apiClient.get(`/api/users?action=list&userId=${auth.id}`, { headers: { 'Content-Type': 'application/json' } });
      
      if (data.success) {
        setUsers(data.users || []);
        
        // Calculate stats
        const totalUsers = data.users?.length || 0;
        const totalStaff = data.users?.filter(u => u.role === 'staff').length || 0;
        const totalHODs = data.users?.filter(u => u.role === 'hod').length || 0;
        const totalAdmins = data.users?.filter(u => u.role === 'admin').length || 0;
        
        setStats({ totalUsers, totalStaff, totalHODs, totalAdmins });
      } else {
        showError('Failed to Load Users', data.error || 'Unable to fetch users');
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      showError('Error', 'Failed to fetch users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      const data = await apiClient.del(`/api/users?action=delete&id=${userId}&userId=${auth.id}`);
      if (data && data.success) {
        showSuccess('Success', 'User deleted successfully');
        fetchUsers();
      } else {
        showError('Failed to Delete User', data?.error || 'Unable to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      showError('Error', 'Failed to delete user. Please try again.');
    }
  };

  const requestDeleteUser = (user) => {
    setConfirmDeleteUser(user);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteUser) return;
    await handleDeleteUser(confirmDeleteUser._id || confirmDeleteUser.id, confirmDeleteUser.email);
    setConfirmDeleteUser(null);
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 no-mobile-anim">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 sm:gap-4 mb-6">
              <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">System Administration & Management</p>
              </div>
            </div>
          </div>
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {/* Total Users Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-blue-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-xs sm:text-sm font-semibold uppercase tracking-wider">Total Users</p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">{stats.totalUsers}</p>
                  </div>
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-blue-200 opacity-80" />
                </div>
              </div>
              <div className="px-4 sm:px-5 py-2 sm:py-3 bg-blue-50 text-xs text-blue-600 font-medium">
                All system users
              </div>
            </div>

            {/* Staff Members Card */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-green-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-xs sm:text-sm font-semibold uppercase tracking-wider">Staff Members</p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">{stats.totalStaff}</p>
                  </div>
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-green-200 opacity-80" />
                </div>
              </div>
              <div className="px-4 sm:px-5 py-2 sm:py-3 bg-green-50 text-xs text-green-600 font-medium">
                Active staff accounts
              </div>
            </div>

            {/* HODs Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-purple-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-xs sm:text-sm font-semibold uppercase tracking-wider">HODs</p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">{stats.totalHODs}</p>
                  </div>
                  <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-purple-200 opacity-80" />
                </div>
              </div>
              <div className="px-4 sm:px-5 py-2 sm:py-3 bg-purple-50 text-xs text-purple-600 font-medium">
                Department heads
              </div>
            </div>

            {/* Admins Card */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-orange-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-xs sm:text-sm font-semibold uppercase tracking-wider">Admins</p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">{stats.totalAdmins}</p>
                  </div>
                  <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-orange-200 opacity-80" />
                </div>
              </div>
              <div className="px-4 sm:px-5 py-2 sm:py-3 bg-orange-50 text-xs text-orange-600 font-medium">
                System administrators
              </div>
            </div>
          </div>

          {/* WhatsApp Management Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">WhatsApp Management</h2>
              </div>
            </div>
            <div className="p-4 sm:p-5 md:p-6">
              <WhatsAppStatus />
            </div>
          </div>

          {/* User Management Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">User Management</h2>
                </div>
                <button
                  onClick={fetchUsers}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-2 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white text-[11px] sm:text-sm font-medium rounded-md sm:rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title={loading ? 'Refreshing...' : 'Refresh users'}
                >
                  <RefreshCw className={`w-4 h-4 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider hidden sm:table-cell">Email</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell">Dept</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr key="loading">
                      <td colSpan="6" className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-600" />
                          <span className="text-xs sm:text-sm text-gray-600">Loading users...</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr key="empty">
                      <td colSpan="6" className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user, index) => (
                      <tr key={user._id || user.id || `user-${index}`} className="hover:bg-blue-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                              {getUserInitial(user)}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-none">{getUserDisplayName(user)}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 hidden sm:table-cell">
                          <div className="text-xs text-gray-700 truncate">{user.email}</div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                            user.role === 'admin' ? 'bg-red-100 text-red-700' :
                            user.role === 'hod' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 hidden md:table-cell text-xs text-gray-700 truncate">
                          {user.department || '—'}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 hidden lg:table-cell text-xs text-gray-700">
                          {user.phoneNumber || '—'}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs font-medium">
                          {user.role !== 'admin' ? (
                            <button
                              onClick={() => requestDeleteUser(user)}
                              className="text-red-600 hover:text-red-900 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">Admin</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6 md:p-8 shadow-sm">
            <h3 className="text-base sm:text-lg font-bold text-blue-900 mb-4 sm:mb-6">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="flex items-center justify-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md sm:rounded-lg hover:shadow-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-semibold"
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Create User</span>
              </button>
              <button
                onClick={() => {
                  let origin = (
                    import.meta.env?.VITE_PUBLIC_BASE_URL ||
                    import.meta.env?.VITE_API_URL ||
                    (typeof window !== 'undefined' ? window.location.origin : '')
                  );
                  if (origin.endsWith('/')) {
                    origin = origin.slice(0, -1);
                  }
                  window.open(`${origin}/api/whatsapp-dispatch?action=qrcode`, '_blank');
                }}
                className="flex items-center justify-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-md sm:rounded-lg hover:shadow-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-semibold"
              >
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Generate QR</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center justify-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-md sm:rounded-lg hover:shadow-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-semibold"
              >
                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Home</span>
              </button>
            </div>
            {/* Service Worker controls for admins */}
            <SWControls />
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      open={!!confirmDeleteUser}
      title="Delete user?"
      description={confirmDeleteUser ? `This will remove ${getUserDisplayName(confirmDeleteUser)}. This action cannot be undone.` : ''}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={confirmDelete}
      onCancel={() => setConfirmDeleteUser(null)}
    />
    </>
  );
}
