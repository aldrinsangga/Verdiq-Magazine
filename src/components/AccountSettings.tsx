import React, { useState } from 'react';
import MFASetup from './MFASetup';

const AccountSettings = ({ user, session, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email
  });
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });

  const handleProfileUpdate = () => {
    onUpdate({ ...user, name: formData.name, email: formData.email });
    alert('Profile updated successfully!');
  };

  const handlePasswordChange = () => {
    if (password.new !== password.confirm) {
      alert('Passwords do not match!');
      return;
    }
    if (password.current !== user.password) {
      alert('Current password is incorrect!');
      return;
    }
    onUpdate({ ...user, password: password.new });
    setPassword({ current: '', new: '', confirm: '' });
    alert('Password updated successfully!');
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
              <button onClick={handleProfileUpdate} className="bg-emerald-500 text-slate-950 font-black px-6 py-3 rounded-xl" data-testid="save-profile-btn">
                Save Changes
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* MFA Section - Only show for admins */}
              {(user.role === 'admin' || user.email === 'verdiqmag@gmail.com') && (
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
                <button onClick={handlePasswordChange} className="bg-emerald-500 text-slate-950 font-black px-6 py-3 rounded-xl">
                  Update Password
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AccountSettings;
