import React from 'react';
import SearchSection from './SearchSection';
import Auth from './Auth';
import ReviewDisplay from './ReviewDisplay';
import Dashboard from './Dashboard';
import Magazine from './Magazine';
import Podcasts from './Podcasts';
import Pricing from './Pricing';
import AccountSettings from './AccountSettings';
import AdminDashboardWrapper from './AdminDashboardWrapper';
import PrivacyPolicy from './PrivacyPolicy';
import TermsAndConditions from './TermsAndConditions';
import FAQ from './FAQ';
import ContactUs from './ContactUs';
import SubmissionGuide from './SubmissionGuide';
import ReferralDashboard from './ReferralDashboard';
import VerificationRequired from './VerificationRequired';
import { auth, isAdmin } from '../authClient';

interface MainContentProps {
  view: string;
  loading: boolean;
  status: string;
  currentUser: any;
  currentReview: any;
  currentAudioFile: any;
  allReviews: any[];
  users: any[];
  styleGuides: any[];
  creditStatus: any;
  targetPodcastId: string | null;
  adminUsers: { users: any[], total: number, limit: number, offset: number };
  adminReviews: { reviews: any[], total: number, limit: number, offset: number };
  setUsers: (users: any[]) => void;
  setAllReviews: (reviews: any[]) => void;
  setTargetPodcastId: (id: string | null) => void;
  fetchAdminUsers: (offset: number, limit: number, search?: string) => Promise<void>;
  fetchAdminReviews: (offset: number, limit: number) => Promise<void>;
  handleAnalyze: (data: any) => Promise<void>;
  handleLogin: (user: any) => void;
  handleUpdateReview: (review: any) => Promise<void>;
  handlePublish: (reviewId: string) => Promise<void>;
  handleUpdateProfile: (user: any) => Promise<any>;
  handleDeleteUser: (userId: string) => Promise<void>;
  handleAdminUpdateReview: (review: any, userId: string) => Promise<void>;
  handleDeleteReview: (reviewId: string) => Promise<void>;
  handleAddStyleGuide: (guide: any) => Promise<void>;
  handleUpdateStyleGuide: (id: string, guide: any) => Promise<void>;
  handleDeleteStyleGuide: (id: string) => Promise<void>;
  handleLogout: () => void;
  handleCancelAnalysis: () => void;
  refreshUserData: () => Promise<void>;
  accountTab: string;
  fetchReviewWithAudio: (id: string) => Promise<any>;
  navigateToReview: (review: any, viewOnly: boolean) => void;
  navigate: (view: string, extra?: string) => void;
  onContactSupport: () => void;
  paypalClientId: string;
}

const MainContent: React.FC<MainContentProps> = ({
  view,
  loading,
  status,
  currentUser,
  currentReview,
  currentAudioFile,
  allReviews,
  users,
  styleGuides,
  creditStatus,
  targetPodcastId,
  adminUsers,
  adminReviews,
  paypalClientId,
  setUsers,
  setAllReviews,
  setTargetPodcastId,
  fetchAdminUsers,
  fetchAdminReviews,
  handleAnalyze,
  handleLogin,
  handleUpdateReview,
  handlePublish,
  handleUpdateProfile,
  handleDeleteUser,
  handleAdminUpdateReview,
  handleDeleteReview,
  handleAddStyleGuide,
  handleUpdateStyleGuide,
  handleDeleteStyleGuide,
  handleLogout,
  handleCancelAnalysis,
  refreshUserData,
  accountTab,
  fetchReviewWithAudio,
  navigateToReview,
  navigate,
  onContactSupport
}) => {
  const isUnverified = currentUser && auth.currentUser && !auth.currentUser.emailVerified;

  return (
    <main className="pt-24 pb-16">
      {isUnverified && view !== 'magazine' && view !== 'podcasts' && view !== 'privacy' && view !== 'terms' && view !== 'faq' && view !== 'contact' && (
        <VerificationRequired email={auth.currentUser?.email || ''} onLogout={handleLogout} />
      )}
      {!isUnverified && view === 'landing' && (
        <SearchSection 
          onAnalyze={handleAnalyze} 
          onCancel={handleCancelAnalysis}
          isLoading={loading} 
          credits={currentUser?.credits || 0} 
          status={status} 
          isSubscribed={currentUser?.isSubscribed || false} 
          onNavigate={navigate}
        />
      )}
      {view === 'auth' && <Auth onLogin={handleLogin} onClose={() => navigate('landing')} />}
      {view === 'signup' && <Auth onLogin={handleLogin} onClose={() => navigate('landing')} initialMode="signup" />}
      {!isUnverified && view === 'review' && currentReview && (
        <ReviewDisplay 
          review={currentReview} 
          currentUser={currentUser}
          viewOnly={currentReview.viewOnly}
          onUpgrade={() => navigate('pricing')} 
          onSave={handleUpdateReview} 
          onPublish={handlePublish}
          onBack={() => navigate('magazine')}
          onViewPodcast={() => {
            setTargetPodcastId(currentReview.id);
            navigate('podcasts');
          }}
          onSelectReview={async (r) => {
            const fullReview = await fetchReviewWithAudio(r.id);
            navigateToReview(fullReview || r, true);
          }}
          allReviews={allReviews}
          canPublish={creditStatus?.features?.publish_magazine || false}
          audioFile={currentAudioFile}
          isSubscribed={creditStatus?.isSubscribed || currentUser?.isSubscribed || false}
          features={creditStatus?.features || {}}
          onNavigate={navigate}
        />
      )}
      {!isUnverified && view === 'dashboard' && currentUser && (
        <Dashboard 
          reviews={currentUser.history || []} 
          onUpdateReview={handleUpdateReview}
          onNavigate={navigate}
          onSelect={async (r) => { 
            console.log('Dashboard: Selecting review:', r.id);
            const fullReview = await fetchReviewWithAudio(r.id);
            if (fullReview) {
              console.log('Dashboard: Got full review with URLs');
              navigateToReview(fullReview, false);
            } else {
              console.warn('Dashboard: Failed to get full review, using cached data');
              navigateToReview(r, false);
            }
          }} 
        />
      )}
      {view === 'magazine' && (
        <Magazine 
          reviews={allReviews} 
          onSelect={async (r) => { 
            const fullReview = await fetchReviewWithAudio(r.id);
            navigateToReview(fullReview || r, true);
          }} 
          onNavigate={navigate}
        />
      )}
      {view === 'podcasts' && (
        <Podcasts 
          reviews={allReviews} 
          onSelectReview={async (r) => { 
            const fullReview = await fetchReviewWithAudio(r.id);
            navigateToReview(fullReview || r, false);
          }} 
          initialPodcastId={targetPodcastId}
          fetchReviewWithAudio={fetchReviewWithAudio}
        />
      )}
      {view === 'pricing' && (
        <Pricing 
          currentUser={currentUser}
          paypalClientId={paypalClientId}
          onUpgrade={async (data) => { 
            if (!currentUser) { navigate('auth'); return; }
            // Refresh user data from backend to get latest credits and purchases
            await refreshUserData();
            navigate('landing'); 
          }} 
        />
      )}
      {!isUnverified && view === 'account' && currentUser && (
        <AccountSettings 
          user={currentUser} 
          session={currentUser?.session}
          onUpdate={handleUpdateProfile} 
          initialTab={accountTab}
        />
      )}
      {!isUnverified && view === 'admin' && isAdmin(currentUser) && (
        <AdminDashboardWrapper 
          currentUser={currentUser}
          adminUsers={adminUsers}
          adminReviews={adminReviews}
          fetchAdminUsers={fetchAdminUsers}
          fetchAdminReviews={fetchAdminReviews}
          setUsers={setUsers}
          setAllReviews={setAllReviews}
          onUpdateUser={handleUpdateProfile} 
          onDeleteUser={handleDeleteUser}
          onUpdateReview={handleAdminUpdateReview}
          onDeleteReview={handleDeleteReview}
          styleGuides={styleGuides}
          onAddStyleGuide={handleAddStyleGuide}
          onUpdateStyleGuide={handleUpdateStyleGuide}
          onDeleteStyleGuide={handleDeleteStyleGuide}
        />
      )}
      {view === 'privacy' && <PrivacyPolicy />}
      {view === 'terms' && <TermsAndConditions />}
      {view === 'faq' && <FAQ onContactSupport={onContactSupport} />}
      {view === 'contact' && <ContactUs />}
      {view === 'guide' && <SubmissionGuide onNavigate={navigate} />}
      {!isUnverified && view === 'referrals' && currentUser && (
        <ReferralDashboard currentUser={currentUser} onNavigate={navigate} />
      )}
    </main>
  );
};

export default MainContent;
