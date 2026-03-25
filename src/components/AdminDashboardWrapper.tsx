import React from 'react';
import AdminDashboard from './AdminDashboard';
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

interface AdminDashboardWrapperProps {
  currentUser: any;
  adminUsers: { users: any[], total: number, limit: number, offset: number };
  adminReviews: { reviews: any[], total: number, limit: number, offset: number };
  fetchAdminUsers: (offset: number, limit: number, search?: string) => Promise<void>;
  fetchAdminReviews: (offset: number, limit: number) => Promise<void>;
  setUsers: (users: any[]) => void;
  setAllReviews: (reviews: any[]) => void;
  onUpdateUser: (user: any) => Promise<any>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateReview: (review: any, userId: string) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  styleGuides: any[];
  onAddStyleGuide: (guide: any) => Promise<void>;
  onUpdateStyleGuide: (id: string, guide: any) => Promise<void>;
  onDeleteStyleGuide: (id: string) => Promise<void>;
}

const AdminDashboardWrapper: React.FC<AdminDashboardWrapperProps> = ({ 
  currentUser, 
  adminUsers,
  adminReviews,
  fetchAdminUsers,
  fetchAdminReviews,
  setUsers, 
  setAllReviews, 
  onUpdateUser, 
  onDeleteUser, 
  onUpdateReview, 
  onDeleteReview,
  styleGuides, 
  onAddStyleGuide, 
  onUpdateStyleGuide, 
  onDeleteStyleGuide 
}) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <AdminDashboard 
      users={adminUsers.users}
      totalUsers={adminUsers.total}
      usersLimit={adminUsers.limit}
      usersOffset={adminUsers.offset}
      fetchUsers={fetchAdminUsers}
      reviews={adminReviews.reviews}
      totalReviews={adminReviews.total}
      reviewsLimit={adminReviews.limit}
      reviewsOffset={adminReviews.offset}
      fetchReviews={fetchAdminReviews}
      onUpdateUser={onUpdateUser} 
      onDeleteUser={onDeleteUser}
      onUpdateReview={onUpdateReview}
      onDeleteReview={onDeleteReview}
      styleGuides={styleGuides}
      onAddStyleGuide={onAddStyleGuide}
      onUpdateStyleGuide={onUpdateStyleGuide}
      onDeleteStyleGuide={onDeleteStyleGuide}
    />
  );
};

export default AdminDashboardWrapper;
