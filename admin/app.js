const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const moment = require('moment');
const multer = require('multer');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');

// Debug için log
console.log('Starting application...');

dotenv.config(); // .env dosyasını yükle
console.log('Environment variables loaded');

// Firebase config kontrolü
console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
console.log('Firebase Client Email exists:', !!process.env.FIREBASE_CLIENT_EMAIL);
console.log('Firebase Private Key exists:', !!process.env.FIREBASE_PRIVATE_KEY);

const app = express();
const port = process.env.PORT || 3001; // Port 3001'e değiştirildi

// CORS ayarları
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:4000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 200
}));

// Firebase Admin SDK yapılandırması
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}

// Firestore referansı
const db = admin.firestore();
const postsCollection = db.collection('posts');

// Express middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 'sessionId'
}));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Auth middleware
const requireAuth = async (req, res, next) => {
    try {
        if (!req.session.user || !req.session.user.email) {
            return res.redirect('/admin/login');
        }

        try {
            const userRecord = await admin.auth().getUserByEmail(req.session.user.email);
            if (!userRecord || !userRecord.email.endsWith('@enerj.io')) {
                req.session.destroy();
                return res.redirect('/admin/login');
            }
            next();
        } catch (error) {
            console.error('Auth verification error:', error);
            req.session.destroy();
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.redirect('/admin/login');
    }
};

// Routes
app.get('/admin/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/admin/dashboard');
    }
    res.render('login');
});

app.post('/admin/login', async (req, res) => {
    try {
        const { idToken } = req.body;
        
        if (!idToken) {
            throw new Error('No ID token provided');
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userEmail = decodedToken.email;

        if (!userEmail.endsWith('@enerj.io')) {
            return res.status(403).json({ 
                success: false,
                message: 'Sadece @enerj.io uzantılı e-postalar ile giriş yapabilirsiniz.' 
            });
        }

        req.session.user = {
            email: userEmail,
            name: decodedToken.name,
            picture: decodedToken.picture
        };

        res.json({ 
            success: true,
            message: 'Giriş başarılı'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ 
            success: false,
            message: 'Giriş başarısız. Lütfen tekrar deneyin.',
            error: error.message 
        });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

app.get('/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const postsSnapshot = await postsCollection.orderBy('createdAt', 'desc').get();
        const posts = [];
        
        postsSnapshot.forEach(doc => {
            posts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.render('dashboard', { 
            user: req.session.user,
            posts: posts
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Bir hata oluştu');
    }
});

// Uploads klasörünü oluştur
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res, next) => {
    console.log(`404: ${req.method} ${req.url}`);
    res.status(404).send('Not Found');
});

// Blog post routes
app.post('/admin/posts', requireAuth, upload.single('coverImage'), async (req, res) => {
    try {
        const { title, content, published } = req.body;
        const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const post = {
            title,
            content,
            coverImage: coverImageUrl,
            published: published === 'on',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            author: {
                email: req.session.user.email,
                name: req.session.user.name
            }
        };

        await postsCollection.add(post);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send('Error creating post');
    }
});

app.get('/admin/edit-post/:id', requireAuth, async (req, res) => {
    try {
        const postDoc = await postsCollection.doc(req.params.id).get();
        if (!postDoc.exists) {
            return res.status(404).send('Post not found');
        }

        const post = {
            id: postDoc.id,
            ...postDoc.data()
        };

        res.render('edit-post', { post });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).send('Error fetching post');
    }
});

app.put('/admin/posts/:id', requireAuth, upload.single('coverImage'), async (req, res) => {
    try {
        const { title, content, published } = req.body;
        const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const updateData = {
            title,
            content,
            published: published === 'on',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (coverImageUrl) {
            updateData.coverImage = coverImageUrl;
        }

        await postsCollection.doc(req.params.id).update(updateData);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/admin/posts/:id', requireAuth, async (req, res) => {
    try {
        await postsCollection.doc(req.params.id).delete();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Admin panel running at http://localhost:${port}/admin`);
});