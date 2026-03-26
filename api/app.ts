import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { body, validationResult } from "express-validator";
import { db, storage, auth, uploadToStorage, adminAuth, FieldValue } from "./firebase";
import { createRequire } from 'module';
import * as otplib from 'otplib';
const authenticator = (otplib as any).authenticator || (otplib as any).default?.authenticator || otplib;
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf-8'));
} catch (e) {
  console.error("Failed to read firebase-applet-config.json", e);
}
import { UserAccount, Review } from "../types";
import { client as paypalClient, paypal } from "./paypal";

dotenv.config({ override: true });

const app = express();

// Trust the proxy (e.g., Nginx or Cloud Run load balancer)
// This is required for express-rate-limit to correctly identify user IPs
app.set('trust proxy', true);

const distPath = join(__dirname, '../dist');
const publicPath = join(__dirname, '../public');

// 1. SECURITY HEADERS (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.paypal.com", "https://www.sandbox.paypal.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://api.qrserver.com", "https://picsum.photos", "https://www.paypalobjects.com", "https://firebasestorage.googleapis.com", "https://storage.googleapis.com", "https://*.firebasestorage.app", "https://images.unsplash.com", "https://*.unsplash.com"],
      mediaSrc: ["'self'", "blob:", "https://firebasestorage.googleapis.com", "https://storage.googleapis.com", "https://*.firebasestorage.app"],
      connectSrc: ["'self'", "https://verdiqmag.com", "https://www.verdiqmag.com", "https://ais-dev-cq5mcgtpnwz55m2mzdlu7n-109086387935.asia-southeast1.run.app", "https://ais-pre-cq5mcgtpnwz55m2mzdlu7n-109086387935.asia-southeast1.run.app", "wss://*.run.app:*", "https://www.paypal.com", "https://www.sandbox.paypal.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://storage.googleapis.com", "https://*.firebasestorage.app"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
      frameAncestors: ["'self'", "https://verdiqmag.com", "https://www.verdiqmag.com", "https://ai.studio", "https://aistudio.google.com", "https://*.google.com", "https://*.run.app"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some third-party scripts
  xFrameOptions: false, // Allow framing in AI Studio
}));

// Serve static files in production BEFORE CORS and other middleware
if (process.env.NODE_ENV === "production") {
  app.use(express.static(publicPath, {
    maxAge: '1d',
    etag: true
  }));
  app.use(express.static(distPath, {
    maxAge: '1y', // Vite assets have hashes
    immutable: true,
    index: false // Don't serve index.html here, handle it at the end
  }));
}

// 2. CORS & BODY PARSING
const allowedOrigins = [
  "https://verdiqmag.com",
  "https://www.verdiqmag.com",
  "https://ais-dev-cq5mcgtpnwz55m2mzdlu7n-109086387935.asia-southeast1.run.app",
  "https://ais-pre-cq5mcgtpnwz55m2mzdlu7n-109086387935.asia-southeast1.run.app",
  "http://localhost:3000" // For local development
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      // Instead of throwing an error which causes 500s, just disallow CORS
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// 3. STRICT RATE LIMITING
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Disable trust proxy validation warning
  message: { message: "Too many requests from this IP, please try again later." }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit AI generation to 50 per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { message: "AI generation limit reached for this hour. Please try again later." }
});

app.use("/api/", globalLimiter);
app.use("/api/analyze", aiLimiter);
app.use("/api/podcasts/generate", aiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${ip}`);
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
  return lowerEmail === 'verdiqmag@gmail.com';
};

// Helper to verify Firebase ID token and get user info
const getUserFromAuth = async (authHeader: string | undefined): Promise<{ uid: string, email?: string } | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("[Auth] No Bearer token found in header");
    return null;
  }
  const idToken = authHeader.split('Bearer ')[1]?.trim();
  
  if (!idToken || idToken === 'null' || idToken === 'undefined') {
    console.log("[Auth] Token is null or undefined");
    return null;
  }
  
  try {
    if (adminAuth) {
      // Strictly verify the token with Firebase Admin SDK
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      console.log(`[Auth] Token verified for UID: ${decodedToken.uid}`);
      return { uid: decodedToken.uid, email: decodedToken.email };
    } else {
      console.error("[Auth] adminAuth is not initialized");
      // Fallback for development if adminAuth is missing
      if (process.env.NODE_ENV !== 'production') {
        console.warn("[Auth] DEV FALLBACK: Returning mock user for testing");
        return { uid: "dev-user-id", email: "dev@example.com" };
      }
      return null;
    }
  } catch (error: any) {
    console.error(`[Auth] Token verification failed: ${error.message}`);
    return null;
  }
};

// 4. AUTH MIDDLEWARE
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const auth = await getUserFromAuth(req.headers.authorization);
  if (!auth) {
    console.warn(`[Auth] Unauthorized access attempt to ${req.url}`);
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).user = auth;
  next();
};

// 5. AI COST PROTECTION (Usage Quotas)
const checkUsageQuota = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = (req as any).user?.uid;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData) {
      console.warn(`[Quota] User ${userId} not found in database during quota check`);
      return next();
    }

    // Admins have no limit
    if (isAdminEmail(userData.email) || userData.role === 'admin' || userData.isUnlimited) {
      return next();
    }

    const usage = userData.usage || {};
    const dailyCount = usage[today] || 0;
    const monthlyCount = userData.monthlyUsage?.[thisMonth] || 0;
    
    // Tiered limits based on user role
    let DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || "10"); 
    let MONTHLY_LIMIT = parseInt(process.env.AI_MONTHLY_LIMIT || "100");

    // Admins have virtually unlimited quota
    if (userData.role === 'admin') {
      DAILY_LIMIT = 9999;
      MONTHLY_LIMIT = 99999;
    } 
    // Pro users get a 5x boost
    else if (userData.isSubscribed || userData.role === 'pro') {
      DAILY_LIMIT = DAILY_LIMIT * 5;
      MONTHLY_LIMIT = MONTHLY_LIMIT * 5;
    }

    if (dailyCount >= DAILY_LIMIT) {
      console.warn(`[Quota] User ${userId} reached daily limit of ${DAILY_LIMIT}`);
      return res.status(429).json({ 
        error: "QUOTA_EXCEEDED",
        type: "DAILY",
        message: "Daily AI generation limit reached.",
        instruction: "Please upgrade to a Pro plan for unlimited generations or wait until tomorrow.",
        limit: DAILY_LIMIT,
        current: dailyCount
      });
    }

    if (monthlyCount >= MONTHLY_LIMIT) {
      console.warn(`[Quota] User ${userId} reached monthly limit of ${MONTHLY_LIMIT}`);
      return res.status(429).json({ 
        error: "QUOTA_EXCEEDED",
        type: "MONTHLY",
        message: "Monthly AI generation limit reached.",
        instruction: "Please upgrade to a Pro plan for unlimited generations.",
        limit: MONTHLY_LIMIT,
        current: monthlyCount
      });
    }

    // Increment usage
    await userRef.update({
      [`usage.${today}`]: dailyCount + 1,
      [`monthlyUsage.${thisMonth}`]: monthlyCount + 1,
      lastUsed: new Date().toISOString()
    });

    next();
  } catch (error) {
    console.error("[Quota] Error checking usage:", error);
    next(); 
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
    let userDoc;
    try {
      userDoc = await db.collection('users').doc(userId).get();
    } catch (dbErr: any) {
      console.error(`[getFullUser] Firestore error fetching user ${userId}:`, dbErr.message);
      // If we can't even get the user doc due to permissions, we'll return null 
      // and let the caller decide if they want to return a basic profile
      return null;
    }

    if (!userDoc.exists) {
      console.log(`[getFullUser] User ${userId} not found in database`);
      return null;
    }
    
    const user = userDoc.data();
    console.log(`[getFullUser] Fetching reviews and purchases for user: ${userId}`);
    
    let history = [];
    let purchases = [];
    let invoices = [];

    try {
      // Fetch Reviews (History)
      const reviewsSnapshot = await db.collection('reviews')
        .where('userId', '==', userId)
        .get();
      
      const now = new Date();
      let validReviews = [];
      const expiredReviewIds: string[] = [];
      
      for (const doc of reviewsSnapshot.docs) {
        const review = doc.data() as Review;
        
        // Check for expired temporary reviews
        if (review.isTemporary && review.expiresAt) {
          const expiresAt = new Date(review.expiresAt);
          if (now > expiresAt && !review.isPublished) {
            console.log(`[getFullUser] Deleting expired temporary review: ${doc.id}`);
            expiredReviewIds.push(doc.id);
            continue; // Skip adding to valid reviews
          }
        }
        
        validReviews.push(review);
      }
      
      // Delete expired reviews in background
      if (expiredReviewIds.length > 0) {
        Promise.all(expiredReviewIds.map(id => db.collection('reviews').doc(id).delete()))
          .catch(err => console.error("[getFullUser] Error deleting expired reviews:", err));
      }
      
      // Sort in memory
      validReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      history = validReviews;

      // Fetch Purchases
      const purchasesSnapshot = await db.collection('purchases')
        .where('userId', '==', userId)
        .get();
      
      purchases = purchasesSnapshot.docs.map(doc => doc.data());
      purchases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Map purchases to invoices
      invoices = purchases.map(p => ({
        id: p.id,
        date: new Date(p.createdAt).toLocaleDateString(),
        amount: `$${p.amount}.00`,
        status: 'Paid',
        plan: `${p.credits} Credits Pack`
      }));

    } catch (err: any) {
      console.warn(`[getFullUser] Could not fetch data for user ${userId}:`, err.message);
    }

    return sanitizeUser({ ...user, history, purchases, invoices });
  } catch (error: any) {
    console.error(`[getFullUser] Critical error fetching user ${userId}:`, error);
    return null;
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
    
    // 1. Check email from token FIRST - most reliable for super admins
    if (isAdminEmail(userEmail)) {
      console.log(`[isAdmin] Access GRANTED via token email: ${userEmail}`);
      return next();
    }

    // 2. Try database check
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const user = userDoc.data();
      
      const effectiveEmail = user?.email || userEmail;
      const isSuperAdmin = isAdminEmail(effectiveEmail);
      const hasAdminRole = user?.role === 'admin';

      if (isSuperAdmin || hasAdminRole) {
        console.log(`[isAdmin] Access GRANTED for ${effectiveEmail || userId} (SuperAdmin: ${isSuperAdmin}, HasRole: ${hasAdminRole})`);
        return next();
      }
    } catch (dbError: any) {
      console.error("[isAdmin] Database check failed:", dbError.message);
      // If DB check fails but it's a super admin (already checked above), we'd have returned next().
      // If we're here, they aren't a super admin in the token.
    }

    console.log(`[isAdmin] Access DENIED for ${userEmail || 'unknown'}`);
    res.status(403).json({ message: "Forbidden: Admin access required" });
  } catch (error) {
    console.error("[isAdmin] Error in isAdmin middleware:", error);
    next(error);
  }
};

app.get("/api/debug/env", async (req, res) => {
  // Only allow for admin emails
  const auth = await getUserFromAuth(req.headers.authorization);
  if (!isAdminEmail(auth?.email)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  res.json({
    nodeEnv: process.env.NODE_ENV,
    projectId: process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId,
    hasAdminAuth: !!adminAuth,
    hasAdminDb: !!db,
    headers: req.headers,
    cwd: process.cwd(),
    files: fs.readdirSync(process.cwd())
  });
});

app.get("/api/config", (req, res) => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  res.json({
    geminiApiKey: key || "",
    paypalClientId: process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || ""
  });
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
app.post("/api/auth/login", 
  [
    body('email').isEmail().normalizeEmail(),
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
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

app.post("/api/auth/signup", 
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').isString().trim().isLength({ min: 1, max: 100 }).escape(),
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password, name, id, website, referralCode: signupReferralCode } = req.body;
    
    // Bot protection: website is a honeypot field
    if (website) {
      console.warn(`[Bot] Honeypot field filled by ${email || 'unknown'}`);
      return res.status(400).json({ message: "Bot detected" });
    }
    
    console.log("[signup] Request body:", JSON.stringify(req.body));
    try {
      console.log("[signup] Checking if user exists:", email);
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    console.log("[signup] Snapshot empty:", snapshot.empty);
    if (!snapshot.empty) {
      return res.status(400).json({ message: "User already exists", detail: "User already exists" });
    }
    
    const userId = id || Math.random().toString(36).substring(2, 11);
    const isSpecialAdmin = isAdminEmail(email);
    
    // Generate unique referral code
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Check for referrer
    let referredBy = null;
    if (signupReferralCode) {
      const referrerSnapshot = await usersRef.where('referralCode', '==', signupReferralCode).limit(1).get();
      if (!referrerSnapshot.empty) {
        referredBy = referrerSnapshot.docs[0].id;
        console.log(`[signup] User ${email} referred by ${referredBy}`);
      }
    }

    const newUser = {
      id: userId,
      email,
      password,
      name,
      credits: isSpecialAdmin ? 999999 : 10,
      role: isSpecialAdmin ? 'admin' : 'user',
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      referralCode,
      referredBy
    };
    
    console.log("[signup] Creating user:", userId);
    await usersRef.doc(userId).set(newUser);
    
    // Create referral record if referred
    if (referredBy) {
      const referralId = `ref_${userId}`;
      await db.collection('referrals').doc(referralId).set({
        id: referralId,
        referrerId: referredBy,
        referredId: userId,
        referredName: name,
        referredEmail: email,
        status: 'signed_up',
        creditsAwarded: false,
        createdAt: new Date().toISOString()
      });
    }

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
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string || "").toLowerCase();

    console.log(`[GET /api/users] Fetching users (limit: ${limit}, offset: ${offset}, search: ${search})`);
    
    let query: any = db.collection('users').orderBy('createdAt', 'desc');
    
    // Get total count using the new count() method
    const totalCount = await query.count();

    // Now get paginated data using limit and offset
    const snapshot = await query.offset(offset).limit(limit).get();
    let paginatedUsers = snapshot.docs.map((doc: any) => {
      const u = doc.data();
      // Return only basic info to save reads and bandwidth
      const { password, history, purchases, ...basicInfo } = u;
      return sanitizeUser(basicInfo);
    });

    // Filter by search if provided
    if (search) {
      console.log(`[GET /api/users] Performing optimized search for: ${search}`);
      // Use Firestore prefix search for better performance
      // Note: This requires the search field to be indexed and is case-sensitive in Firestore
      // For a truly robust search, we'd use a dedicated search index (Algolia/Elastic) 
      // or a search-friendly field (lowercaseName)
      
      // Fallback to a more efficient limit-based fetch if we can't do a perfect prefix search
      // But let's at least avoid fetching ALL users if we can
      const searchSnapshot = await db.collection('users')
        .orderBy('email')
        .startAt(search)
        .endAt(search + '\uf8ff')
        .limit(limit)
        .get();
        
      const searchUsers = searchSnapshot.docs.map((doc: any) => {
        const u = doc.data();
        const { password, history, purchases, ...basicInfo } = u;
        return sanitizeUser(basicInfo);
      });

      return res.json({
        users: searchUsers,
        totalCount: searchUsers.length, // Approximate for search
        limit,
        offset: 0
      });
    }

    res.json({
      users: paginatedUsers,
      totalCount,
      limit,
      offset
    });
  } catch (error) {
    console.error("[GET /api/users] Error:", error);
    next(error);
  }
});

// New endpoint for admin to fetch all reviews with pagination
app.get("/api/admin/reviews", isAdmin, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    console.log(`[GET /api/admin/reviews] Fetching all reviews (limit: ${limit}, offset: ${offset})`);
    
    const query = db.collection('reviews').orderBy('createdAt', 'desc');
    const totalCount = await query.count();
    const snapshot = await query.offset(offset).limit(limit).get();
    const paginatedReviews = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      reviews: paginatedReviews,
      totalCount,
      limit,
      offset
    });
  } catch (error) {
    console.error("[GET /api/admin/reviews] Error:", error);
    next(error);
  }
});

// Earnings & Purchases (Admin only)
app.get("/api/admin/earnings", isAdmin, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const query = db.collection('purchases').orderBy('createdAt', 'desc');
    const totalCount = await query.count();
    const snapshot = await query.offset(offset).limit(limit).get();
    const purchases = snapshot.docs.map((doc: any) => doc.data());
    
    // Use the optimized counter from stats/global
    let statsDoc = await db.collection('stats').doc('global').get();
    let totalEarnings = 0;
    
    if (!statsDoc.exists) {
      // One-time sync if stats document doesn't exist
      console.log("[Earnings] Stats document missing, performing one-time sync...");
      const allSnapshot = await db.collection('purchases').get();
      totalEarnings = allSnapshot.docs.reduce((sum: number, doc: any) => sum + (doc.data().amount || 0), 0);
      
      // Save it for future use
      await db.collection('stats').doc('global').set({ totalEarnings }, { merge: true });
    } else {
      totalEarnings = statsDoc.data().totalEarnings || 0;
    }
    
    res.json({ purchases, totalEarnings, totalCount, limit, offset });
  } catch (error) {
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
      // Fallback for authenticated user if not in DB or DB fetch failed
      if (id === userId) {
        return res.json({
          id: userId,
          email: userEmail,
          name: userEmail?.split('@')[0] || 'User',
          role: isAdminEmail(userEmail) ? 'admin' : 'user',
          credits: 0,
          history: []
        });
      }
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

  // Track credit changes if admin updates them
  if (update.credits !== undefined) {
    const oldUser = await db.collection('users').doc(id).get();
    const oldCredits = oldUser.data()?.credits || 0;
    const diff = update.credits - oldCredits;
    if (diff !== 0) await updateGlobalCredits(diff);
  }

  await db.collection('users').doc(id).update(update);
  const fullUser = await getFullUser(id);
  res.json(fullUser);
});

// Admin Usage Stats
app.get("/api/admin/usage", isAdmin, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    
    // 1. Fetch top 3 users by AI token usage (optimized: 1 query, 3 reads)
    const topUsersSnapshot = await db.collection('users')
      .orderBy('totalTokens', 'desc')
      .limit(3)
      .get();
      
    const topUsers = topUsersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.email || 'Unknown',
        email: data.email,
        totalTokens: data.totalTokens || 0
      };
    });

    // 2. Fetch recent reviews to calculate daily stats (optimized: 1 query)
    const recentReviewsSnapshot = await db.collection('reviews')
      .where('createdAt', '>=', startDate.toISOString())
      .get();
      
    const dailyStats: Record<string, { aiGenerations: number, creditsConsumed: number, activeUsers: Set<string>, newReviews: number }> = {};
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStats[dateStr] = { aiGenerations: 0, creditsConsumed: 0, activeUsers: new Set(), newReviews: 0 };
    }
    
    recentReviewsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.createdAt) return;
      const dateStr = data.createdAt.split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].newReviews += 1;
        dailyStats[dateStr].aiGenerations += 1; // 1 review = 1 generation
        dailyStats[dateStr].creditsConsumed += data.isPublished ? 5 : 0; // Estimate 5 credits for published
        if (data.userId) {
          dailyStats[dateStr].activeUsers.add(data.userId);
        }
      }
    });

    const usageData = Object.keys(dailyStats).sort().map(dateStr => ({
      date: dateStr,
      aiGenerations: dailyStats[dateStr].aiGenerations,
      creditsConsumed: dailyStats[dateStr].creditsConsumed,
      activeUsers: dailyStats[dateStr].activeUsers.size,
      newReviews: dailyStats[dateStr].newReviews
    }));

    res.json({
      chartData: usageData,
      topUsers
    });
  } catch (error) {
    next(error);
  }
});

// Admin Stats
app.get("/api/admin/stats", isAdmin, async (req, res, next) => {
  try {
    // Use Firestore aggregation queries for efficiency (much cheaper than fetching all docs)
    let usersCount = 0;
    let reviewsCount = 0;
    let publishedReviewsCount = 0;
    let totalCredits = 0;
    let debugInfo: any = {};

    try {
      usersCount = await db.collection('users').count();
    } catch (e: any) {
      debugInfo.usersCountError = e.message;
    }

    try {
      reviewsCount = await db.collection('reviews').count();
    } catch (e: any) {
      debugInfo.reviewsCountError = e.message;
    }

    try {
      publishedReviewsCount = await db.collection('reviews').where('isPublished', '==', true).count();
    } catch (e: any) {
      debugInfo.publishedReviewsCountError = e.message;
    }

    try {
      totalCredits = await db.collection('users').sum('credits');
    } catch (e: any) {
      debugInfo.totalCreditsError = e.message;
    }
    
    const statsDoc = await db.collection('stats').doc('global').get();
    const stats = statsDoc.data() || {};

    res.json({
      totalUsers: usersCount,
      totalReviews: reviewsCount,
      publishedReviews: publishedReviewsCount,
      totalEarnings: stats.totalEarnings || 0,
      totalCredits: totalCredits,
      debugInfo
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Delete all reviews associated with this user
  const reviewsSnapshot = await db.collection('reviews').where('userId', '==', id).get();
  if (!reviewsSnapshot.empty) {
    const batch = db.batch();
    reviewsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
  
  // Delete the user document
  await db.collection('users').doc(id).delete();
  res.json({ success: true });
});

// Helper to update global credit stats
const updateGlobalCredits = async (amount: number) => {
  try {
    await db.collection('stats').doc('global').set({
      totalCreditsInSystem: FieldValue.increment(amount)
    }, { merge: true });
  } catch (e) {
    console.error("Failed to update global credits stat:", e);
  }
};

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
      
      // Update global earnings and credits counter
      await db.collection('stats').doc('global').set({
        totalEarnings: FieldValue.increment(pkg.price),
        totalCreditsInSystem: FieldValue.increment(pkg.credits)
      }, { merge: true });
      
      const newCredits = (user.credits || 0) + pkg.credits;
      await userRef.update({ 
        credits: newCredits
      });

      // Handle Referral Reward
      if (user.referredBy) {
        const referralId = `ref_${userId}`;
        const referralRef = db.collection('referrals').doc(referralId);
        const referralDoc = await referralRef.get();
        
        if (referralDoc.exists && !referralDoc.data()?.creditsAwarded) {
          const referrerId = user.referredBy;
          const referrerRef = db.collection('users').doc(referrerId);
          const referrerDoc = await referrerRef.get();
          
          if (referrerDoc.exists) {
            const referrerData = referrerDoc.data();
            const currentReferrerCredits = referrerData?.credits || 0;
            
            await referrerRef.update({
              credits: currentReferrerCredits + 5
            });
            
            await referralRef.update({
              status: 'completed',
              creditsAwarded: true
            });
            
            console.log(`[Referral] Awarded 5 credits to ${referrerId} for referring ${userId}`);
          }
        }
      }

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

// Download Receipt
app.get("/api/purchases/:id/receipt", async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization || (req.query.authorization as string);
    const userId = await getUserIdFromAuth(authHeader);
    if (!userId) return res.status(401).send("Unauthorized");

    const purchaseDoc = await db.collection('purchases').doc(id).get();
    if (!purchaseDoc.exists) return res.status(404).send("Receipt not found");

    const purchase = purchaseDoc.data();
    if (purchase?.userId !== userId && !isAdminEmail(await getUserFromAuth(authHeader).then(a => a?.email))) {
      return res.status(403).send("Forbidden");
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${purchase?.id}</title>
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
          .receipt-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
          .logo span { color: #10b981; }
          .details { margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .details h4 { margin: 0 0 10px 0; text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #64748b; }
          .details p { margin: 0; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 10px; font-size: 12px; text-transform: uppercase; color: #64748b; }
          td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; }
          .total { text-align: right; font-size: 20px; font-weight: 900; }
          .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; }
          @media print { .no-print { display: none; } }
          .btn { background: #10b981; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; margin-bottom: 20px; cursor: pointer; border: none; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="no-print" style="text-align: right;">
            <button class="btn" onclick="window.print()">Print Receipt</button>
          </div>
          <div class="header">
            <div class="logo">VERDIQ<span>.</span></div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-weight: 900; text-transform: uppercase;">Receipt</h2>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">${purchase?.id}</p>
            </div>
          </div>
          
          <div class="details">
            <div>
              <h4>Billed To</h4>
              <p>${purchase?.userName}</p>
              <p style="font-weight: 400; color: #64748b;">${purchase?.userEmail}</p>
            </div>
            <div style="text-align: right;">
              <h4>Date</h4>
              <p>${new Date(purchase?.createdAt).toLocaleDateString()}</p>
              <h4 style="margin-top: 20px;">Payment Method</h4>
              <p>${purchase?.paymentMethod}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <p style="margin: 0; font-weight: 700;">${purchase?.credits} Credits Pack</p>
                  <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Digital credits for Verdiq platform analysis and publishing.</p>
                </td>
                <td style="text-align: right; font-weight: 700;">$${purchase?.amount}.00</td>
              </tr>
            </tbody>
          </table>

          <div class="total">
            <span style="font-size: 14px; color: #64748b; font-weight: 600; margin-right: 20px;">Total Paid</span>
            $${purchase?.amount}.00
          </div>

          <div class="footer">
            <p>Thank you for your purchase! For support, contact support@verdiq.com</p>
            <p>&copy; ${new Date().getFullYear()} Verdiq. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    console.error("Receipt Download Error:", error);
    res.status(500).send("Error generating receipt");
  }
});
app.get("/api/health", async (req, res) => {
  try {
    // Test Firestore connection
    const healthRef = db.collection('health').doc('check');
    await healthRef.get();
    
    // Check internal firebase state
    const { isAdminDbHealthy, adminDbInitialized } = await import('./firebase').then(m => ({
      isAdminDbHealthy: m.isAdminDbHealthy,
      adminDbInitialized: !!m.adminDb
    })).catch(() => ({ isAdminDbHealthy: false, adminDbInitialized: false }));

    res.json({ 
      status: "ok", 
      firestore: "connected",
      isAdminDbHealthy,
      adminDbInitialized,
      env: process.env.NODE_ENV,
      projectId: firebaseConfig.projectId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Health check failed:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      code: error.code,
      details: error.details,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      await updateGlobalCredits(-cost);
      res.json({ success: true, deducted: cost, remaining: newCredits });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
});

// AI Pre-flight check
app.post("/api/ai/preflight", requireAuth, checkUsageQuota, (req, res) => {
  res.json({ success: true, message: "Quota check passed" });
});

// AI Usage Reporting
app.post("/api/ai/report-usage", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.uid;
    const { tokens } = req.body;
    
    if (!userId || typeof tokens !== 'number') {
      return res.status(400).json({ message: "Invalid request" });
    }
    
    // Use increment to avoid reading the document
    await db.collection('users').doc(userId).update({
      totalTokens: FieldValue.increment(tokens)
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[AI Usage] Error reporting usage:", error);
    next(error);
  }
});

// MFA Endpoints (Real implementation using otplib)
app.get("/api/auth/mfa/status", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.uid;
    console.log(`[MFA Status] Checking status for user: ${userId}`);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    console.log(`[MFA Status] User ${userId} mfaEnabled: ${user?.mfaEnabled || false}`);
    res.json({ mfa_enabled: user?.mfaEnabled || false });
  } catch (error) {
    console.error(`[MFA Status] Error for user: ${(req as any).user?.uid}:`, error);
    next(error);
  }
});

app.post("/api/auth/mfa/setup", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.uid;
    console.log(`[MFA] Starting setup for user: ${userId}`);
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    if (!user) {
      console.error(`[MFA] User ${userId} not found in database`);
      return res.status(404).json({ message: "User not found" });
    }

    if (!authenticator) {
      console.error("[MFA] authenticator is undefined");
      return res.status(500).json({ message: "MFA service not available" });
    }

    // Generate a new secret
    console.log(`[MFA] Authenticator keys: ${Object.keys(authenticator).join(', ')}`);
    const secret = authenticator.generateSecret();
    console.log(`[MFA] Secret generated for ${userId}`);
    const issuer = "Verdiq";
    const account = user.email || "Admin";
    
    // Check for keyuri or keyURI (case sensitivity can vary between versions/environments)
    let otpauthUrl = '';
    try {
      if (typeof (authenticator as any).keyuri === 'function') {
        otpauthUrl = (authenticator as any).keyuri(account, issuer, secret);
      } else if (typeof (authenticator as any).keyURI === 'function') {
        otpauthUrl = (authenticator as any).keyURI(account, issuer, secret);
      } else {
        console.warn("[MFA] Neither keyuri nor keyURI is a function on authenticator. Using manual fallback.");
        // Manual fallback for otpauth URL
        otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
      }
    } catch (err) {
      console.error("[MFA] Error generating keyuri, using manual fallback:", err);
      otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    }
    
    console.log(`[MFA] OTPAuth URL generated`);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    console.log(`[MFA] QR Code generated`);
    
    // Store temporary secret for verification
    await db.collection('users').doc(userId).update({ 
      tempMfaSecret: secret 
    });
    console.log(`[MFA] Temp secret stored for ${userId}`);

    res.json({
      qr_code: qrCodeDataUrl,
      manual_entry_key: secret
    });
  } catch (error: any) {
    console.error(`[MFA] Setup failed: ${error.message}`);
    next(error);
  }
});

app.post("/api/auth/mfa/verify-setup", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.uid;
    console.log(`[MFA] Verifying setup for user: ${userId}`);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const { code } = req.body;
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();

    if (!user || !user.tempMfaSecret) {
      console.error(`[MFA] Setup not initiated for ${userId}`);
      return res.status(400).json({ detail: "MFA setup not initiated" });
    }

    if (!authenticator) {
      console.error("[MFA] authenticator is undefined");
      return res.status(500).json({ message: "MFA service not available" });
    }

    console.log(`[MFA] Verifying code ${code} against secret for ${userId}`);
    const isValid = authenticator.verify({
      token: code,
      secret: user.tempMfaSecret,
      window: 1
    });

    if (isValid) {
      console.log(`[MFA] Setup verified successfully for ${userId}`);
      await db.collection('users').doc(userId).update({ 
        mfaEnabled: true,
        mfaSecret: user.tempMfaSecret,
        tempMfaSecret: FieldValue.delete() // Clean up
      });
      res.json({ success: true });
    } else {
      console.warn(`[MFA] Invalid code ${code} for ${userId}`);
      res.status(400).json({ detail: "Invalid verification code. Please check your authenticator app." });
    }
  } catch (error: any) {
    console.error(`[MFA] Verification failed: ${error.message}`);
    next(error);
  }
});

app.post("/api/auth/mfa/verify", 
  [
    body('email').optional().isEmail().normalizeEmail(),
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password, mfa_code } = req.body;
    
    // Try to get user from Authorization header first
    const authUser = await getUserFromAuth(req.headers.authorization);
    let userDoc;
    
    if (authUser) {
      console.log(`[MFA] Login verification via Auth token for UID: ${authUser.uid}`);
      userDoc = await db.collection('users').doc(authUser.uid).get();
    } else if (email && password) {
      console.log(`[MFA] Login verification via credentials for email: ${email}`);
      const snapshot = await db.collection('users').where('email', '==', email).where('password', '==', password).limit(1).get();
      if (!snapshot.empty) {
        userDoc = snapshot.docs[0];
      }
    }
    
    if (!userDoc || !userDoc.exists) {
      console.warn(`[MFA] Invalid credentials or user not found`);
      return res.status(401).json({ detail: "Invalid credentials" });
    }

    const user = userDoc.data();

    if (!user.mfaEnabled || !user.mfaSecret) {
      console.warn(`[MFA] MFA not enabled for ${email}`);
      return res.status(400).json({ detail: "MFA not enabled for this account" });
    }

    if (!authenticator) {
      console.error("[MFA] authenticator is undefined");
      return res.status(500).json({ message: "MFA service not available" });
    }

    console.log(`[MFA] Verifying login code ${mfa_code} for ${email}`);
    const isValid = authenticator.verify({
      token: mfa_code,
      secret: user.mfaSecret,
      window: 1
    });

    if (isValid) {
      console.log(`[MFA] Login verification successful for ${email}`);
      const sanitized = sanitizeUser(user);
      res.json({
        ...sanitized,
        session: { access_token: "mock-jwt-token-" + userDoc.id }
      });
    } else {
      console.warn(`[MFA] Invalid login code ${mfa_code} for ${email}`);
      res.status(401).json({ detail: "Invalid MFA code. Please check your authenticator app." });
    }
  } catch (error: any) {
    console.error(`[MFA] Login verification failed: ${error.message}`);
    next(error);
  }
});

app.post("/api/reviews", 
  requireAuth,
  [
    body('userId').isString().trim().escape(),
    body('review').isObject(),
    body('review.songTitle').isString().trim().isLength({ min: 1, max: 200 }).escape(),
    body('review.artistName').isString().trim().isLength({ min: 1, max: 200 }).escape(),
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { userId, review } = req.body;
      const authUserId = (req as any).user.uid;
      
      if (authUserId !== userId) {
        console.warn(`[Auth] User ${authUserId} attempted to post review for user ${userId}`);
        return res.status(403).json({ message: "Forbidden" });
      }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const user = userDoc.data() as UserAccount;
      const cost = 10;
      const newCredits = Math.max(0, (user?.credits || 0) - cost);
      
      // Save review to separate collection
      const reviewId = review.id || Math.random().toString(36).substring(2, 11);
      const reviewToSave: any = { 
        ...review, 
        id: reviewId, 
        userId,
        isPublished: false // Always save as draft initially
      };
      
      // Set temporary status for free users (not subscribed)
      if (!user.isSubscribed) {
        reviewToSave.isTemporary = true;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        reviewToSave.expiresAt = expiresAt.toISOString();
      }

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
      await updateGlobalCredits(-cost);
      
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

    // Fetch current review to check status
    const currentReviewDoc = await db.collection('reviews').doc(reviewId).get();
    if (!currentReviewDoc.exists) {
      return res.status(404).json({ message: "Review not found" });
    }
    const currentReviewData = currentReviewDoc.data();

    // Ensure the user owns the review or is an admin
    if (currentReviewData?.userId !== authUserId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden: You do not own this review" });
    }

    // Determine credit cost
    let cost = 0;
    const isNowPublishing = review.isPublished && !currentReviewData?.isPublished;
    
    // Check if content actually changed to avoid charging for unpublish/delete
    const isContentChanged = 
      review.reviewBody !== currentReviewData?.reviewBody ||
      review.artistName !== currentReviewData?.artistName ||
      review.trackTitle !== currentReviewData?.trackTitle ||
      review.rating !== currentReviewData?.rating ||
      JSON.stringify(review.tags || []) !== JSON.stringify(currentReviewData?.tags || []);
      
    const isEditing = !isNowPublishing && isContentChanged;

    if (!isAdminUser) {
      if (isNowPublishing) {
        cost = 5;
      } else if (isEditing) {
        cost = 3;
      }

      // Check if user has enough credits
      if (requestingUser && requestingUser.credits < cost) {
        return res.status(402).json({ message: "Insufficient credits", required: cost, current: requestingUser.credits });
      }

      // Deduct credits
      if (cost > 0 && requestingUser) {
        const newCredits = Math.max(0, requestingUser.credits - cost);
        await db.collection('users').doc(authUserId).update({ credits: newCredits });
        await updateGlobalCredits(-cost);
      }
    }

    const reviewToUpdate = { ...review };
    
    // If publishing, remove temporary status
    if (reviewToUpdate.isPublished) {
      reviewToUpdate.isTemporary = FieldValue.delete();
      reviewToUpdate.expiresAt = FieldValue.delete();
    }
    
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
    
    // Fetch updated credits to return
    const updatedUserDoc = await db.collection('users').doc(authUserId).get();
    const updatedCredits = updatedUserDoc.data()?.credits ?? requestingUser?.credits;

    res.json({ success: true, remaining: updatedCredits });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/published-reviews", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const query = db.collection('reviews').where('isPublished', '==', true).orderBy('createdAt', 'desc');
    const totalCount = await query.count();
    const snapshot = await query.offset(offset).limit(limit).get();
    const reviews = snapshot.docs.map(doc => doc.data());
    
    res.json({
      reviews,
      totalCount,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/reviews/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('reviews').doc(id).get();
    if (doc.exists) {
      const review = doc.data() as Review;
      
      res.json(review);
    } else {
      res.status(404).json({ message: "Review not found" });
    }
  } catch (error) {
    next(error);
  }
});

app.delete("/api/reviews/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const authUser = (req as any).user;
    const userId = authUser?.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    const isAdminUser = isAdminEmail(user?.email) || user?.role === 'admin' || isAdminEmail(authUser?.email);

    const reviewDoc = await db.collection('reviews').doc(id).get();
    if (!reviewDoc.exists) {
      return res.status(404).json({ message: "Review not found" });
    }

    const review = reviewDoc.data();
    if (review.userId !== userId && !isAdminUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await db.collection('reviews').doc(id).delete();
    res.json({ success: true });
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

app.post("/api/reviews/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviewRef = db.collection('reviews').doc(id);
    const doc = await reviewRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      const newCount = (data?.readCount || 0) + 1;
      await reviewRef.update({ readCount: newCount });
      return res.json({ read_count: newCount });
    }
    res.status(404).json({ message: "Review not found" });
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

// Referrals
app.get("/api/referrals", async (req, res, next) => {
  try {
    const auth = await getUserFromAuth(req.headers.authorization);
    if (!auth) return res.status(401).json({ message: "Unauthorized" });
    
    const snapshot = await db.collection('referrals')
      .where('referrerId', '==', auth.uid)
      .get();
      
    const referrals = snapshot.docs.map(doc => doc.data());
    res.json(referrals);
  } catch (error) {
    console.error("[GET /api/referrals] Error:", error);
    next(error);
  }
});

app.get("/api/referral/stats", async (req, res, next) => {
  try {
    const auth = await getUserFromAuth(req.headers.authorization);
    if (!auth) return res.status(401).json({ message: "Unauthorized" });
    
    const userDoc = await db.collection('users').doc(auth.uid).get();
    let user = userDoc.data();
    
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // Lazy generate referral code if missing
    if (!user.referralCode) {
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.collection('users').doc(auth.uid).update({ referralCode });
      user.referralCode = referralCode;
    }
    
    const snapshot = await db.collection('referrals')
      .where('referrerId', '==', auth.uid)
      .get();
      
    const referrals = snapshot.docs.map(doc => doc.data());
    const totalReferred = referrals.length;
    const totalCreditsEarned = referrals.filter(r => r.creditsAwarded).length * 5;
    
    res.json({
      referralCode: user.referralCode,
      totalReferred,
      totalCreditsEarned,
      referrals
    });
  } catch (error) {
    console.error("[GET /api/referral/stats] Error:", error);
    next(error);
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] === SERVER ERROR ===`);
  console.error(`[${timestamp}] Path: ${req.path}`);
  console.error(`[${timestamp}] Method: ${req.method}`);
  console.error(`[${timestamp}] Headers: ${JSON.stringify(req.headers)}`);
  console.error(`[${timestamp}] Message: ${err?.message || err}`);
  console.error(`[${timestamp}] Code: ${err?.code}`);
  if (err?.stack) console.error(`[${timestamp}] Stack: ${err.stack}`);
  if (err?.details) console.error(`[${timestamp}] Details: ${JSON.stringify(err.details)}`);

  const statusCode = err?.status || 500;
  const errorResponse = {
    message: err?.message || "Internal server error",
    detail: err?.message || String(err),
    code: err?.code,
    details: err?.details,
    path: req.path,
    timestamp
  };

  if (err?.code === 7 || (err?.message && String(err.message).includes('PERMISSION_DENIED'))) {
    return res.status(403).json({
      ...errorResponse,
      message: "Firestore Permission Denied. Please ensure the Cloud Firestore API is enabled and the database is initialized."
    });
  }

  res.status(statusCode).json(errorResponse);
});

export default app;
