import React from 'react';
import ProfileDropdown from './ProfileDropdown';
import CreditCounter from './CreditCounter';

interface NavigationProps {
  view: string;
  currentUser: any;
  creditStatus: any;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  navigate: (view: string, extra?: string) => void;
  handleLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  view,
  currentUser,
  creditStatus,
  mobileMenuOpen,
  setMobileMenuOpen,
  navigate,
  handleLogout
}) => {
  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-slate-800/50" data-testid="main-nav">
      <div className="max-w-[1440px] mx-auto px-8 h-24 flex items-center justify-between">
        <a 
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('landing');
          }} 
          className="text-2xl font-black cursor-pointer tracking-tighter flex items-center gap-3 group border-none bg-transparent" 
          data-testid="logo"
        >
          <div className="w-10 h-10 bg-emerald-500 rounded-xl group-hover:rotate-[360deg] transition-transform duration-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <div className="w-5 h-5 bg-slate-950 rounded-sm" />
          </div>
          <span className="gradient-text">Verdiq</span>
        </a>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-12">
          <a 
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('landing');
            }} 
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'landing' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} 
            data-testid="nav-submit"
          >
            Submit
          </a>
          <a 
            href="/magazine"
            onClick={(e) => {
              e.preventDefault();
              navigate('magazine');
            }} 
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'magazine' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} 
            data-testid="nav-magazine"
          >
            Magazine
          </a>
          <a 
            href="/podcasts"
            onClick={(e) => {
              e.preventDefault();
              navigate('podcasts');
            }} 
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'podcasts' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} 
            data-testid="nav-podcasts"
          >
            Podcasts
          </a>
          <a 
            href="/studio"
            onClick={(e) => {
              e.preventDefault();
              navigate('dashboard');
            }} 
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'dashboard' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} border-none bg-transparent`} 
            data-testid="nav-dashboard"
          >
            Studio History
          </a>
        </div>

        <div className="flex items-center gap-4">
          {/* Mobile Hamburger Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors border-none bg-transparent"
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {currentUser ? (
            <div className="flex items-center gap-4">
              <CreditCounter
                credits={creditStatus?.credits || currentUser?.credits || 0}
                monthlyCredits={creditStatus?.monthlyCredits || 0}
                plan={creditStatus?.plan || 'free'}
                isSubscribed={false}
                onBuyCredits={() => navigate('pricing')}
                onManageSubscription={() => navigate('pricing')}
                onNavigate={navigate}
              />
              <div className="w-px h-8 bg-slate-800 mx-2" />
              <ProfileDropdown 
                user={currentUser} 
                onLogout={handleLogout} 
                onNavigate={navigate} 
              />
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <a 
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('auth');
                }} 
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors border-none bg-transparent" 
                data-testid="login-btn"
              >
                Login
              </a>
              <a 
                href="/pricing"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('pricing');
                }} 
                className="btn-primary !px-6 !py-2.5 !text-xs" 
                data-testid="go-pro-btn"
              >
                Go Pro
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-800" data-testid="mobile-menu">
          <div className="px-6 py-4 flex flex-col gap-2">
            <a 
              href="/"
              onClick={(e) => { e.preventDefault(); navigate('landing'); setMobileMenuOpen(false); }} 
              className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'landing' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent block`}
              data-testid="mobile-nav-submit"
            >
              Submit Track
            </a>
            <a 
              href="/magazine"
              onClick={(e) => { e.preventDefault(); navigate('magazine'); setMobileMenuOpen(false); }} 
              className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'magazine' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent block`}
              data-testid="mobile-nav-magazine"
            >
              Magazine
            </a>
            <a 
              href="/podcasts"
              onClick={(e) => { e.preventDefault(); navigate('podcasts'); setMobileMenuOpen(false); }} 
              className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'podcasts' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent block`}
              data-testid="mobile-nav-podcasts"
            >
              Podcasts
            </a>
            <a 
              href="/studio"
              onClick={(e) => { e.preventDefault(); navigate('dashboard'); setMobileMenuOpen(false); }} 
              className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent block`}
              data-testid="mobile-nav-dashboard"
            >
              Studio History
            </a>
            {currentUser && (
              <a 
                href="/referrals"
                onClick={(e) => { e.preventDefault(); navigate('referrals'); setMobileMenuOpen(false); }} 
                className={`text-left py-3 px-4 rounded-lg text-sm font-bold transition-colors ${view === 'referrals' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'} border-none bg-transparent block`}
                data-testid="mobile-nav-referrals"
              >
                Referral Program
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
