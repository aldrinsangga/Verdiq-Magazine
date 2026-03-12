import { supabase } from '../supabaseClient';

// Convert snake_case to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// Convert camelCase to snake_case for specific keys
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

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
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return toCamelCase(data || []);
  },

  async getPublicReview(id: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return toCamelCase(data);
  },

  async getPublicStyleGuides() {
    const { data, error } = await supabase
      .from('style_guides')
      .select('*');
    if (error) throw error;
    return toCamelCase(data || []);
  },

  async getPodcastStats() {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, play_count')
      .eq('has_podcast', true);
    if (error) throw error;
    const playCounts: Record<string, number> = {};
    (data || []).forEach(r => { playCounts[r.id] = r.play_count || 0; });
    return { play_counts: playCounts };
  },

  async recordPodcastPlay(id: string) {
    const { data: review, error: fetchError } = await supabase
      .from('reviews')
      .select('play_count')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!review) throw new Error('Podcast not found');
    const newCount = (review.play_count || 0) + 1;
    const { error } = await supabase
      .from('reviews')
      .update({ play_count: newCount })
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
    return toCamelCase(data);
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
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    return toCamelCase({ ...user, history: reviews || [] });
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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return { ...user, history: reviews || [] };
    }));
    return toCamelCase(result);
  },

  async updateUser(id: string, update: any) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (id !== userId && !admin) throw new Error('Forbidden');
    if (!admin && update.role) delete update.role;
    if (update.history) delete update.history;

    const snakeUpdate = toSnakeCase(update);
    const { error } = await supabase
      .from('users')
      .update(snakeUpdate)
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
      .select('credits, is_subscribed')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) throw new Error('User not found');

    return {
      credits: user.credits,
      isSubscribed: !!user.is_subscribed,
      features: user.is_subscribed ? {
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
    const reviewId = review.id || crypto.randomUUID();

    const allowedFields: Record<string, any> = {
      id: reviewId,
      user_id: userId,
      song_title: review.songTitle,
      artist_name: review.artistName,
      headline: review.headline,
      hook: review.hook,
      review_body: review.reviewBody,
      rating: review.rating,
      image_url: review.imageUrl,
      artist_photo_url: review.artistPhotoUrl,
      podcast_audio: review.podcastAudio || null,
      has_podcast: !!review.hasPodcast,
      is_published: review.isPublished || false,
      is_deleted: review.isDeleted || false,
      breakdown: review.breakdown || null,
      analysis: review.analysis || null,
      semantic_synergy: review.semanticSynergy || null,
      sounds_like: review.soundsLike || null,
      best_moment: review.bestMoment || null,
      who_is_it_for: review.whoIsItFor || null,
      timestamp_highlights: review.timestampHighlights || null,
      pull_quotes: review.pullQuotes || null,
      seo: review.seo || null,
      similar_songs: review.similarSongs || null,
      playlist_ideas: review.playlistIdeas || null,
      market_score: review.marketScore || null,
      created_at: review.createdAt || new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('reviews')
      .insert(allowedFields);
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

    const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
    if (review.songTitle !== undefined) updateFields.song_title = review.songTitle;
    if (review.artistName !== undefined) updateFields.artist_name = review.artistName;
    if (review.headline !== undefined) updateFields.headline = review.headline;
    if (review.hook !== undefined) updateFields.hook = review.hook;
    if (review.reviewBody !== undefined) updateFields.review_body = review.reviewBody;
    if (review.rating !== undefined) updateFields.rating = review.rating;
    if (review.imageUrl !== undefined) updateFields.image_url = review.imageUrl;
    if (review.artistPhotoUrl !== undefined) updateFields.artist_photo_url = review.artistPhotoUrl;
    if (review.podcastAudio !== undefined) updateFields.podcast_audio = review.podcastAudio;
    if (review.hasPodcast !== undefined) updateFields.has_podcast = review.hasPodcast;
    if (review.isPublished !== undefined) updateFields.is_published = review.isPublished;
    if (review.isDeleted !== undefined) updateFields.is_deleted = review.isDeleted;
    if (review.breakdown !== undefined) updateFields.breakdown = review.breakdown;
    if (review.analysis !== undefined) updateFields.analysis = review.analysis;
    if (review.semanticSynergy !== undefined) updateFields.semantic_synergy = review.semanticSynergy;
    if (review.soundsLike !== undefined) updateFields.sounds_like = review.soundsLike;
    if (review.bestMoment !== undefined) updateFields.best_moment = review.bestMoment;
    if (review.whoIsItFor !== undefined) updateFields.who_is_it_for = review.whoIsItFor;
    if (review.timestampHighlights !== undefined) updateFields.timestamp_highlights = review.timestampHighlights;
    if (review.pullQuotes !== undefined) updateFields.pull_quotes = review.pullQuotes;
    if (review.seo !== undefined) updateFields.seo = review.seo;
    if (review.similarSongs !== undefined) updateFields.similar_songs = review.similarSongs;
    if (review.playlistIdeas !== undefined) updateFields.playlist_ideas = review.playlistIdeas;
    if (review.marketScore !== undefined) updateFields.market_score = review.marketScore;

    const { error } = await supabase
      .from('reviews')
      .update(updateFields)
      .eq('id', reviewId);
    if (error) throw error;
    return { success: true };
  },

  // ---- Style Guides (Admin) ----
  async getStyleGuides() {
    const { data, error } = await supabase
      .from('style_guides')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return toCamelCase(data || []);
  },

  async createStyleGuide(guide: any) {
    const guideId = guide.id || Math.random().toString(36).substring(2, 11);
    const toSave = toSnakeCase({ ...guide, id: guideId, createdAt: new Date().toISOString() });
    const { error } = await supabase
      .from('style_guides')
      .insert(toSave);
    if (error) throw error;
    return toCamelCase(toSave);
  },

  async updateStyleGuide(id: string, update: any) {
    const { error } = await supabase
      .from('style_guides')
      .update(toSnakeCase(update))
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async deleteStyleGuide(id: string) {
    const { error } = await supabase
      .from('style_guides')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // ---- Support Tickets ----
  async createSupportTicket(ticket: { name: string; email: string; subject: string; category: string; message: string }) {
    const userId = await getAuthUserId();
    const ticketId = Math.random().toString(36).substring(2, 11);
    const newTicket = toSnakeCase({
      id: ticketId,
      userId: userId || null,
      ...ticket,
      status: 'open',
      createdAt: new Date().toISOString(),
      messages: [],
      hasUnreadReply: false
    });
    const { error } = await supabase
      .from('support_tickets')
      .insert(newTicket);
    if (error) throw error;
    return toCamelCase(newTicket);
  },

  async getMyTickets() {
    const userId = await requireAuth();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return toCamelCase(data || []);
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
    if (ticket.user_id !== userId && !isAdmin) throw new Error('Forbidden');

    const newMessage = { sender: isAdmin ? 'admin' : 'user', text, createdAt: new Date().toISOString() };
    const updateData: any = {
      messages: [...(ticket.messages || []), newMessage],
      updated_at: new Date().toISOString()
    };
    if (isAdmin) updateData.has_unread_reply = true;
    else updateData.status = 'open';

    const { error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId);
    if (error) throw error;
    return { success: true, message: toCamelCase(newMessage) };
  },

  async markTicketRead(ticketId: string) {
    const userId = await requireAuth();
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket || ticket.user_id !== userId) throw new Error('Forbidden');

    const { error } = await supabase
      .from('support_tickets')
      .update({ has_unread_reply: false })
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
      .order('created_at', { ascending: false });
    if (error) throw error;
    return toCamelCase(data || []);
  },

  async updateTicketStatus(ticketId: string, status: string) {
    const userId = await requireAuth();
    const admin = await isAdminUser(userId);
    if (!admin) throw new Error('Forbidden');

    const { error } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId);
    if (error) throw error;

    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();
    return toCamelCase(data);
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
      .order('created_at', { ascending: false });
    if (error) throw error;
    const totalEarnings = (purchases || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    return { purchases: toCamelCase(purchases || []), totalEarnings };
  },

  // ---- MFA (Mock) ----
  async getMFAStatus() {
    const userId = await requireAuth();
    const { data } = await supabase
      .from('users')
      .select('mfa_enabled')
      .eq('id', userId)
      .maybeSingle();
    return { mfa_enabled: data?.mfa_enabled || false };
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
        .update({ mfa_enabled: true })
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

    return toCamelCase({ ...(user || { id: data.user.id, email: data.user.email }), session: { access_token: data.session.access_token } });
  },

  // ---- Credits Top-up ----
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
      user_id: userId,
      user_name: user.name,
      user_email: user.email,
      amount: pkg.price,
      credits: pkg.credits,
      status: 'completed',
      created_at: new Date().toISOString(),
      payment_method: 'PayPal'
    };

    const { error: insertError } = await supabase.from('purchases').insert(purchase);
    if (insertError) throw insertError;

    const newCredits = (user.credits || 0) + pkg.credits;
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);
    if (updateError) throw updateError;

    return { success: true, credits: newCredits, purchase: toCamelCase(purchase) };
  }
};
