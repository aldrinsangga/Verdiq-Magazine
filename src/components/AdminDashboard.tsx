import React, { useState, useEffect } from 'react';
import { Loader2, Reply, BarChart3, Activity, Users, CreditCard, FileText, Settings, Search, Trash2, Edit2, Plus, Check, X, Shield, ShieldAlert, Ban, Unlock, Download, ExternalLink, Filter, Calendar } from 'lucide-react';
import { getAuthHeaders } from '../authClient';
import { useNotification } from './NotificationContext';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend,
  AreaChart,
  Area
} from 'recharts';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

interface AdminDashboardProps {
  users?: any[];
  totalUsers?: number;
  usersLimit?: number;
  usersOffset?: number;
  fetchUsers?: (offset: number, limit: number, search?: string) => void;
  reviews?: any[];
  totalReviews?: number;
  reviewsLimit?: number;
  reviewsOffset?: number;
  fetchReviews?: (offset: number, limit: number) => void;
  onUpdateUser?: (user: any) => void;
  onDeleteUser?: (id: string) => void;
  onUpdateReview?: (review: any, userId: string) => void;
  onDeleteReview?: (reviewId: string) => void;
  styleGuides?: any[];
  onAddStyleGuide?: (guide: any) => void;
  onUpdateStyleGuide?: (id: string, guide: any) => void;
  onDeleteStyleGuide?: (id: string) => void;
  onNavigate?: (view: any, reviewId?: any) => void;
}

const AdminDashboard = ({ 
  users = [], 
  totalUsers = 0,
  usersLimit = 20,
  usersOffset = 0,
  fetchUsers,
  reviews = [],
  totalReviews = 0,
  reviewsLimit = 20,
  reviewsOffset = 0,
  fetchReviews,
  onUpdateUser, 
  onDeleteUser, 
  onUpdateReview, 
  onDeleteReview,
  styleGuides = [], 
  onAddStyleGuide, 
  onUpdateStyleGuide, 
  onDeleteStyleGuide, 
  onNavigate 
}: AdminDashboardProps) => {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [addCreditsModal, setAddCreditsModal] = useState(null);
  const [creditsToAdd, setCreditsToAdd] = useState(10);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [podcasts, setPodcasts] = useState([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(false);
  const [supportTickets, setSupportTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [supportTab, setSupportTab] = useState('open');
  const [respondingTo, setRespondingTo] = useState(null);
  const [adminReply, setAdminReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // Style Guide state
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [editingStyleGuide, setEditingStyleGuide] = useState(null);
  const [styleGuideForm, setStyleGuideForm] = useState({
    title: '',
    content: '',
    source: '',
    type: 'article'
  });
  const [savingStyle, setSavingStyle] = useState(false);
  const [deletingStyle, setDeletingStyle] = useState(null);
  
  // Loading states for buttons
  const [savingUser, setSavingUser] = useState(false);
  const [addingCredits, setAddingCredits] = useState(false);
  const [earnings, setEarnings] = useState({ purchases: [], totalEarnings: 0, totalCount: 0, limit: 50, offset: 0 });
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [publishingReview, setPublishingReview] = useState(null);
  const [deletingReview, setDeletingReview] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [confirmDeleteReview, setConfirmDeleteReview] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [confirmDeleteTicket, setConfirmDeleteTicket] = useState(null);
  const [confirmDeleteStyleGuide, setConfirmDeleteStyleGuide] = useState(null);

  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalReviews: 0,
    publishedReviews: 0,
    totalEarnings: 0,
    totalCredits: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [usageData, setUsageData] = useState([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageDays, setUsageDays] = useState(7);

  const fetchUsageData = async (days = 7) => {
    setLoadingUsage(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/usage?days=${days}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/stats`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUsageData(usageDays);
  }, []);

  useEffect(() => {
    if (activeTab === 'usage') {
      fetchUsageData(usageDays);
    }
  }, [activeTab, usageDays]);

  // Defensive check for users
  const safeUsers = Array.isArray(users) ? users : [];
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  // Stats
  const totalCreditsInSystem = adminStats.totalCredits || safeUsers.reduce((sum, u) => sum + (u.credits || 0), 0);
  const publishedReviewsCount = adminStats.publishedReviews || totalReviews;
  const totalEarnings = adminStats.totalEarnings || earnings.totalEarnings;

  // Get all reviews that have podcasts
  const podcastReviews = safeReviews.filter(r => r.hasPodcast || r.podcastAudioPath);
  
  const filteredPodcasts = podcastReviews.filter(r =>
    r.songTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.artistName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Search handling
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'users' && fetchUsers) {
        fetchUsers(0, usersLimit, searchTerm);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  const handlePageChange = (tab: 'users' | 'reviews' | 'earnings', direction: 'next' | 'prev') => {
    if (tab === 'users' && fetchUsers) {
      const newOffset = direction === 'next' ? usersOffset + usersLimit : Math.max(0, usersOffset - usersLimit);
      fetchUsers(newOffset, usersLimit, searchTerm);
    } else if (tab === 'reviews' && fetchReviews) {
      const newOffset = direction === 'next' ? reviewsOffset + reviewsLimit : Math.max(0, reviewsOffset - reviewsLimit);
      fetchReviews(newOffset, reviewsLimit);
    } else if (tab === 'earnings') {
      const newOffset = direction === 'next' ? earnings.offset + earnings.limit : Math.max(0, earnings.offset - earnings.limit);
      fetchEarnings(newOffset, earnings.limit);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser({ 
      ...user,
      is_disabled: user.is_disabled || false
    });
  };

  const handleEditReview = (review, userId) => {
    setEditingReview({
      ...review,
      userId
    });
  };

  const handleSaveReview = async () => {
    if (!editingReview) return;
    
    setPublishingReview(editingReview.id); // Reuse publishingReview as a general review-saving loader
    try {
      const { userId, ...reviewData } = editingReview;
      await onUpdateReview(reviewData, userId);
      setEditingReview(null);
    } catch (error) {
      console.error('Error saving review:', error);
      showNotification('Failed to save review: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setPublishingReview(null);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSavingUser(true);
    try {
      await onUpdateUser(editingUser);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      showNotification('Failed to save user: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleAddCredits = async () => {
    if (!addCreditsModal || creditsToAdd <= 0) return;
    
    setAddingCredits(true);
    try {
      const updatedUser = {
        ...addCreditsModal,
        credits: (addCreditsModal.credits || 0) + creditsToAdd
      };
      
      await onUpdateUser(updatedUser);
      setAddCreditsModal(null);
      setCreditsToAdd(10);
    } catch (error) {
      console.error('Error adding credits:', error);
      showNotification('Failed to add credits: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setAddingCredits(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'earnings') {
      fetchEarnings();
    } else if (activeTab === 'support') {
      fetchSupportTickets();
    }
  }, [activeTab]);

  const fetchSupportTickets = async () => {
    setLoadingTickets(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/support`, {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Fetched support tickets:", data);
        setSupportTickets(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Failed to fetch support tickets, status:", res.status, errData);
      }
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/support/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchSupportTickets();
      }
    } catch (err) {
      console.error("Failed to update ticket status:", err);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    setConfirmDeleteTicket(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/support/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        fetchSupportTickets();
      }
    } catch (err) {
      console.error("Failed to delete ticket:", err);
    }
  };

  const handleSendAdminReply = async (ticketId) => {
    if (!adminReply.trim()) return;
    setSendingReply(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/support/${ticketId}/message`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: adminReply })
      });
      if (res.ok) {
        setAdminReply('');
        setRespondingTo(null);
        fetchSupportTickets();
      }
    } catch (err) {
      console.error("Failed to send admin reply:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const fetchEarnings = async (offset = 0, limit = 50) => {
    setLoadingEarnings(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/admin/earnings?offset=${offset}&limit=${limit}`, {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        setEarnings(data);
      }
    } catch (err) {
      console.error("Failed to fetch earnings:", err);
    } finally {
      setLoadingEarnings(false);
    }
  };
  const handleToggleUserStatus = async (user) => {
    setTogglingStatus(user.id);
    try {
      const updatedUser = {
        ...user,
        is_disabled: !user.is_disabled
      };
      await onUpdateUser(updatedUser);
    } catch (error) {
      console.error('Error toggling user status:', error);
      showNotification('Failed to update user status: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    setConfirmDeleteReview(null);
    setDeletingReview(reviewId);
    try {
      await onDeleteReview(reviewId);
      showNotification('Review deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting review:', error);
      showNotification('Failed to delete review: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setDeletingReview(null);
    }
  };

  const handleTogglePublish = async (review, userId) => {
    setPublishingReview(review.id);
    try {
      const updatedReview = {
        ...review,
        isPublished: !review.isPublished
      };
      await onUpdateReview(updatedReview, userId);
    } catch (error) {
      console.error('Error toggling publish status:', error);
      showNotification('Failed to update publish status: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setPublishingReview(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    setConfirmDeleteUser(null);
    setDeletingUser(userId);
    try {
      await onDeleteUser(userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Failed to delete user: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setDeletingUser(null);
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setActiveTab('user-detail');
  };

  const handleOpenStyleModal = (guide = null) => {
    if (guide) {
      setEditingStyleGuide(guide);
      setStyleGuideForm({
        title: guide.title,
        content: guide.content,
        source: guide.source || '',
        type: guide.type
      });
    } else {
      setEditingStyleGuide(null);
      setStyleGuideForm({
        title: '',
        content: '',
        source: '',
        type: 'article'
      });
    }
    setIsStyleModalOpen(true);
  };

  const handleSaveStyleGuide = async () => {
    if (!styleGuideForm.title || !styleGuideForm.content) {
      showNotification('Title and content are required', 'warning');
      return;
    }

    setSavingStyle(true);
    try {
      if (editingStyleGuide) {
        await onUpdateStyleGuide(editingStyleGuide.id, styleGuideForm);
      } else {
        await onAddStyleGuide(styleGuideForm);
      }
      setIsStyleModalOpen(false);
    } catch (error) {
      console.error('Error saving style guide:', error);
      showNotification('Failed to save style guide', 'error');
    } finally {
      setSavingStyle(false);
    }
  };

  const handleDeleteStyleGuide = async (id) => {
    setConfirmDeleteStyleGuide(null);
    setDeletingStyle(id);
    try {
      await onDeleteStyleGuide(id);
    } catch (error) {
      console.error('Error deleting style guide:', error);
      showNotification('Failed to delete style guide', 'error');
    } finally {
      setDeletingStyle(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black">Command Center</h1>
          <p className="text-slate-500">Manage users, subscriptions, credits, and reviews</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
            <p className="text-[10px] font-black uppercase text-slate-500">Total Users</p>
            <p className="text-2xl font-black text-white">{totalUsers}</p>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
            <p className="text-[10px] font-black uppercase text-slate-500">Reviews</p>
            <p className="text-2xl font-black text-white">{totalReviews}</p>
          </div>
          <div className="bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
            <p className="text-[10px] font-black uppercase text-amber-500">Credits Pool</p>
            <p className="text-2xl font-black text-white">{totalCreditsInSystem}</p>
          </div>
          <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
            <p className="text-[10px] font-black uppercase text-emerald-500">Total Earnings</p>
            <p className="text-2xl font-black text-white">${totalEarnings.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-800 pb-4 overflow-x-auto">
        {[
          { id: 'users', label: 'Users', icon: '👥' },
          { id: 'reviews', label: 'Reviews', icon: '📝' },
          { id: 'usage', label: 'Usage', icon: '📊' },
          { id: 'podcasts', label: 'Podcasts', icon: '🎙️' },
          { id: 'earnings', label: 'Earnings', icon: '💰' },
          { id: 'style', label: 'Style Guides', icon: '🎨' },
          { id: 'support', label: 'Support', icon: '🎫' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedUser(null); }}
            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-slate-800'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        {selectedUser && (
          <button
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-emerald-500 text-slate-950"
          >
            <span>👤</span>
            {selectedUser.name}
          </button>
        )}
      </div>

      {/* USAGE TAB */}
      {activeTab === 'usage' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">Usage Monitoring</h2>
              <p className="text-slate-500">Track system activity and resource consumption</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 rounded-xl border border-slate-800 p-1 shadow-sm">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  onClick={() => setUsageDays(days)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    usageDays === days 
                      ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-800'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {loadingUsage ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Generations Chart */}
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Activity className="text-emerald-500" size={18} />
                    AI Generations
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Daily Total</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usageData}>
                      <defs>
                        <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} 
                        dy={10}
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: '#10b981', fontWeight: 900, fontSize: '12px' }}
                        labelStyle={{ color: '#fff', fontWeight: 900, marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="aiGenerations" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorAi)" 
                        name="Generations"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Credit Consumption Chart */}
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <CreditCard className="text-blue-500" size={18} />
                    Credit Consumption
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Daily Burn</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} 
                        dy={10}
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: '#3b82f6', fontWeight: 900, fontSize: '12px' }}
                        labelStyle={{ color: '#fff', fontWeight: 900, marginBottom: '4px' }}
                      />
                      <Bar 
                        dataKey="creditsConsumed" 
                        fill="#3b82f6" 
                        radius={[8, 8, 0, 0]} 
                        name="Credits"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Active Users Chart */}
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Users className="text-purple-500" size={18} />
                    Active Users
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Daily DAU</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} 
                        dy={10}
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: '#a855f7', fontWeight: 900, fontSize: '12px' }}
                        labelStyle={{ color: '#fff', fontWeight: 900, marginBottom: '4px' }}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="activeUsers" 
                        stroke="#a855f7" 
                        strokeWidth={4}
                        dot={{ r: 6, fill: '#a855f7', strokeWidth: 3, stroke: '#0f172a' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                        name="Users"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* New Content Chart */}
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <FileText className="text-orange-500" size={18} />
                    New Reviews
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Daily Velocity</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} 
                        dy={10}
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 900}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: '#f97316', fontWeight: 900, fontSize: '12px' }}
                        labelStyle={{ color: '#fff', fontWeight: 900, marginBottom: '4px' }}
                      />
                      <Bar 
                        dataKey="newReviews" 
                        fill="#f97316" 
                        radius={[8, 8, 0, 0]} 
                        name="Reviews"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {activeTab !== 'user-detail' && (
        <div className="mb-8">
          <div className="relative max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              data-testid="admin-search"
            />
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="glass rounded-3xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">User</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Credits</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Reviews</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black uppercase text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {safeUsers.map(user => {
                  return (
                    <tr key={user.id} className={`border-t border-slate-800 hover:bg-slate-900/50 ${user.is_disabled ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 font-black">
                            {user.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-white">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-500 font-bold text-lg">{user.credits || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_disabled ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">Disabled</span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400">{user.reviewCount || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleViewUser(user)} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Details"
                            data-testid={`view-user-${user.id}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => setAddCreditsModal(user)} 
                            className="p-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Add Credits"
                            data-testid={`add-credits-${user.id}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleEditUser(user)} 
                            className="p-2 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Edit User"
                            data-testid={`edit-user-${user.id}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleToggleUserStatus(user)} 
                            disabled={togglingStatus === user.id}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${user.is_disabled ? 'text-green-500 hover:text-green-400 hover:bg-green-500/10' : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'}`}
                            title={user.is_disabled ? 'Enable User' : 'Disable User'}
                            data-testid={`toggle-status-${user.id}`}
                          >
                            {togglingStatus === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : user.is_disabled ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            )}
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteUser(user.id)} 
                            disabled={deletingUser === user.id}
                            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete User"
                            data-testid={`delete-user-${user.id}`}
                          >
                            {deletingUser === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Showing <span className="font-bold text-white">{usersOffset + 1}</span> to <span className="font-bold text-white">{Math.min(usersOffset + usersLimit, totalUsers)}</span> of <span className="font-bold text-white">{totalUsers}</span> users
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange('users', 'prev')}
                disabled={usersOffset === 0}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange('users', 'next')}
                disabled={usersOffset + usersLimit >= totalUsers}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER DETAIL VIEW */}
      {activeTab === 'user-detail' && selectedUser && (
        <div className="space-y-6">
          <button 
            onClick={() => { setActiveTab('users'); setSelectedUser(null); }}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Users
          </button>

          {/* User Profile Card */}
          <div className="glass rounded-3xl border border-slate-800 p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 font-black text-3xl">
                  {selectedUser.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedUser.name}</h2>
                  <p className="text-slate-500">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedUser.is_disabled ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">Disabled</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">Active</span>
                    )}
                    {selectedUser.role === 'admin' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400">Admin</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setAddCreditsModal(selectedUser)}
                  className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-bold hover:bg-emerald-400 transition-colors flex items-center gap-2"
                  data-testid="add-credits-user-detail"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Credits
                </button>
                <button 
                  onClick={() => handleEditUser(selectedUser)}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                  data-testid="edit-user-detail"
                >
                  Edit User
                </button>
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Credits</p>
                <p className="text-3xl font-black text-emerald-500">{selectedUser.credits || 0}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Reviews</p>
                <p className="text-3xl font-black text-white">{selectedUser.history?.length || 0}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Published</p>
                <p className="text-3xl font-black text-white">{selectedUser.history?.filter(r => r.isPublished).length || 0}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Account Type</p>
                <p className="text-xl font-black text-white">{selectedUser.role === 'admin' ? 'Admin' : 'User'}</p>
              </div>
            </div>

            {/* User Reviews */}
            <div>
              <h3 className="text-lg font-bold mb-4">User Reviews</h3>
              {selectedUser.history?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedUser.history.map(review => (
                    <div key={review.id} className="bg-slate-800/50 rounded-xl overflow-hidden">
                      <div className="h-24 relative">
                        <img src={review.imageUrl} className="w-full h-full object-cover" alt={review.songTitle} />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${review.isPublished ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                            {review.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-white text-sm">{review.songTitle}</h4>
                        <p className="text-xs text-slate-500">{review.artistName}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-emerald-500 font-black">{review.rating}/10</span>
                          <button 
                            onClick={() => handleEditReview(review, selectedUser.id)}
                            className="text-xs text-blue-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 flex items-center gap-1"
                            data-testid={`edit-review-userdetail-${review.id}`}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleTogglePublish(review, selectedUser.id)}
                            disabled={publishingReview === review.id}
                            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1"
                            data-testid={`toggle-publish-userdetail-${review.id}`}
                          >
                            {publishingReview === review.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            {review.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No reviews yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVIEWS TAB */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {safeReviews.length > 0 ? safeReviews.map(review => (
              <div key={review.id} className="glass rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="h-32 relative">
                  <img src={review.imageUrl} className="w-full h-full object-cover" alt={review.songTitle} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${review.isPublished ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {review.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-white">{review.songTitle}</h4>
                  <p className="text-xs text-slate-500 mb-2">{review.artistName}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 text-[10px] font-black">
                      {review.userName?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-[10px] text-slate-400">{review.userName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-500 font-black">{review.rating}/10</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEditReview(review, review.userId)}
                        className="text-xs px-3 py-1 rounded-lg bg-slate-800 text-blue-400 hover:bg-slate-700 transition-colors"
                        data-testid={`edit-review-btn-${review.id}`}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleTogglePublish(review, review.userId)}
                        disabled={publishingReview === review.id}
                        className="text-xs px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        data-testid={`toggle-publish-review-${review.id}`}
                      >
                        {publishingReview === review.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        {review.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteReview(review.id)}
                        disabled={deletingReview === review.id}
                        className="text-xs px-3 py-1 rounded-lg bg-slate-800 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                        data-testid={`delete-review-btn-${review.id}`}
                      >
                        {deletingReview === review.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-500">No reviews found</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-500">
              Showing <span className="font-bold text-white">{reviewsOffset + 1}</span> to <span className="font-bold text-white">{Math.min(reviewsOffset + reviewsLimit, totalReviews)}</span> of <span className="font-bold text-white">{totalReviews}</span> reviews
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange('reviews', 'prev')}
                disabled={reviewsOffset === 0}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange('reviews', 'next')}
                disabled={reviewsOffset + reviewsLimit >= totalReviews}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PODCASTS TAB */}
      {activeTab === 'podcasts' && (
        <div className="space-y-6">
          {/* Podcast Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎙️</span>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase font-bold">Total Episodes</p>
                  <p className="text-2xl font-black text-white">{podcastReviews.length}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-6 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">✅</span>
                </div>
                <div>
                  <p className="text-emerald-500 text-xs uppercase font-bold">Published</p>
                  <p className="text-2xl font-black text-white">{podcastReviews.filter(p => p.isPublished).length}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-6 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">📝</span>
                </div>
                <div>
                  <p className="text-amber-500 text-xs uppercase font-bold">Drafts</p>
                  <p className="text-2xl font-black text-white">{podcastReviews.filter(p => !p.isPublished).length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Podcasts List */}
          <div className="glass rounded-3xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Podcast Episodes</h3>
              <span className="text-xs text-slate-500">{filteredPodcasts.length} episodes</span>
            </div>
            
            {filteredPodcasts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Episode</th>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Artist</th>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">By</th>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Rating</th>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                      <th className="text-right px-6 py-4 text-[10px] font-black uppercase text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPodcasts.map(podcast => (
                      <tr key={podcast.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800">
                              <img 
                                src={podcast.imageUrl} 
                                alt={podcast.songTitle}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-bold text-white">{podcast.songTitle}</p>
                              <p className="text-xs text-slate-500">{podcast.analysis?.genre || 'Unknown'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-300">{podcast.artistName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 text-[10px] font-black">
                              {podcast.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <span className="text-xs text-slate-400">{podcast.userName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-emerald-500 font-bold">{podcast.rating}/10</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            podcast.isPublished 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {podcast.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditReview(podcast, podcast.userId)}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-blue-400 hover:bg-slate-700 transition-colors"
                              data-testid={`edit-podcast-btn-${podcast.id}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleTogglePublish(podcast, podcast.userId)}
                              disabled={publishingReview === podcast.id}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2 ${
                                podcast.isPublished
                                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                              data-testid={`toggle-publish-podcast-${podcast.id}`}
                            >
                              {publishingReview === podcast.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : null}
                              {podcast.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎙️</span>
                </div>
                <p className="text-slate-500 mb-2">No podcast episodes yet</p>
                <p className="text-xs text-slate-600">Podcast episodes will appear here once users generate them</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EARNINGS TAB */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="glass rounded-3xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white">Purchase History</h3>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-500">Total Revenue</p>
                <p className="text-xl font-black text-emerald-500">${earnings.totalEarnings.toFixed(2)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">User</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Date</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Credits</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Amount</th>
                    <th className="text-right px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingEarnings ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                      </td>
                    </tr>
                  ) : earnings.purchases.map(purchase => (
                    <tr key={purchase.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-white">{purchase.userName || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{purchase.userEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(purchase.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-500 font-bold">+{purchase.credits}</span>
                      </td>
                      <td className="px-6 py-4 text-white font-bold">
                        ${purchase.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase">
                          {purchase.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loadingEarnings && earnings.purchases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No purchases found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-t border-slate-800">
              <p className="text-xs text-slate-500">
                Showing <span className="font-bold text-white">{earnings.offset + 1}</span> to <span className="font-bold text-white">{Math.min(earnings.offset + earnings.limit, earnings.totalCount)}</span> of <span className="font-bold text-white">{earnings.totalCount}</span> purchases
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange('earnings', 'prev')}
                  disabled={earnings.offset === 0}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange('earnings', 'next')}
                  disabled={earnings.offset + earnings.limit >= earnings.totalCount}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STYLE GUIDES TAB */}
      {activeTab === 'style' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-white">Style Guides</h2>
              <p className="text-slate-500 text-sm">Reference articles for AI voice training</p>
            </div>
            <button 
              onClick={() => handleOpenStyleModal()}
              className="bg-emerald-500 text-slate-950 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors"
            >
              Add New Guide
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {styleGuides.map(guide => (
              <div key={guide.id} className="glass rounded-2xl border border-slate-800 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                    guide.type === 'article' ? 'bg-blue-500/20 text-blue-400' :
                    guide.type === 'review' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {guide.type}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenStyleModal(guide)} className="text-slate-500 hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteStyleGuide(guide.id)} 
                      disabled={deletingStyle === guide.id}
                      className="text-slate-500 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {deletingStyle === guide.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{guide.title}</h3>
                <p className="text-slate-500 text-xs mb-4 line-clamp-3">{guide.content}</p>
                <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] text-slate-600 font-bold uppercase">{guide.source || 'Unknown Source'}</span>
                  <span className="text-[10px] text-slate-600">{new Date(guide.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {styleGuides.length === 0 && (
              <div className="col-span-full py-20 text-center glass rounded-3xl border border-slate-800">
                <p className="text-slate-500">No style guides added yet.</p>
                <p className="text-xs text-slate-600 mt-2">Add reference articles to train the AI's writing voice.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">Support Tickets</h2>
              <p className="text-slate-500 text-sm">Manage user inquiries and technical support</p>
            </div>
            <button 
              onClick={fetchSupportTickets}
              className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              {loadingTickets ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </button>
          </div>

          {/* Support Sub-tabs */}
          <div className="flex gap-4 border-b border-slate-800 pb-4 overflow-x-auto">
            {[
              { id: 'open', label: 'New Tickets', count: supportTickets.filter(t => t.status === 'open').length },
              { id: 'follow-up', label: 'Follow Up', count: supportTickets.filter(t => t.status === 'follow-up').length },
              { id: 'resolved', label: 'Resolved', count: supportTickets.filter(t => t.status === 'resolved').length },
              { id: 'closed', label: 'Closed', count: supportTickets.filter(t => t.status === 'closed').length },
              { id: 'deleted', label: 'Deleted', count: supportTickets.filter(t => t.status === 'deleted').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSupportTab(tab.id)}
                className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                  supportTab === tab.id ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label} ({tab.count})
                {supportTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                )}
              </button>
            ))}
          </div>

          {loadingTickets && supportTickets.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : supportTickets.filter(t => t.status === supportTab).length === 0 ? (
            <div className="text-center py-20 glass rounded-3xl border border-slate-800">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No {supportTab} tickets found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {supportTickets.filter(t => t.status === supportTab).map(ticket => (
                <div key={ticket.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-black text-white tracking-tight">{ticket.subject}</h3>
                          <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
                            ticket.status === 'open' ? 'bg-emerald-500/10 text-emerald-500' :
                            ticket.status === 'resolved' ? 'bg-blue-500/10 text-blue-500' :
                            ticket.status === 'follow-up' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-slate-800 text-slate-500'
                          }`}>
                            {ticket.status}
                          </span>
                          <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[8px] font-black uppercase tracking-widest">
                            {ticket.category}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-emerald-500 font-black text-[10px]">
                              {ticket.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-slate-300 font-bold">{ticket.name}</span>
                            <span className="text-slate-500">({ticket.email})</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span>ID: {ticket.id}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ticket.status !== 'follow-up' && (
                          <button 
                            onClick={() => handleUpdateTicketStatus(ticket.id, 'follow-up')}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all"
                          >
                            Follow Up
                          </button>
                        )}
                        {ticket.status !== 'resolved' && (
                          <button 
                            onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                          >
                            Resolve
                          </button>
                        )}
                        {ticket.status !== 'closed' && (
                          <button 
                            onClick={() => handleUpdateTicketStatus(ticket.id, 'closed')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                          >
                            Close
                          </button>
                        )}
                        {ticket.status !== 'deleted' && (
                          <button 
                            onClick={() => handleUpdateTicketStatus(ticket.id, 'deleted')}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                          >
                            Delete
                          </button>
                        )}
                        {ticket.status === 'deleted' && (
                          <button 
                            onClick={() => setConfirmDeleteTicket(ticket.id)}
                            className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all"
                          >
                            Perm Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6 bg-slate-950/50">
                    {/* Initial Message */}
                    <div className="flex flex-col items-start">
                      <div className="max-w-[80%] bg-slate-800 rounded-2xl rounded-tl-none p-4 border border-white/5 shadow-xl">
                        <p className="text-sm text-slate-200 leading-relaxed">{ticket.message}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Initial Message</span>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {ticket.messages?.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl border shadow-xl ${
                          msg.sender === 'admin' 
                            ? 'bg-emerald-500 text-slate-950 rounded-tr-none border-emerald-400/30' 
                            : 'bg-slate-800 text-white rounded-tl-none border-white/5'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center gap-2 mt-3 text-[10px] font-black uppercase tracking-widest ${
                            msg.sender === 'admin' ? 'text-slate-900/60' : 'text-slate-500'
                          }`}>
                            <span>{msg.sender === 'admin' ? 'Support Reply' : 'User Reply'}</span>
                            <span className="opacity-50">•</span>
                            <span>{new Date(msg.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Response Form */}
                    <div className="pt-4 mt-8 border-t border-slate-800">
                      {respondingTo === ticket.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={adminReply}
                            onChange={e => setAdminReply(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                            placeholder="Type your response to the user..."
                            rows={4}
                          />
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => { setRespondingTo(null); setAdminReply(''); }}
                              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSendAdminReply(ticket.id)}
                              disabled={sendingReply || !adminReply.trim()}
                              className="px-8 py-2 rounded-xl bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Reply className="w-4 h-4" />}
                              Send Response
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRespondingTo(ticket.id)}
                          className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-800 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500 transition-all flex items-center justify-center gap-2 group"
                        >
                          <Reply className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Click to respond to this ticket</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STYLE GUIDE MODAL */}
      {isStyleModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsStyleModalOpen(false)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-2xl w-full border border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-emerald-500">🎨</span>
              {editingStyleGuide ? 'Edit Style Guide' : 'Add New Style Guide'}
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Title</label>
                <input
                  value={styleGuideForm.title}
                  onChange={e => setStyleGuideForm({...styleGuideForm, title: e.target.value})}
                  placeholder="e.g. Pitchfork Review Style"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Type</label>
                  <select
                    value={styleGuideForm.type}
                    onChange={e => setStyleGuideForm({...styleGuideForm, type: e.target.value as any})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="article">Article</option>
                    <option value="review">Review</option>
                    <option value="blog">Blog</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Source (Optional)</label>
                  <input
                    value={styleGuideForm.source}
                    onChange={e => setStyleGuideForm({...styleGuideForm, source: e.target.value})}
                    placeholder="e.g. Pitchfork, Rolling Stone"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Content (Reference Text)</label>
                <textarea
                  value={styleGuideForm.content}
                  onChange={e => setStyleGuideForm({...styleGuideForm, content: e.target.value})}
                  rows={12}
                  placeholder="Paste the reference article text here..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setIsStyleModalOpen(false)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                disabled={savingStyle}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveStyleGuide} 
                disabled={savingStyle}
                className="flex-1 bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingStyleGuide ? 'Update Guide' : 'Save Guide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT REVIEW MODAL */}
      {editingReview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingReview(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-2xl w-full border border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Review: {editingReview.songTitle}
            </h3>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Song Title</label>
                  <input
                    value={editingReview.songTitle || ''}
                    onChange={e => setEditingReview({...editingReview, songTitle: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Artist Name</label>
                  <input
                    value={editingReview.artistName || ''}
                    onChange={e => setEditingReview({...editingReview, artistName: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Headline</label>
                <input
                  value={editingReview.headline || ''}
                  onChange={e => setEditingReview({...editingReview, headline: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Review Body</label>
                <textarea
                  value={editingReview.reviewBody || ''}
                  onChange={e => setEditingReview({...editingReview, reviewBody: e.target.value})}
                  rows={8}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Rating (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={editingReview.rating || 0}
                    onChange={e => setEditingReview({...editingReview, rating: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Genre</label>
                  <input
                    value={editingReview.analysis?.genre || ''}
                    onChange={e => setEditingReview({
                      ...editingReview, 
                      analysis: { ...editingReview.analysis, genre: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
                <div>
                  <p className="font-bold text-white">Publish Status</p>
                  <p className="text-xs text-slate-500">Published reviews are visible in the magazine</p>
                </div>
                <button
                  onClick={() => setEditingReview({...editingReview, isPublished: !editingReview.isPublished})}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                    editingReview.isPublished 
                      ? 'bg-emerald-500 text-slate-950' 
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {editingReview.isPublished ? 'Published' : 'Draft'}
                </button>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setEditingReview(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                disabled={publishingReview}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveReview} 
                disabled={publishingReview}
                className="flex-1 bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {publishingReview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Review'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-lg w-full border border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit User
            </h3>
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Name</label>
                <input
                  value={editingUser.name || ''}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2">Email (read-only)</label>
                <input
                  value={editingUser.email || ''}
                  disabled
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* Credits */}
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Credits</label>
                <input
                  type="number"
                  min="0"
                  value={editingUser.credits || 0}
                  onChange={e => setEditingUser({...editingUser, credits: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Role</label>
                <select
                  value={editingUser.role || 'user'}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
                <div>
                  <p className="font-bold text-white">Account Status</p>
                  <p className="text-xs text-slate-500">Disabled accounts cannot login</p>
                </div>
                <button
                  onClick={() => setEditingUser({...editingUser, is_disabled: !editingUser.is_disabled})}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                    editingUser.is_disabled 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {editingUser.is_disabled ? 'Disabled' : 'Active'}
                </button>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setEditingUser(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                disabled={savingUser}
                data-testid="cancel-edit-user"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveUser} 
                disabled={savingUser}
                className="flex-1 bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="save-user-btn"
              >
                {savingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE REVIEW MODAL */}
      {confirmDeleteReview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeleteReview(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full border border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-red-500">Delete Review</h3>
            <p className="text-slate-300 mb-8">Are you sure you want to delete this review? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDeleteReview(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteReview(confirmDeleteReview)} 
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeleteUser(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full border border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-red-500">Delete User</h3>
            <p className="text-slate-300 mb-8">Are you sure you want to delete this user? This action cannot be undone and will delete all their reviews.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDeleteUser(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteUser(confirmDeleteUser)} 
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE TICKET MODAL */}
      {confirmDeleteTicket && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeleteTicket(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full border border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-red-500">Delete Ticket</h3>
            <p className="text-slate-300 mb-8">Are you sure you want to delete this ticket? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDeleteTicket(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteTicket(confirmDeleteTicket)} 
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE STYLE GUIDE MODAL */}
      {confirmDeleteStyleGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeleteStyleGuide(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full border border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-red-500">Delete Style Guide</h3>
            <p className="text-slate-300 mb-8">Are you sure you want to delete this style guide? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDeleteStyleGuide(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteStyleGuide(confirmDeleteStyleGuide)} 
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CREDITS MODAL */}
      {addCreditsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAddCreditsModal(null)}>
          <div className="bg-slate-900 p-8 rounded-3xl max-w-md w-full border border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Credits
            </h3>
            <p className="text-slate-500 mb-6">Adding credits to {addCreditsModal.name}</p>
            
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current Balance</span>
                <span className="text-emerald-500 font-bold text-xl">{addCreditsModal.credits || 0} credits</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] uppercase font-black text-emerald-500 mb-3">Credits to Add</label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[5, 10, 25, 50].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCreditsToAdd(amount)}
                    className={`py-3 rounded-xl font-bold transition-colors ${
                      creditsToAdd === amount 
                        ? 'bg-emerald-500 text-slate-950' 
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                value={creditsToAdd}
                onChange={e => setCreditsToAdd(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="bg-emerald-500/10 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-emerald-500">New Balance</span>
                <span className="text-emerald-500 font-bold text-xl">{(addCreditsModal.credits || 0) + creditsToAdd} credits</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setAddCreditsModal(null)} 
                className="flex-1 bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                disabled={addingCredits}
                data-testid="cancel-add-credits"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddCredits} 
                disabled={creditsToAdd <= 0 || addingCredits}
                className="flex-1 bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="confirm-add-credits"
              >
                {addingCredits ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${creditsToAdd} Credits`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
