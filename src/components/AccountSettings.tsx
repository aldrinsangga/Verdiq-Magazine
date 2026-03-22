import React, { useState } from 'react';
import MFASetup from './MFASetup';
import { useNotification } from './NotificationContext';

import { isAdmin } from '../authClient';

const AccountSettings = ({ user, session, onUpdate, initialTab = 'profile' }) => {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email
  });
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    try {
      await onUpdate({ ...user, name: formData.name, email: formData.email });
      showNotification('Profile updated successfully!', 'success');
    } catch (error) {
      showNotification('Failed to update profile.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (password.new !== password.confirm) {
      showNotification('Passwords do not match!', 'error');
      return;
    }
    if (password.current !== user.password) {
      showNotification('Current password is incorrect!', 'error');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await onUpdate({ ...user, password: password.new });
      setPassword({ current: '', new: '', confirm: '' });
      showNotification('Password updated successfully!', 'success');
    } catch (error) {
      showNotification('Failed to update password.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDownloadInvoice = (invoiceId) => {
    showNotification(`Downloading invoice ${invoiceId}...`, 'info');
    // In a real app, this would trigger a PDF download
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8" data-testid="account-settings">
      <h1 className="text-3xl font-black mb-6">Account Settings</h1>

      <div className="flex gap-6">
        <aside className="w-64 flex-shrink-0">
          <nav className="space-y-2">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'security', label: 'Security' },
              { id: 'billing', label: 'Billing' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === tab.id ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-grow glass p-8 rounded-3xl border border-slate-800">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-6">Profile Information</h2>
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Full Name</label>
                <input
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  data-testid="profile-name-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  data-testid="profile-email-input"
                />
              </div>
              <button 
                onClick={handleProfileUpdate} 
                disabled={isUpdatingProfile}
                className="bg-emerald-500 text-slate-950 font-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                data-testid="save-profile-btn"
              >
                {isUpdatingProfile ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* MFA Section - Only show for admins */}
              {isAdmin(user) && (
                <div>
                  <MFASetup 
                    user={user} 
                    session={session}
                    onMFAEnabled={() => {
                      // Optionally refresh user data
                    }}
                    onClose={() => {}}
                  />
                </div>
              )}
              
              {/* Password Change Section */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold mb-6">Change Password</h2>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Current Password</label>
                  <input
                    type="password"
                    value={password.current}
                    onChange={e => setPassword({...password, current: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">New Password</label>
                  <input
                    type="password"
                    value={password.new}
                    onChange={e => setPassword({...password, new: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={password.confirm}
                    onChange={e => setPassword({...password, confirm: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <button 
                  onClick={handlePasswordChange} 
                  disabled={isUpdatingPassword}
                  className="bg-emerald-500 text-slate-950 font-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingPassword ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'billing' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                  <p className="text-[10px] uppercase font-black text-emerald-500 mb-1">Credits Remaining</p>
                  <p className="text-3xl font-black text-white">{user.credits || 0}</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                  <p className="text-[10px] uppercase font-black text-rose-500 mb-1">Credits Spent</p>
                  <p className="text-3xl font-black text-white">{(user.history?.length || 0) * 10}</p>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-6">Transaction History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="pb-4 text-[10px] uppercase font-black text-slate-500">Date</th>
                        <th className="pb-4 text-[10px] uppercase font-black text-slate-500">Credits</th>
                        <th className="pb-4 text-[10px] uppercase font-black text-slate-500">Amount</th>
                        <th className="pb-4 text-[10px] uppercase font-black text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(user.purchases || []).map((purchase, idx) => (
                        <tr key={idx}>
                          <td className="py-4 text-sm text-slate-300">{new Date(purchase.createdAt).toLocaleDateString()}</td>
                          <td className="py-4 text-sm text-white font-bold">+{purchase.credits}</td>
                          <td className="py-4 text-sm text-slate-300">${purchase.amount.toFixed(2)}</td>
                          <td className="py-4 text-sm">
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase">
                              {purchase.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!user.purchases || user.purchases.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 text-sm italic">No transactions found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-6">PayPal Invoices & Receipts</h2>
                <div className="space-y-4">
                  {(user.invoices || []).map((invoice, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                      <div>
                        <p className="text-sm font-bold text-white">{invoice.plan}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-black">{invoice.date} • {invoice.id}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-sm font-black text-white">{invoice.amount}</p>
                        <button 
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors border-none bg-transparent"
                        >
                          Download PDF
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!user.invoices || user.invoices.length === 0) && (
                    <div className="p-8 text-center text-slate-500 text-sm italic bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                      No invoices available yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AccountSettings;
