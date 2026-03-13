import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, storage, auth, uploadToStorage, adminAuth } from "./firebase";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const firebaseConfig = JSON.parse(fs.readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf-8'));
import { UserAccount, Review } from "../types";
import { client as paypalClient, paypal } from "./paypal";

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

const isAdminEmail = (email: string | undefined) => {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  return lowerEmail === 'verdiqmag@gmail.com' || lowerEmail === 'admin@verdiq.ai';
};

// Helper to verify Firebase ID token and get user info
const getUserFromAuth = async (authHeader: string | undefined): Promise<{ uid: string, email?: string } | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1]?.trim();
  
  if (!idToken || idToken === 'null' || idToken === 'undefined') {
    return null;
  }
  
  try {
    // If it's a mock token from our login, return the ID
    if (idToken.startsWith('mock-jwt-token-')) {
      const uid = idToken.replace('mock-jwt-token-', '');
      return { uid };
    }
    
    try {
      if (adminAuth) {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        return { uid: decodedToken.uid, email: decodedToken.email };
      } else {
        throw new Error("adminAuth is null");
      }
    } catch (verifyError) {
      console.warn("Token verification failed, attempting decode fallback", verifyError);
      // Fallback: Decode JWT without verification (use with caution in dev environments)
      const parts = idToken.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          // Verify audience matches our project
          if (payload.aud === firebaseConfig.projectId || payload.aud?.includes(firebaseConfig.projectId)) {
            return { uid: payload.sub || payload.user_id, email: payload.email };
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

const getUserIdFromAuth = async (authHeader: string | undefined) => {
  const auth = await getUserFromAuth(authHeader);
  return auth?.uid;
};

// Helper to sanitize user and include history
const getFullUser = async (userId: string) => {
  try {
    console.log(`[getFullUser] Fetching user: ${userId}`);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    
    const user = userDoc.data();
    console.log(`[getFullUser] Fetching reviews for user: ${userId}`);
    const reviewsSnapshot = await db.collection('reviews').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const history = reviewsSnapshot.docs.map(doc => doc.data());
    
    return sanitizeUser({ ...user, history });
  } catch (error) {
    console.error(`[getFullUser] Error fetching user ${userId}:`, error);
    throw error;
  }
};

// Middleware to check if user is admin
const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const auth = await getUserFromAuth(req.headers.authorization);
    const userId = auth?.uid;
    const userEmail = auth?.email;
    
    console.log(`[isAdmin] Checking userId: ${userId}, email: ${userEmail}`);
    if (!userId) {
      console.log("[isAdmin] No userId found in token");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    // Get email from token if document doesn't exist or doesn't have email
    const effectiveEmail = user?.email || userEmail;
    
    console.log(`[isAdmin] User found in DB: ${!!user}, Effective Email: ${effectiveEmail}, Role in DB: ${user?.role}`);
    
    const isSuperAdmin = isAdminEmail(effectiveEmail);
    const hasAdminRole = user?.role === 'admin';

    if (isSuperAdmin || hasAdminRole) {
      console.log(`[isAdmin] Access GRANTED for ${effectiveEmail || userId} (SuperAdmin: ${isSuperAdmin}, HasRole: ${hasAdminRole})`);
      next();
    } else {
      console.log(`[isAdmin] Access DENIED for ${effectiveEmail || 'unknown'}`);
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
  console.log("[signup] Request body:", JSON.stringify(req.body));
  try {
    const { email, password, name, id } = req.body;
    console.log("[signup] Checking if user exists:", email);
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    console.log("[signup] Snapshot empty:", snapshot.empty);
    if (!snapshot.empty) {
      return res.status(400).json({ message: "User already exists", detail: "User already exists" });
    }
    
    const userId = id || Math.random().toString(36).substring(2, 11);
    const isSpecialAdmin = isAdminEmail(email);
    const newUser = {
      id: userId,
      email,
      password,
      name,
      credits: isSpecialAdmin ? 999999 : 10,
      role: isSpecialAdmin ? 'admin' : 'user',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };
    
    console.log("[signup] Creating user:", userId);
    await usersRef.doc(userId).set(newUser);
    console.log("[signup] User created successfully");
    const sanitized = sanitizeUser(newUser);
    res.json({ ...sanitized, session: { access_token: "mock-jwt-token-" + userId } });
  } catch (error) {
    console.error("[signup] Error:", error);
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
    const auth = await getUserFromAuth(req.headers.authorization);
    const userId = auth?.uid;
    const userEmail = auth?.email;
    
    const requestingUserDoc = userId ? await db.collection('users').doc(userId).get() : null;
    const requestingUser = requestingUserDoc?.data();
    const isSuperAdmin = isAdminEmail(userEmail) || (requestingUser && isAdminEmail(requestingUser.email));
    const isAdminUser = isSuperAdmin || (requestingUser && requestingUser.role === 'admin');
    
    if (id !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const fullUser = await getFullUser(id);
    if (fullUser) {
      // Auto-upgrade admin emails if they are not already admins
      const effectiveEmail = fullUser.email || (id === userId ? userEmail : null);
      if (isAdminEmail(effectiveEmail) && fullUser.role !== 'admin') {
        console.log(`[getUser] Auto-upgrading ${effectiveEmail} to admin role`);
        await db.collection('users').doc(id).update({ 
          role: 'admin', 
          credits: 999999,
          email: effectiveEmail // Ensure email is stored
        });
        fullUser.role = 'admin';
        fullUser.credits = 999999;
        fullUser.email = effectiveEmail;
      }
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
  const auth = await getUserFromAuth(req.headers.authorization);
  const userId = auth?.uid;
  const userEmail = auth?.email;
  
  const requestingUserDoc = userId ? await db.collection('users').doc(userId).get() : null;
  const requestingUser = requestingUserDoc?.data();
  const isAdminUser = isAdminEmail(requestingUser?.email) || isAdminEmail(userEmail) || requestingUser?.role === 'admin';

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
  const fullUser = await getFullUser(id);
  res.json(fullUser);
});

app.delete("/api/users/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  await db.collection('users').doc(id).delete();
  res.json({ success: true });
});

// Credits
app.get("/api/credits/status", async (req, res) => {
  const userId = (await getUserFromAuth(req.headers.authorization))?.uid;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
  const userDoc = await db.collection('users').doc(userId).get();
  const user = userDoc.data();
  
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
    const snapshot = await db.collection('purchases').orderBy('createdAt', 'desc').get();
    const purchases = snapshot.docs.map(doc => doc.data());
    const totalEarnings = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({ purchases, totalEarnings });
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
    
    // This is now a legacy endpoint, but we'll keep it as a fallback for mock testing
    // In a real app, you'd verify with PayPal here.
    
    const packages: Record<string, { credits: number, price: number }> = {
      'topup_15': { credits: 15, price: 15 },
      'topup_35': { credits: 35, price: 25 },
      'topup_80': { credits: 80, price: 50 },
      'topup_140': { credits: 140, price: 85 }
    };

    const pkg = packages[packageId] || { credits: 10, price: 10 };
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const user = userDoc.data();

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

    await db.collection('purchases').doc(purchaseId).set(purchase);
    
    const newCredits = (user.credits || 0) + pkg.credits;
    await userRef.update({ credits: newCredits });

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
      // Update user credits
      const packages: Record<string, { credits: number, price: number }> = {
        'topup_15': { credits: 15, price: 15 },
        'topup_35': { credits: 35, price: 25 },
        'topup_80': { credits: 80, price: 50 },
        'topup_140': { credits: 140, price: 85 }
      };

      const pkg = packages[packageId];
      if (!pkg) return res.status(400).json({ message: "Invalid package" });

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const user = userDoc.data();

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

      await db.collection('purchases').doc(purchaseId).set(purchase);
      
      const newCredits = (user.credits || 0) + pkg.credits;
      await userRef.update({ credits: newCredits });

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

    const cost = action === 'publish' ? 5 : (action === 'edit' ? 3 : 10);
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

    const cost = action === 'publish' ? 5 : (action === 'edit' ? 3 : 10);
    
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
      const cost = 10;
      const newCredits = Math.max(0, (user?.credits || 0) - cost);
      
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
        const url = await uploadToStorage(review.songAudio, `songs/${reviewId}.wav`, 'audio/wav');
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

      if (review.artistPhotoUrl && review.artistPhotoUrl.startsWith('data:image')) {
        const base64 = review.artistPhotoUrl.split(',')[1];
        const mimeType = review.artistPhotoUrl.split(';')[0].split(':')[1];
        const ext = mimeType.split('/')[1] || 'png';
        const url = await uploadToStorage(base64, `artist_photos/${reviewId}.${ext}`, mimeType);
        if (url) {
          reviewToSave.artistPhotoUrl = url;
        }
      }
      
      await db.collection('reviews').doc(reviewId).set(reviewToSave);
      
      // Update user credits
      await userRef.update({ credits: newCredits });
      
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
    const auth = await getUserFromAuth(req.headers.authorization);
    const authUserId = auth?.uid;
    const userEmail = auth?.email;
    
    const requestingUserDoc = authUserId ? await db.collection('users').doc(authUserId).get() : null;
    const requestingUser = requestingUserDoc?.data();
    const isAdminUser = isAdminEmail(requestingUser?.email) || isAdminEmail(userEmail) || requestingUser?.role === 'admin';
    
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
      const url = await uploadToStorage(review.songAudio, `songs/${reviewId}.wav`, 'audio/wav');
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

    if (review.artistPhotoUrl && review.artistPhotoUrl.startsWith('data:image')) {
      const base64 = review.artistPhotoUrl.split(',')[1];
      const mimeType = review.artistPhotoUrl.split(';')[0].split(':')[1];
      const ext = mimeType.split('/')[1] || 'png';
      const url = await uploadToStorage(base64, `artist_photos/${reviewId}.${ext}`, mimeType);
      if (url) {
        reviewToUpdate.artistPhotoUrl = url;
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

// Support Tickets API
app.post("/api/support", async (req, res, next) => {
  try {
    const { name, email, subject, category, message } = req.body;
    const userId = await getUserIdFromAuth(req.headers.authorization);
    
    console.log(`[Support] Received message from ${email}: [${category}] ${subject}`);
    
    if (!name || !email || !subject || !category || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    const newTicket = {
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
    
    const ticketRef = await db.collection('support_tickets').add(newTicket);
    console.log("Created support ticket:", ticketRef.id, newTicket);
    res.status(201).json({ id: ticketRef.id, ...newTicket });
  } catch (error) {
    next(error);
  }
});

app.get("/api/support/my-tickets", async (req, res, next) => {
  try {
    const userId = await getUserIdFromAuth(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const snapshot = await db.collection('support_tickets').where('userId', '==', userId).get();
    const tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    tickets.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(tickets);
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
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    const isAdminUser = isAdminEmail(user?.email) || user?.role === 'admin';
    
    const ticketRef = db.collection('support_tickets').doc(id);
    const ticketDoc = await ticketRef.get();
    
    if (!ticketDoc.exists) return res.status(404).json({ message: "Ticket not found" });
    
    const ticket = ticketDoc.data();
    
    // Check if user owns the ticket or is admin
    if (ticket?.userId !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const newMessage = {
      sender: isAdminUser ? 'admin' : 'user',
      text,
      createdAt: new Date().toISOString()
    };
    
    const updateData: any = {
      messages: [...(ticket?.messages || []), newMessage],
      updatedAt: new Date().toISOString()
    };
    
    if (isAdminUser) {
      updateData.hasUnreadReply = true;
    } else {
      updateData.status = 'open'; // Re-open if user replies? Or just keep as is.
    }
    
    await ticketRef.update(updateData);
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
    
    const ticketRef = db.collection('support_tickets').doc(id);
    const ticketDoc = await ticketRef.get();
    
    if (!ticketDoc.exists) return res.status(404).json({ message: "Ticket not found" });
    if (ticketDoc.data()?.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    
    await ticketRef.update({ hasUnreadReply: false });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/support", isAdmin, async (req, res, next) => {
  try {
    console.log("[Admin] Fetching support tickets...");
    const snapshot = await db.collection('support_tickets').get();
    console.log(`[Admin] Found ${snapshot.size} tickets`);
    const tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    // Sort in memory to avoid requiring a Firestore composite index
    tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(tickets);
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
    
    const ticketRef = db.collection('support_tickets').doc(id);
    await ticketRef.update({ status, updatedAt: new Date().toISOString() });
    
    const updatedTicket = (await ticketRef.get()).data();
    res.json({ id, ...updatedTicket });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/support/:id", isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.collection('support_tickets').doc(id).delete();
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
