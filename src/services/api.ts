import { supabase } from '../supabaseClient';

async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

async function requireAuth(): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin' || data?.email === 'verdiqmag@gmail.com' || data?.email === 'admin@verdiq.ai';
}

export const api = {
  // ---- Public ----
  async getPublishedReviews() {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('isPublished', true)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPublicReview(id: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getPublicStyleGuides() {
    const { data, error } = await supabase
      .from('styleGuides')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async getPodcastStats() {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, playCount')
      .eq('hasPodcast', true);
    if (error) throw error;
    const playCounts: Record<string, number> = {};
    (data || []).forEach(r => { playCounts[r.id] = r.playCount || 0; });
    return { play_counts: playCounts };
  },

  async recordPodcastPlay(id: string) {
    const { data: review, error: fetchError } = await supabase
      .from('reviews')
      .select('playCount')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!review) throw new Error('Podcast not found');
    const newCount = (review.playCount || 0) + 1;
    const { error } = await supabase
      .from('reviews')
      .update({ playCount: newCount })
      .eq('id', id);
    if (error) throw error;
    return { play_count: newCount };
  },

  async getReview(id: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ---- Auth-required: Users ----
  async getUser(id: string) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (id !== userId && !admin) throw new Error('Forbidden');

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!user) throw new Error('User not found');

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('userId', id)
      .order('createdAt', { ascending: false });

    const { password, ...safe } = user as any;
    return { ...safe, history: reviews || [] };
  },

  async getAllUsers() {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { data: users, error } = await supabase
      .from('users')
      .select('*');
    if (error) throw error;

    const result = await Promise.all((users || []).map(async (user: any) => {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('userId', user.id)
        .order('createdAt', { ascending: false });
      const { password, ...safe } = user;
      return { ...safe, history: reviews || [] };
    }));
    return result;
  },

  async updateUser(id: string, update: any) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (id !== userId && !admin) throw new Error('Forbidden');
    if (!admin && update.role) delete update.role;
    if (update.history) delete update.history;

    const { error } = await supabase
      .from('users')
      .update(update)
      .eq('id', id);
    if (error) throw error;

    return api.getUser(id);
  },

  async deleteUser(id: string) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ---- Credits ----
  async getCreditStatus() {
    const userId = await requireAuth();
    const { data: user, error } = await supabase
      .from('users')
      .select('credits, isSubscribed')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) throw new Error('User not found');

    return {
      credits: user.credits,
      isSubscribed: !!(user as any).isSubscribed,
      features: (user as any).isSubscribed ? {
        publish_magazine: true, pdf_download: true, edit_reviews: true, priority_support: true
      } : {
        publish_magazine: false, pdf_download: false, edit_reviews: false, priority_support: false
      }
    };
  },

  async checkCredits(action: string) {
    const userId = await requireAuth();
    const cost = action === 'publish' ? 5 : (action === 'edit' ? 3 : 10);
    const { data: user, error } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) throw new Error('User not found');
    const canAfford = user.credits >= cost;
    return { canAfford, cost, remaining: user.credits, message: canAfford ? 'OK' : 'Insufficient credits' };
  },

  async deductCredits(action: string) {
    const userId = await requireAuth();
    const cost = action === 'publish' ? 5 : (action === 'edit' ? 3 : 10);
    const { data: user, error } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) throw new Error('User not found');
    const newCredits = Math.max(0, user.credits - cost);
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);
    if (updateError) throw updateError;
    return { success: true, deducted: cost, remaining: newCredits };
  },

  // ---- Reviews CRUD ----
  async createReview(userId: string, review: any) {
    const authUserId = await requireAuth();
    if (authUserId !== userId) throw new Error('Unauthorized');

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) throw new Error('User not found');

    const cost = 10;
    const newCredits = Math.max(0, (user.credits || 0) - cost);
    const reviewId = review.id || Math.random().toString(36).substring(2, 11);
    const reviewToSave = { ...review, id: reviewId, userId };

    const { error: insertError } = await supabase
      .from('reviews')
      .insert(reviewToSave);
    if (insertError) throw insertError;

    const { error: creditError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);
    if (creditError) throw creditError;

    return api.getUser(userId);
  },

  async updateReview(reviewId: string, userId: string, review: any) {
    const authUserId = await requireAuth();
    const admin = await isAdminUser(authUserId);
    if (userId !== authUserId && !admin) throw new Error('Forbidden');

    const { error } = await supabase
      .from('reviews')
      .update(review)
      .eq('id', reviewId);
    if (error) throw error;
    return { success: true };
  },

  // ---- Style Guides (Admin) ----
  async getStyleGuides() {
    const { data, error } = await supabase
      .from('styleGuides')
      .select('*')
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createStyleGuide(guide: any) {
    const guideId = guide.id || Math.random().toString(36).substring(2, 11);
    const toSave = { ...guide, id: guideId, createdAt: new Date().toISOString() };
    const { error } = await supabase
      .from('styleGuides')
      .insert(toSave);
    if (error) throw error;
    return toSave;
  },

  async updateStyleGuide(id: string, update: any) {
    const { error } = await supabase
      .from('styleGuides')
      .update(update)
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async deleteStyleGuide(id: string) {
    const { error } = await supabase
      .from('styleGuides')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ---- Support Tickets ----
  async createSupportTicket(ticket: { name: string; email: string; subject: string; category: string; message: string }) {
    const userId = await getAuthUserId();
    const ticketId = Math.random().toString(36).substring(2, 11);
    const newTicket = {
      id: ticketId,
      userId: userId || null,
      ...ticket,
      status: 'open',
      createdAt: new Date().toISOString(),
      messages: [],
      hasUnreadReply: false
    };
    const { error } = await supabase
      .from('support_tickets')
      .insert(newTicket);
    if (error) throw error;
    return newTicket;
  },

  async getMyTickets() {
    const userId = await requireAuth();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addTicketMessage(ticketId: string, text: string) {
    const userId = await requireAuth();
    const { data: user } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', userId)
      .maybeSingle();

    const isAdmin = user?.role === 'admin' || user?.email === 'verdiqmag@gmail.com';

    const { data: ticket, error: fetchError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();
    if (fetchError || !ticket) throw new Error('Ticket not found');
    if (ticket.userId !== userId && !isAdmin) throw new Error('Forbidden');

    const newMessage = { sender: isAdmin ? 'admin' : 'user', text, createdAt: new Date().toISOString() };
    const updateData: any = {
      messages: [...(ticket.messages || []), newMessage],
      updatedAt: new Date().toISOString()
    };
    if (isAdmin) updateData.hasUnreadReply = true;
    else updateData.status = 'open';

    const { error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId);
    if (error) throw error;
    return { success: true, message: newMessage };
  },

  async markTicketRead(ticketId: string) {
    const userId = await requireAuth();
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('userId')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket || ticket.userId !== userId) throw new Error('Forbidden');

    const { error } = await supabase
      .from('support_tickets')
      .update({ hasUnreadReply: false })
      .eq('id', ticketId);
    if (error) throw error;
    return { success: true };
  },

  // ---- Admin: Support ----
  async getAdminSupportTickets() {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateTicketStatus(ticketId: string, status: string) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { error } = await supabase
      .from('support_tickets')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', ticketId);
    if (error) throw error;

    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();
    return data;
  },

  async deleteTicket(ticketId: string) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', ticketId);
    if (error) throw error;
    return { success: true };
  },

  // ---- Admin: Earnings ----
  async getAdminEarnings() {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .order('createdAt', { ascending: false });
    if (error) throw error;
    const totalEarnings = (purchases || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    return { purchases: purchases || [], totalEarnings };
  },

  // ---- MFA (Mock) ----
  async getMFAStatus() {
    const userId = await requireAuth();
    const { data } = await supabase
      .from('users')
      .select('mfaEnabled')
      .eq('id', userId)
      .maybeSingle();
    return { mfa_enabled: data?.mfaEnabled || false };
  },

  async setupMFA() {
    return {
      qr_code: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Verdiq:Admin?secret=MOCKSECRET123&issuer=Verdiq',
      manual_entry_key: 'MOCKSECRET123'
    };
  },

  async verifyMFASetup(code: string) {
    const userId = await requireAuth();
    if (code === '123456' || code === '000000') {
      const { error } = await supabase
        .from('users')
        .update({ mfaEnabled: true })
        .eq('id', userId);
      if (error) throw error;
      return { success: true };
    }
    throw new Error('Invalid verification code. Try 123456.');
  },

  async verifyMFA(email: string, password: string, mfaCode: string) {
    if (mfaCode !== '123456' && mfaCode !== '000000') {
      throw new Error('Invalid MFA code. Try 123456.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) throw new Error('Invalid credentials');

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const { password: pw, ...safe } = (user || { id: data.user.id, email: data.user.email }) as any;
    return { ...safe, session: { access_token: data.session.access_token } };
  },

  // ---- Credits Top-up (no PayPal - simple recording) ----
  async executeTopup(packageId: string) {
    const userId = await requireAuth();
    const packages: Record<string, { credits: number; price: number }> = {
      'topup_15': { credits: 15, price: 15 },
      'topup_35': { credits: 35, price: 25 },
      'topup_80': { credits: 80, price: 50 },
      'topup_140': { credits: 140, price: 85 }
    };
    const pkg = packages[packageId] || { credits: 10, price: 10 };

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credits, name, email')
      .eq('id', userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) throw new Error('User not found');

    const purchaseId = `pur_${Math.random().toString(36).substring(2, 11)}`;
    const purchase = {
      id: purchaseId,
      userId,
      userName: user.name,
      userEmail: user.email,
      amount: pkg.price,
      credits: pkg.credits,
      status: 'completed',
      createdAt: new Date().toISOString(),
      paymentMethod: 'PayPal'
    };

    const { error: insertError } = await supabase.from('purchases').insert(purchase);
    if (insertError) throw insertError;

    const newCredits = (user.credits || 0) + pkg.credits;
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);
    if (updateError) throw updateError;

    return { success: true, credits: newCredits, purchase };
  }
};
