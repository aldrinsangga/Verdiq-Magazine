import React from 'react';
import AdminDashboard from './AdminDashboard';
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

interface AdminDashboardWrapperProps {
  currentUser: any;
  users: any[];
  setUsers: (users: any[]) => void;
  setAllReviews: (reviews: any[]) => void;
  onUpdateUser: (user: any) => Promise<any>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateReview: (review: any, userId: string) => Promise<void>;
  styleGuides: any[];
  onAddStyleGuide: (guide: any) => Promise<void>;
  onUpdateStyleGuide: (id: string, guide: any) => Promise<void>;
  onDeleteStyleGuide: (id: string) => Promise<void>;
}

const AdminDashboardWrapper: React.FC<AdminDashboardWrapperProps> = ({ 
  currentUser, 
  users, 
  setUsers, 
  setAllReviews, 
  onUpdateUser, 
  onDeleteUser, 
  onUpdateReview, 
  styleGuides, 
  onAddStyleGuide, 
  onUpdateStyleGuide, 
  onDeleteStyleGuide 
}) => {
  const [localUsers, setLocalUsers] = React.useState(users || []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const hasFetched = React.useRef(false);

  // Store setters in refs to avoid dependency issues
  const setUsersRef = React.useRef(setUsers);
  const setAllReviewsRef = React.useRef(setAllReviews);
  
  React.useEffect(() => {
    setUsersRef.current = setUsers;
    setAllReviewsRef.current = setAllReviews;
  });

  // Update local users when the prop changes
  React.useEffect(() => {
    if (users && users.length > 0) {
      setLocalUsers(users);
      // If we have users with full data (email field), don't need to refetch
      if (users[0]?.email) {
        hasFetched.current = true;
      }
    }
  }, [users]);

  // Fetch fresh data with auth headers on mount (only if needed)
  React.useEffect(() => {
    // Skip if we already have full user data
    if (hasFetched.current) return;
    
    // Check if current users have full data (admin view includes email)
    const hasFullData = localUsers.length > 0 && localUsers[0]?.email;
    if (hasFullData) {
      hasFetched.current = true;
      return;
    }
    
    hasFetched.current = true;

    let isMounted = true;
    setLoading(true);

    const fetchUsers = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/users`, { headers });
        
        if (!isMounted) return;
        
        if (res.ok) {
          const list = await res.json();
          if (isMounted) {
            setLocalUsers(list);
            setUsersRef.current(list);
            setAllReviewsRef.current(list.flatMap((u: any) => u.history || []));
          }
        } else {
          if (isMounted) {
            setError('Failed to load users');
          }
        }
      } catch (e) {
        console.error('AdminDashboardWrapper: Fetch error:', e);
        if (isMounted) {
          setError('Failed to fetch users');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [localUsers]);

  // Show loading only if we have no data at all
  if (loading && localUsers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-emerald-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error && localUsers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard 
      users={localUsers} 
      onUpdateUser={onUpdateUser} 
      onDeleteUser={onDeleteUser}
      onUpdateReview={onUpdateReview}
      styleGuides={styleGuides}
      onAddStyleGuide={onAddStyleGuide}
      onUpdateStyleGuide={onUpdateStyleGuide}
      onDeleteStyleGuide={onDeleteStyleGuide}
    />
  );
};

export default AdminDashboardWrapper;
