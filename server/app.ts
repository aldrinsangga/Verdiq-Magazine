import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase, verifyJWT, getUserById, uploadToStorage } from "./supabaseClient.ts";
import { UserAccount, Review } from "../types.ts";
import { client as paypalClient, paypal } from "./paypal.ts";

dotenv.config({ override: true });

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Strip password from user objects before sending to client
const sanitizeUser = (user: any): Omit<UserAccount, 'password'> => {
  const { password, ...safe } = user;
  return safe as any;
};

// Helper to verify Supabase JWT token and get user
const getUserIdFromAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();

  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  try {
    const result = await verifyJWT(token);
    return result?.userId || null;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
};

// Helper to sanitize user and include history
const getFullUser = async (userId: string) => {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) return null;

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false });

  const history = reviews || [];

  return sanitizeUser({ ...user, history });
};

// Middleware to check if user is admin
const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    console.log(`[isAdmin] Checking userId: ${userId}`);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const userEmail = user?.email;

    console.log(`[isAdmin] User found: ${!!user}, Email: ${userEmail}, Role: ${user?.role}`);

    const isSuperAdmin = userEmail === 'verdiqmag@gmail.com' || userEmail === 'admin@verdiq.ai';
    const hasAdminRole = user?.role === 'admin';

    if (isSuperAdmin || hasAdminRole) {
      console.log(`[isAdmin] Access granted for ${userEmail || userId}`);
      next();
    } else {
      console.log(`[isAdmin] Access denied for ${userEmail || 'unknown'}`);
      res.status(403).json({ message: "Forbidden: Admin access required" });
    }
  } catch (error) {
    console.error("[isAdmin] Error:", error);
    next(error);
  }
};

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.get("/api/ping", (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

app.get("/api/debug/supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    res.json({
      status: "ok",
      connected: !error,
      supabaseUrl: process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// API Routes

// Auth
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ message: "Invalid credentials", detail: error.message });
    }

    if (!data.session || !data.user) {
      return res.status(401).json({ message: "Invalid credentials", detail: "No session returned" });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (user?.mfaEnabled) {
      return res.json({ mfa_required: true, email });
    }

    const sanitized = user ? sanitizeUser(user) : { id: data.user.id, email: data.user.email };
    res.json({
      ...sanitized,
      session: { access_token: data.session.access_token }
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ message: error.message, detail: error.message });
    }

    if (!data.session || !data.user) {
      return res.status(400).json({ message: "Signup failed", detail: "No session returned" });
    }

    const newUser = {
      id: data.user.id,
      email,
      name,
      credits: 10,
      role: 'user',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };

    await supabase
      .from('users')
      .insert(newUser);

    const sanitized = sanitizeUser(newUser);
    res.json({ ...sanitized, session: { access_token: data.session.access_token } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res) => {
  res.json({ success: true });
});

// Users
app.get("/api/users", isAdmin, async (req, res, next) => {
  try {
    console.log("[GET /api/users] Fetching all users");
    const { data: users, error } = await supabase
      .from('users')
      .select('*');

    if (error) throw error;

    const usersWithHistory = await Promise.all((users || []).map(async user => {
      try {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('*')
          .eq('userId', user.id)
          .order('createdAt', { ascending: false });

        return sanitizeUser({ ...user, history: reviews || [] });
      } catch (err) {
        console.error(`[GET /api/users] Error fetching history for user ${user.id}:`, err);
        return sanitizeUser(user);
      }
    }));
    res.json(usersWithHistory);
  } catch (error) {
    console.error("[GET /api/users] Error:", error);
    next(error);
  }
});

app.get("/api/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = await getUserIdFromAuth(req.headers.authorization);

    let isAdminUser = false;
    if (userId) {
      const { data: requestingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');
    }

    if (id !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const fullUser = await getFullUser(id);
    if (fullUser) {
      res.json(fullUser);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const update = req.body;
  const userId = await getUserIdFromAuth(req.headers.authorization);

  let isAdminUser = false;
  if (userId) {
    const { data: requestingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');
  }

  if (id !== userId && !isAdminUser) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!isAdminUser && update.role) {
    delete update.role;
  }

  if (update.history) delete update.history;

  await supabase
    .from('users')
    .update(update)
    .eq('id', id);

  const fullUser = await getFullUser(id);
  res.json(fullUser);
});

app.delete("/api/users/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  await supabase
    .from('users')
    .delete()
    .eq('id', id);
  res.json({ success: true });
});

// Credits
app.get("/api/credits/status", async (req, res) => {
  const userId = await getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    credits: user.credits,
    isSubscribed: !!user.isSubscribed,
    features: user.isSubscribed ? {
      publish_magazine: true,
      pdf_download: true,
      edit_reviews: true,
      priority_support: true
    } : {
      publish_magazine: false,
      pdf_download: false,
      edit_reviews: false,
      priority_support: false
    }
  });
});

// Earnings & Purchases (Admin only)
app.get("/api/admin/earnings", isAdmin, async (req, res, next) => {
  try {
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const totalEarnings = (purchases || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({ purchases: purchases || [], totalEarnings });
  } catch (error) {
    next(error);
  }
});

// Mock purchase recording (for top-up simulation)
app.post("/api/credits/topup/execute", async (req, res, next) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { paymentId, payerId, packageId } = req.body;

    const packages: Record<string, { credits: number, price: number }> = {
      'topup_15': { credits: 15, price: 15 },
      'topup_35': { credits: 35, price: 25 },
      'topup_80': { credits: 80, price: 50 },
      'topup_140': { credits: 140, price: 85 }
    };

    const pkg = packages[packageId] || { credits: 10, price: 10 };

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!user) return res.status(404).json({ message: "User not found" });

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

    await supabase
      .from('purchases')
      .insert(purchase);

    const newCredits = (user.credits || 0) + pkg.credits;
    await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);

    res.json({ success: true, credits: newCredits, purchase });
  } catch (error) {
    next(error);
  }
});

// PayPal Order Creation
app.post("/api/paypal/create-order", async (req, res, next) => {
  try {
    const { packageId } = req.body;
    const packages: Record<string, { credits: number, price: number, name: string }> = {
      'topup_15': { credits: 15, price: 15, name: '15 Credits Top-up' },
      'topup_35': { credits: 35, price: 25, name: '35 Credits Top-up' },
      'topup_80': { credits: 80, price: 50, name: '80 Credits Top-up' },
      'topup_140': { credits: 140, price: 85, name: '140 Credits Top-up' }
    };

    const pkg = packages[packageId];
    if (!pkg) return res.status(400).json({ message: "Invalid package" });

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: pkg.price.toString(),
          },
          description: pkg.name
        },
      ],
    });

    const order = await paypalClient().execute(request);
    res.json({ id: order.result.id });
  } catch (error) {
    console.error("PayPal Create Order Error:", error);
    next(error);
  }
});

// PayPal Order Capture
app.post("/api/paypal/capture-order", async (req, res, next) => {
  try {
    const { orderId, packageId } = req.body;
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({} as any);

    const capture = await paypalClient().execute(request);

    if (capture.result.status === "COMPLETED") {
      const packages: Record<string, { credits: number, price: number }> = {
        'topup_15': { credits: 15, price: 15 },
        'topup_35': { credits: 35, price: 25 },
        'topup_80': { credits: 80, price: 50 },
        'topup_140': { credits: 140, price: 85 }
      };

      const pkg = packages[packageId];
      if (!pkg) return res.status(400).json({ message: "Invalid package" });

      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!user) return res.status(404).json({ message: "User not found" });

      const purchaseId = `pur_${orderId}`;
      const purchase = {
        id: purchaseId,
        userId,
        userName: user.name,
        userEmail: user.email,
        amount: pkg.price,
        credits: pkg.credits,
        status: 'completed',
        createdAt: new Date().toISOString(),
        paymentMethod: 'PayPal',
        paypalOrderId: orderId
      };

      await supabase
        .from('purchases')
        .insert(purchase);

      const newCredits = (user.credits || 0) + pkg.credits;
      await supabase
        .from('users')
        .update({ credits: newCredits })
        .eq('id', userId);

      res.json({ success: true, credits: newCredits, purchase });
    } else {
      res.status(400).json({ message: "Payment not completed" });
    }
  } catch (error) {
    console.error("PayPal Capture Order Error:", error);
    next(error);
  }
});

// PayPal Subscription Order Creation
// Removed as per user request (Credit model only)

// PayPal Subscription Order Capture
// Removed as per user request (Credit model only)
app.get("/api/health", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    res.json({ status: "ok", supabase: error ? "error" : "connected" });
  } catch (error: any) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

app.post("/api/credits/check", async (req, res, next) => {
  try {
    const { action } = req.body;
    let userId = req.body.userId || await getUserIdFromAuth(req.headers.authorization);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cost = action === 'publish' ? 5 : (action === 'edit' ? 3 : 10);
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (user) {
      const canAfford = user.credits >= cost;
      res.json({
        canAfford,
        cost,
        remaining: user.credits,
        message: canAfford ? "OK" : "Insufficient credits"
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/credits/deduct", async (req, res, next) => {
  try {
    const { action } = req.body;
    let userId = req.body.userId || await getUserIdFromAuth(req.headers.authorization);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cost = action === 'publish' ? 5 : (action === 'edit' ? 3 : 10);

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (user) {
      const newCredits = Math.max(0, user.credits - cost);
      await supabase
        .from('users')
        .update({ credits: newCredits })
        .eq('id', userId);
      res.json({ success: true, deducted: cost, remaining: newCredits });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
});

// MFA Endpoints (Mock)
app.get("/api/auth/mfa/status", async (req, res, next) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    res.json({ mfa_enabled: user?.mfaEnabled || false });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/mfa/setup", async (req, res, next) => {
  try {
    res.json({
      qr_code: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Verdiq:Admin?secret=MOCKSECRET123&issuer=Verdiq",
      manual_entry_key: "MOCKSECRET123"
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/mfa/verify-setup", async (req, res, next) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { code } = req.body;
    if (code === "123456" || code === "000000") {
      await supabase
        .from('users')
        .update({ mfaEnabled: true })
        .eq('id', userId);
      res.json({ success: true });
    } else {
      res.status(400).json({ detail: "Invalid verification code. Try 123456." });
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/mfa/verify", async (req, res, next) => {
  try {
    const { email, password, mfa_code } = req.body;

    if (mfa_code !== "123456" && mfa_code !== "000000") {
      return res.status(401).json({ detail: "Invalid MFA code. Try 123456." });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({ detail: "Invalid credentials" });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const sanitized = user ? sanitizeUser(user) : { id: data.user.id, email: data.user.email };
    res.json({
      ...sanitized,
      session: { access_token: data.session.access_token }
    });
  } catch (error) {
    next(error);
  }
});

// Reviews
app.post("/api/reviews", async (req, res, next) => {
  try {
    const { userId, review } = req.body;
    const authUserId = await getUserIdFromAuth(req.headers.authorization);

    if (!authUserId || authUserId !== userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (user) {
      const cost = 10;
      const newCredits = Math.max(0, (user?.credits || 0) - cost);

      const reviewId = review.id || Math.random().toString(36).substring(2, 11);
      const reviewToSave = { ...review, id: reviewId, userId };

      if (review.podcastAudio && review.podcastAudio.length > 1000) {
        const buffer = Buffer.from(review.podcastAudio, 'base64');
        const url = await uploadToStorage(buffer, `podcasts/${reviewId}.wav`, 'audio/wav');
        if (url) {
          reviewToSave.podcastAudio = url;
          reviewToSave.hasPodcast = true;
        } else {
          delete reviewToSave.podcastAudio;
        }
      }

      if (review.songAudio && review.songAudio.length > 1000) {
        const buffer = Buffer.from(review.songAudio, 'base64');
        const url = await uploadToStorage(buffer, `songs/${reviewId}.wav`, 'audio/wav');
        if (url) {
          reviewToSave.songAudio = url;
        } else {
          delete reviewToSave.songAudio;
        }
      }

      if (review.imageUrl && review.imageUrl.startsWith('data:image')) {
        const base64 = review.imageUrl.split(',')[1];
        const mimeType = review.imageUrl.split(';')[0].split(':')[1];
        const ext = mimeType.split('/')[1] || 'png';
        const buffer = Buffer.from(base64, 'base64');
        const url = await uploadToStorage(buffer, `images/${reviewId}.${ext}`, mimeType);
        if (url) {
          reviewToSave.imageUrl = url;
        }
      }

      if (review.artistPhotoUrl && review.artistPhotoUrl.startsWith('data:image')) {
        const base64 = review.artistPhotoUrl.split(',')[1];
        const mimeType = review.artistPhotoUrl.split(';')[0].split(':')[1];
        const ext = mimeType.split('/')[1] || 'png';
        const buffer = Buffer.from(base64, 'base64');
        const url = await uploadToStorage(buffer, `artist_photos/${reviewId}.${ext}`, mimeType);
        if (url) {
          reviewToSave.artistPhotoUrl = url;
        }
      }

      await supabase
        .from('reviews')
        .insert(reviewToSave);

      await supabase
        .from('users')
        .update({ credits: newCredits })
        .eq('id', userId);

      const fullUser = await getFullUser(userId);
      res.json(fullUser);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.put("/api/reviews/:reviewId", async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { userId, review } = req.body;
    const authUserId = await getUserIdFromAuth(req.headers.authorization);

    let isAdminUser = false;
    if (authUserId) {
      const { data: requestingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');
    }

    if (userId !== authUserId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const reviewToUpdate = { ...review };

    if (review.podcastAudio && review.podcastAudio.length > 1000 && !review.podcastAudio.startsWith('http')) {
      const buffer = Buffer.from(review.podcastAudio, 'base64');
      const url = await uploadToStorage(buffer, `podcasts/${reviewId}.wav`, 'audio/wav');
      if (url) {
        reviewToUpdate.podcastAudio = url;
        reviewToUpdate.hasPodcast = true;
      } else {
        delete reviewToUpdate.podcastAudio;
      }
    }

    if (review.songAudio && review.songAudio.length > 1000 && !review.songAudio.startsWith('http')) {
      const buffer = Buffer.from(review.songAudio, 'base64');
      const url = await uploadToStorage(buffer, `songs/${reviewId}.wav`, 'audio/wav');
      if (url) {
        reviewToUpdate.songAudio = url;
      } else {
        delete reviewToUpdate.songAudio;
      }
    }

    if (review.imageUrl && review.imageUrl.startsWith('data:image')) {
      const base64 = review.imageUrl.split(',')[1];
      const mimeType = review.imageUrl.split(';')[0].split(':')[1];
      const ext = mimeType.split('/')[1] || 'png';
      const buffer = Buffer.from(base64, 'base64');
      const url = await uploadToStorage(buffer, `images/${reviewId}.${ext}`, mimeType);
      if (url) {
        reviewToUpdate.imageUrl = url;
      }
    }

    if (review.artistPhotoUrl && review.artistPhotoUrl.startsWith('data:image')) {
      const base64 = review.artistPhotoUrl.split(',')[1];
      const mimeType = review.artistPhotoUrl.split(';')[0].split(':')[1];
      const ext = mimeType.split('/')[1] || 'png';
      const buffer = Buffer.from(base64, 'base64');
      const url = await uploadToStorage(buffer, `artist_photos/${reviewId}.${ext}`, mimeType);
      if (url) {
        reviewToUpdate.artistPhotoUrl = url;
      }
    }

    await supabase
      .from('reviews')
      .update(reviewToUpdate)
      .eq('id', reviewId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/published-reviews", async (req, res, next) => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('isPublished', true)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json(reviews || []);
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/reviews/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: review, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (review) {
      res.json(review);
    } else {
      res.status(404).json({ message: "Review not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/reviews/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: review, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (review) {
      res.json(review);
    } else {
      res.status(404).json({ message: "Review not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/podcasts/stats", async (req, res, next) => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('id, playCount')
      .eq('hasPodcast', true);

    if (error) throw error;

    const playCounts: Record<string, number> = {};
    (reviews || []).forEach(review => {
      playCounts[review.id] = review.playCount || 0;
    });
    res.json({ play_counts: playCounts });
  } catch (error) {
    next(error);
  }
});

app.post("/api/podcasts/:id/play", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: review, error: fetchError } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (review) {
      const newCount = (review.playCount || 0) + 1;
      await supabase
        .from('reviews')
        .update({ playCount: newCount })
        .eq('id', id);
      return res.json({ play_count: newCount });
    }
    res.status(404).json({ message: "Podcast not found" });
  } catch (error) {
    next(error);
  }
});

// Public Style Guides (for AI training)
app.get("/api/public/style-guides", async (req, res, next) => {
  try {
    const { data: guides, error } = await supabase
      .from('styleGuides')
      .select('*');

    if (error) throw error;

    res.json(guides || []);
  } catch (error) {
    next(error);
  }
});

// Style Guides (Admin only)
app.get("/api/style-guides", isAdmin, async (req, res, next) => {
  try {
    const { data: guides, error } = await supabase
      .from('styleGuides')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json(guides || []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/style-guides", isAdmin, async (req, res, next) => {
  try {
    const guide = req.body;
    const guideId = guide.id || Math.random().toString(36).substring(2, 11);
    const guideToSave = {
      ...guide,
      id: guideId,
      createdAt: new Date().toISOString()
    };

    await supabase
      .from('styleGuides')
      .insert(guideToSave);

    res.json(guideToSave);
  } catch (error) {
    next(error);
  }
});

app.put("/api/style-guides/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = req.body;
    await supabase
      .from('styleGuides')
      .update(update)
      .eq('id', id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/style-guides/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase
      .from('styleGuides')
      .delete()
      .eq('id', id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Support Tickets API
app.post("/api/support", async (req, res, next) => {
  try {
    const { name, email, subject, category, message } = req.body;
    const userId = await getUserIdFromAuth(req.headers.authorization);

    console.log(`[Support] Received message from ${email}: [${category}] ${subject}`);

    if (!name || !email || !subject || !category || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const ticketId = Math.random().toString(36).substring(2, 11);
    const newTicket = {
      id: ticketId,
      userId: userId || null,
      name,
      email,
      subject,
      category,
      message,
      status: 'open',
      createdAt: new Date().toISOString(),
      messages: [],
      hasUnreadReply: false
    };

    await supabase
      .from('support_tickets')
      .insert(newTicket);

    console.log("Created support ticket:", ticketId, newTicket);
    res.status(201).json(newTicket);
  } catch (error) {
    next(error);
  }
});

app.get("/api/support/my-tickets", async (req, res, next) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json(tickets || []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/support/:id/message", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = await getUserIdFromAuth(req.headers.authorization);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!text) return res.status(400).json({ message: "Message text is required" });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const isAdminUser = user?.role === 'admin' || user?.email === 'verdiqmag@gmail.com';

    const { data: ticket, error: fetchError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.userId !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const newMessage = {
      sender: isAdminUser ? 'admin' : 'user',
      text,
      createdAt: new Date().toISOString()
    };

    const updateData: any = {
      messages: [...(ticket.messages || []), newMessage],
      updatedAt: new Date().toISOString()
    };

    if (isAdminUser) {
      updateData.hasUnreadReply = true;
    } else {
      updateData.status = 'open';
    }

    await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', id);

    res.json({ success: true, message: newMessage });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/support/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { data: ticket, error: fetchError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !ticket) return res.status(404).json({ message: "Ticket not found" });
    if (ticket.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    await supabase
      .from('support_tickets')
      .update({ hasUnreadReply: false })
      .eq('id', id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/support", isAdmin, async (req, res, next) => {
  try {
    console.log("[Admin] Fetching support tickets...");
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    console.log(`[Admin] Found ${tickets?.length || 0} tickets`);
    res.json(tickets || []);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/support/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['open', 'resolved', 'follow-up', 'closed', 'deleted'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    await supabase
      .from('support_tickets')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', id);

    const { data: updatedTicket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    res.json(updatedTicket);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/support/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase
      .from('support_tickets')
      .delete()
      .eq('id', id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("=== SERVER ERROR ===");
  console.error("Message:", err.message);
  console.error("Code:", err.code);
  console.error("Stack:", err.stack);
  if (err.details) console.error("Details:", err.details);

  if (err.code === 7 || err.message?.includes('PERMISSION_DENIED')) {
    return res.status(403).json({
      message: "Database Permission Denied. Please check your database configuration.",
      detail: err.message,
      code: err.code
    });
  }

  res.status(err.status || 500).json({ 
    message: err.message || "Internal server error", 
    detail: err.message,
    code: err.code,
    details: err.details
  });
});

export default app;
