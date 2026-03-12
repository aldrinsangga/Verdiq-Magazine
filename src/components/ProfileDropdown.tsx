import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, CreditCard, HelpCircle, LogOut, ChevronDown, Settings } from 'lucide-react';

interface ProfileDropdownProps {
  user: any;
  onLogout: () => void;
  onNavigate: (view: any) => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, onLogout, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    ...((user?.role === 'admin' || user?.email === 'verdiqmag@gmail.com') ? [{ 
      label: 'Admin Dashboard', 
      icon: User, 
      onClick: () => { onNavigate('admin'); setIsOpen(false); } 
    }] : []),
    { 
      label: 'Edit Profile', 
      icon: Settings, 
      onClick: () => { onNavigate('account'); setIsOpen(false); } 
    },
    { 
      label: 'Billing Details', 
      icon: CreditCard, 
      onClick: () => { onNavigate('pricing'); setIsOpen(false); } 
    },
    { 
      label: 'Help Center', 
      icon: HelpCircle, 
      onClick: () => { onNavigate('faq'); setIsOpen(false); } 
    },
  ];

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 pr-3 rounded-full bg-slate-900 border border-white/5 hover:border-emerald-500/30 transition-all group border-none"
        data-testid="profile-trigger"
      >
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 overflow-hidden group-hover:rotate-[360deg] transition-transform duration-700">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="hidden lg:block text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-1">{user?.name || 'Artist'}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter leading-none">{(user?.role === 'admin' || user?.email === 'verdiqmag@gmail.com') ? 'Studio Admin' : 'Artist Pro'}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-64 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[100] backdrop-blur-xl"
            data-testid="profile-menu"
          >
            {/* User Header */}
            <div className="p-6 border-b border-white/5 bg-white/5">
              <p className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Signed in as</p>
              <p className="text-sm font-bold text-white truncate">{user?.email}</p>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {menuItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold border-none bg-transparent"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="p-2 border-t border-white/5">
              <button
                onClick={() => { onLogout(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all text-sm font-bold border-none bg-transparent"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileDropdown;
