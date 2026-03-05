import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const SUBSCRIPTION_PLANS = {
  curious: { name: 'Curious (Free)', credits: 0, price: '$0' },
  artist: { name: 'Artist', credits: 15, price: '$12/mo' },
  label: { name: 'Label', credits: 60, price: '$49/mo' }
};

const AdminDashboard = ({ users, onUpdateUser, onDeleteUser, onUpdateReview }) => {
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
  
  // Loading states for buttons
  const [savingUser, setSavingUser] = useState(false);
  const [addingCredits, setAddingCredits] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [publishingReview, setPublishingReview] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const allReviews = users.flatMap(u => (u.history || []).map(r => ({ ...r, userId: u.id, userName: u.name, userEmail: u.email })));
  
  // Get all reviews that have podcasts
  const podcastReviews = allReviews.filter(r => r.hasPodcast || r.podcastAudioPath);
  
  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReviews = allReviews.filter(r => 
    r.songTitle?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.artistName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPodcasts = podcastReviews.filter(r =>
    r.songTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.artistName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalSubscribers = users.filter(u => u.isSubscribed).length;
  const totalCreditsInSystem = users.reduce((sum, u) => sum + (u.credits || 0), 0);
  const publishedReviews = allReviews.filter(r => r.isPublished).length;

  const handleEditUser = (user) => {
    setEditingUser({ 
      ...user,
      subscription_type: user.subscription_type || 'curious',
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
      alert('Failed to save review: ' + (error.message || 'Unknown error'));
    } finally {
      setPublishingReview(null);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSavingUser(true);
    try {
      // Update is_subscribed based on plan
      const isSubscribed = editingUser.subscription_type && editingUser.subscription_type !== 'curious';
      const updatedUser = {
        ...editingUser,
        isSubscribed: isSubscribed,
        is_subscribed: isSubscribed
      };
      
      await onUpdateUser(updatedUser);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Failed to save user: ' + (error.message || 'Unknown error'));
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
      alert('Failed to add credits: ' + (error.message || 'Unknown error'));
    } finally {
      setAddingCredits(false);
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
      alert('Failed to update user status: ' + (error.message || 'Unknown error'));
    } finally {
      setTogglingStatus(null);
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
      alert('Failed to update publish status: ' + (error.message || 'Unknown error'));
    } finally {
      setPublishingReview(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    setDeletingUser(userId);
    try {
      await onDeleteUser(userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user: ' + (error.message || 'Unknown error'));
    } finally {
      setDeletingUser(null);
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setActiveTab('user-detail');
  };

  const getPlanBadge = (user) => {
    if (!user.isSubscribed && !user.is_subscribed) return { label: 'Free', color: 'bg-slate-700 text-slate-300' };
    const plan = user.subscription_type || 'curious';
    switch(plan) {
      case 'label': return { label: 'Label', color: 'bg-purple-500/20 text-purple-400' };
      case 'artist': return { label: 'Artist', color: 'bg-emerald-500/20 text-emerald-400' };
      default: return { label: 'Free', color: 'bg-slate-700 text-slate-300' };
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
          <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
            <p className="text-[10px] font-black uppercase text-emerald-500">Subscribers</p>
            <p className="text-2xl font-black text-white">{totalSubscribers}</p>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
            <p className="text-[10px] font-black uppercase text-slate-500">Total Users</p>
            <p className="text-2xl font-black text-white">{users.length}</p>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
            <p className="text-[10px] font-black uppercase text-slate-500">Reviews</p>
            <p className="text-2xl font-black text-white">{allReviews.length}</p>
          </div>
          <div className="bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
            <p className="text-[10px] font-black uppercase text-amber-500">Credits Pool</p>
            <p className="text-2xl font-black text-white">{totalCreditsInSystem}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-800 pb-4 overflow-x-auto">
        {[
          { id: 'users', label: 'Users', icon: '👥' },
          { id: 'reviews', label: 'Reviews', icon: '📝' },
          { id: 'podcasts', label: 'Podcasts', icon: '🎙️' },
          { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
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
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Plan</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Credits</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Reviews</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black uppercase text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const planBadge = getPlanBadge(user);
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
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${planBadge.color}`}>
                          {planBadge.label}
                        </span>
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
                        <span className="text-slate-400">{user.history?.length || 0}</span>
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
                            onClick={() => handleDeleteUser(user.id)} 
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPlanBadge(selectedUser).color}`}>
                      {getPlanBadge(selectedUser).label}
                    </span>
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
                <p className="text-[10px] font-black uppercase text-slate-500">Plan</p>
                <p className="text-xl font-black text-white">{SUBSCRIPTION_PLANS[selectedUser.subscription_type || 'curious']?.name || 'Free'}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReviews.length > 0 ? filteredReviews.map(review => (
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

      {/* SUBSCRIPTIONS TAB */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Subscription Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🆓</span>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase font-bold">Free (Curious)</p>
                  <p className="text-2xl font-black text-white">{users.filter(u => !u.isSubscribed && !u.is_subscribed).length}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-6 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎵</span>
                </div>
                <div>
                  <p className="text-emerald-500 text-xs uppercase font-bold">Artist</p>
                  <p className="text-2xl font-black text-white">{users.filter(u => u.subscription_type === 'artist').length}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-6 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🏷️</span>
                </div>
                <div>
                  <p className="text-purple-500 text-xs uppercase font-bold">Label</p>
                  <p className="text-2xl font-black text-white">{users.filter(u => u.subscription_type === 'label').length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribers List */}
          <div className="glass rounded-3xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h3 className="font-bold text-white">Active Subscribers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">User</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Plan</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Credits</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase text-slate-500">Monthly Credits</th>
                    <th className="text-right px-6 py-4 text-[10px] font-black uppercase text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.isSubscribed || u.is_subscribed).map(user => (
                    <tr key={user.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-white">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPlanBadge(user).color}`}>
                          {getPlanBadge(user).label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-500 font-bold">{user.credits || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400">
                          {SUBSCRIPTION_PLANS[user.subscription_type]?.credits || 0}/month
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="text-emerald-500 hover:text-emerald-400 text-xs font-bold"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.filter(u => u.isSubscribed || u.is_subscribed).length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                        No subscribers yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

              {/* Subscription Plan */}
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Subscription Plan</label>
                <select
                  value={editingUser.subscription_type || 'curious'}
                  onChange={e => setEditingUser({...editingUser, subscription_type: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                    <option key={key} value={key}>{plan.name} ({plan.price})</option>
                  ))}
                </select>
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
