import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, storage, auth, uploadToStorage, adminAuth } from "./firebase.ts";
import firebaseConfig from "../firebase-applet-config.json";
import { UserAccount, Review } from "../types.ts";

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

// Helper to verify Firebase ID token and get user
const getUserIdFromAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  try {
    // If it's a mock token from our login, return the ID
    if (idToken.startsWith('mock-jwt-token-')) {
      return idToken.replace('mock-jwt-token-', '');
    }
    
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (verifyError) {
      console.warn("Token verification failed, attempting decode fallback", verifyError);
      // Fallback: Decode JWT without verification (use with caution in dev environments)
      const parts = idToken.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          // Verify audience matches our project
          if (payload.aud === firebaseConfig.projectId || payload.aud?.includes(firebaseConfig.projectId)) {
            return payload.sub || payload.user_id;
          }
        } catch (e) {
          console.error("Failed to decode token payload", e);
        }
      }
      return null;
    }
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
};

// Middleware to check if user is admin
const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    console.log(`[isAdmin] Checking userId: ${userId}`);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    // Get email from token if document doesn't exist
    let userEmail = user?.email;
    if (!userEmail && !req.headers.authorization?.includes('mock-jwt-token-')) {
      try {
        const idToken = req.headers.authorization!.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        userEmail = decodedToken.email;
      } catch (e) {
        console.warn("[isAdmin] Could not get email from token", e);
      }
    }

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

app.get("/api/debug/firebase", async (req, res) => {
  try {
    const testDoc = await db.collection('health_check').doc('server_test').get();
    res.json({
      status: "ok",
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      testDocExists: testDoc.exists,
      config: {
        authDomain: firebaseConfig.authDomain,
        storageBucket: firebaseConfig.storageBucket
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message,
      code: error.code,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    });
  }
});

// API Routes

// Auth
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).where('password', '==', password).limit(1).get();
    
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const user = userDoc.data();
      
      if (user.mfaEnabled) {
        return res.json({ mfa_required: true, email });
      }

      const sanitized = sanitizeUser(user);
      res.json({
        ...sanitized,
        session: { access_token: "mock-jwt-token-" + userDoc.id }
      });
    } else {
      res.status(401).json({ message: "Invalid credentials", detail: "Invalid credentials" });
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const { email, password, name, id } = req.body;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (!snapshot.empty) {
      return res.status(400).json({ message: "User already exists", detail: "User already exists" });
    }
    
    const userId = id || Math.random().toString(36).substring(2, 11);
    const newUser = {
      id: userId,
      email,
      password,
      name,
      credits: 3,
      isSubscribed: false,
      role: 'user',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };
    
    await usersRef.doc(userId).set(newUser);
    const sanitized = sanitizeUser(newUser);
    res.json({ ...sanitized, session: { access_token: "mock-jwt-token-" + userId } });
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
    const snapshot = await db.collection('users').get();
    const users = await Promise.all(snapshot.docs.map(async doc => {
      try {
        const user = doc.data();
        const reviewsSnapshot = await db.collection('reviews').where('userId', '==', doc.id).orderBy('createdAt', 'desc').get();
        const history = reviewsSnapshot.docs.map(r => r.data());
        return sanitizeUser({ ...user, history });
      } catch (err) {
        console.error(`[GET /api/users] Error fetching history for user ${doc.id}:`, err);
        return sanitizeUser(doc.data());
      }
    }));
    res.json(users);
  } catch (error) {
    console.error("[GET /api/users] Error:", error);
    next(error);
  }
});

app.get("/api/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = await getUserIdFromAuth(req.headers.authorization);
    
    const requestingUserDoc = userId ? await db.collection('users').doc(userId).get() : null;
    const requestingUser = requestingUserDoc?.data();
    const isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');
    
    if (id !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const userDoc = await db.collection('users').doc(id).get();
    if (userDoc.exists) {
      const user = userDoc.data();
      // Fetch history from reviews collection
      const reviewsSnapshot = await db.collection('reviews').where('userId', '==', id).orderBy('createdAt', 'desc').get();
      const history = reviewsSnapshot.docs.map(doc => doc.data());
      res.json(sanitizeUser({ ...user, history }));
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
  
  const requestingUserDoc = userId ? await db.collection('users').doc(userId).get() : null;
  const requestingUser = requestingUserDoc?.data();
  const isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');

  if (id !== userId && !isAdminUser) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // Prevent non-admins from promoting themselves
  if (!isAdminUser && update.role) {
    delete update.role;
  }

  // Remove nested history from update if present
  if (update.history) delete update.history;

  await db.collection('users').doc(id).update(update);
  const updatedDoc = await db.collection('users').doc(id).get();
  res.json(sanitizeUser(updatedDoc.data()));
});

app.delete("/api/users/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  await db.collection('users').doc(id).delete();
  res.json({ success: true });
});

// Credits
app.get("/api/credits/status", async (req, res) => {
  const userId = await getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const userDoc = await db.collection('users').doc(userId).get();
  const user = userDoc.data();
  
  if (!user) return res.status(404).json({ message: "User not found" });
  
  res.json({ 
    credits: user.credits, 
    isSubscribed: user.isSubscribed || false, 
    plan: user.isSubscribed ? 'pro' : 'free' 
  });
});

app.get("/api/health", async (req, res) => {
  try {
    // Test Firestore connection
    await db.collection('health').doc('check').get();
    res.json({ status: "ok", firestore: "connected" });
  } catch (error: any) {
    console.error("Health check failed:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      code: error.code,
      details: error.details
    });
  }
});

app.post("/api/credits/check", async (req, res, next) => {
  try {
    const { action } = req.body;
    let userId = req.body.userId || await getUserIdFromAuth(req.headers.authorization);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cost = 3;
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
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

    const cost = 3;
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const user = userDoc.data();
    
    if (user) {
      const newCredits = Math.max(0, user.credits - cost);
      await userRef.update({ credits: newCredits });
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
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
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
      await db.collection('users').doc(userId).update({ mfaEnabled: true });
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
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).where('password', '==', password).limit(1).get();
    
    if (!snapshot.empty && (mfa_code === "123456" || mfa_code === "000000")) {
      const user = snapshot.docs[0].data();
      const sanitized = sanitizeUser(user);
      res.json({
        ...sanitized,
        session: { access_token: "mock-jwt-token-" + snapshot.docs[0].id }
      });
    } else {
      res.status(401).json({ detail: "Invalid MFA code. Try 123456." });
    }
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

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const user = userDoc.data();
      const newCredits = Math.max(0, (user?.credits || 0) - 3);
      
      // Save review to separate collection
      const reviewId = review.id || Math.random().toString(36).substring(2, 11);
      const reviewToSave = { ...review, id: reviewId, userId };
      
      // Handle large audio data - upload to storage
      if (review.podcastAudio && review.podcastAudio.length > 1000) {
        const url = await uploadToStorage(review.podcastAudio, `podcasts/${reviewId}.wav`, 'audio/wav');
        if (url) {
          reviewToSave.podcastAudio = url;
          reviewToSave.hasPodcast = true;
        } else {
          delete reviewToSave.podcastAudio;
        }
      }
      
      if (review.songAudio && review.songAudio.length > 1000) {
        const url = await uploadToStorage(review.songAudio, `songs/${reviewId}.mp3`, 'audio/mpeg');
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
        const url = await uploadToStorage(base64, `images/${reviewId}.${ext}`, mimeType);
        if (url) {
          reviewToSave.imageUrl = url;
        }
      }
      
      await db.collection('reviews').doc(reviewId).set(reviewToSave);
      
      // Update user credits
      await userRef.update({ credits: newCredits });
      
      const updatedUserDoc = await userRef.get();
      res.json(sanitizeUser(updatedUserDoc.data()));
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
    
    const requestingUserDoc = authUserId ? await db.collection('users').doc(authUserId).get() : null;
    const requestingUser = requestingUserDoc?.data();
    const isAdminUser = requestingUser && (requestingUser.role === 'admin' || requestingUser.email === 'verdiqmag@gmail.com' || requestingUser.email === 'admin@verdiq.ai');
    
    if (userId !== authUserId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const reviewToUpdate = { ...review };
    
    // Handle large audio data - upload to storage
    if (review.podcastAudio && review.podcastAudio.length > 1000 && !review.podcastAudio.startsWith('http')) {
      const url = await uploadToStorage(review.podcastAudio, `podcasts/${reviewId}.wav`, 'audio/wav');
      if (url) {
        reviewToUpdate.podcastAudio = url;
        reviewToUpdate.hasPodcast = true;
      } else {
        delete reviewToUpdate.podcastAudio;
      }
    }
    
    if (review.songAudio && review.songAudio.length > 1000 && !review.songAudio.startsWith('http')) {
      const url = await uploadToStorage(review.songAudio, `songs/${reviewId}.mp3`, 'audio/mpeg');
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
      const url = await uploadToStorage(base64, `images/${reviewId}.${ext}`, mimeType);
      if (url) {
        reviewToUpdate.imageUrl = url;
      }
    }

    await db.collection('reviews').doc(reviewId).update(reviewToUpdate);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/published-reviews", async (req, res, next) => {
  try {
    const snapshot = await db.collection('reviews').where('isPublished', '==', true).orderBy('createdAt', 'desc').get();
    const reviews = snapshot.docs.map(doc => doc.data());
    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/reviews/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('reviews').doc(id).get();
    if (doc.exists) {
      res.json(doc.data());
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
    const doc = await db.collection('reviews').doc(id).get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.status(404).json({ message: "Review not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/podcasts/stats", async (req, res, next) => {
  try {
    const snapshot = await db.collection('reviews').where('hasPodcast', '==', true).get();
    const playCounts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      playCounts[doc.id] = data.playCount || 0;
    });
    res.json({ play_counts: playCounts });
  } catch (error) {
    next(error);
  }
});

app.post("/api/podcasts/:id/play", async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviewRef = db.collection('reviews').doc(id);
    const doc = await reviewRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      const newCount = (data?.playCount || 0) + 1;
      await reviewRef.update({ playCount: newCount });
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
    const snapshot = await db.collection('styleGuides').get();
    const guides = snapshot.docs.map(doc => doc.data());
    res.json(guides);
  } catch (error) {
    next(error);
  }
});

// Style Guides (Admin only)
app.get("/api/style-guides", isAdmin, async (req, res, next) => {
  try {
    const snapshot = await db.collection('styleGuides').orderBy('createdAt', 'desc').get();
    const guides = snapshot.docs.map(doc => doc.data());
    res.json(guides);
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
    
    await db.collection('styleGuides').doc(guideId).set(guideToSave);
    res.json(guideToSave);
  } catch (error) {
    next(error);
  }
});

app.put("/api/style-guides/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = req.body;
    await db.collection('styleGuides').doc(id).update(update);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/style-guides/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.collection('styleGuides').doc(id).delete();
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
      message: "Firestore Permission Denied. Please ensure the Cloud Firestore API is enabled in your Google Cloud project and the database is initialized.",
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
