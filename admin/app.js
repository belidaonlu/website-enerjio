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
const port = process.env.PORT || 3002; // Port 3002'e değiştirildi

// CORS ayarları
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:4000', 'http://127.0.0.1:4000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['set-cookie'],
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
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
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
        const uploadDir = path.join(__dirname, 'public/uploads');
        // Klasör yoksa oluştur
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Güvenli dosya adı oluştur
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Sadece resim dosyalarına izin ver
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Uploads klasörünü statik olarak serve et
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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

// Blog post routes
app.post('/admin/posts', requireAuth, upload.single('coverImage'), async (req, res) => {
    try {
        if (!req.body.title || !req.body.content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Başlık ve içerik zorunludur' 
            });
        }

        const { title, content, published } = req.body;
        const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const post = {
            title,
            content,
            coverImage: coverImageUrl,
            published: published === 'true' || published === 'on',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            author: {
                email: req.session.user.email,
                name: req.session.user.name
            }
        };

        const docRef = await postsCollection.add(post);
        res.status(201).json({ 
            success: true, 
            message: 'Post başarıyla oluşturuldu',
            postId: docRef.id 
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Post oluşturulurken bir hata oluştu',
            error: error.message 
        });
    }
});

app.get('/admin/edit-post/:id', requireAuth, async (req, res) => {
    try {
        const postDoc = await postsCollection.doc(req.params.id).get();
        if (!postDoc.exists) {
            return res.status(404).send('Post bulunamadı');
        }

        const post = {
            id: postDoc.id,
            ...postDoc.data(),
            createdAt: postDoc.data().createdAt?.toDate()
        };

        res.render('edit-post', { 
            post,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).send('Post getirme hatası');
    }
});

app.put('/admin/posts/:id', requireAuth, upload.single('coverImage'), async (req, res) => {
    try {
        const { title, content, published } = req.body;
        const postRef = postsCollection.doc(req.params.id);
        const post = await postRef.get();

        if (!post.exists) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post bulunamadı' 
            });
        }

        const updateData = {
            title,
            content,
            published: published === 'true' || published === 'on',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (req.file) {
            // Eski resmi sil
            const oldPost = post.data();
            if (oldPost.coverImage) {
                const oldImagePath = path.join(__dirname, 'public', oldPost.coverImage);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.coverImage = `/uploads/${req.file.filename}`;
        }

        await postRef.update(updateData);
        
        res.json({ 
            success: true, 
            message: 'Post başarıyla güncellendi',
            redirectUrl: '/admin/dashboard'
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Post güncellenirken bir hata oluştu',
            error: error.message 
        });
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

// Yayınlama route'u ekleyelim
app.post('/admin/posts/:id/publish', requireAuth, async (req, res) => {
    try {
        const postRef = postsCollection.doc(req.params.id);
        const post = await postRef.get();

        if (!post.exists) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post bulunamadı' 
            });
        }

        // Firestore'da published durumunu güncelle
        await postRef.update({
            published: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ 
            success: true, 
            message: 'Post başarıyla yayınlandı'
        });

    } catch (error) {
        console.error('Error publishing post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Post yayınlanırken bir hata oluştu',
            error: error.message 
        });
    }
});

// Public blog endpoint'leri
app.get('/public/posts', async (req, res) => {
    try {
        console.log('Public blog yazıları talep edildi');
        
        // Firebase bağlantısını kontrol et
        if (!admin.apps.length) {
            console.error('Firebase bağlantısı bulunamadı');
            return res.status(500).json({ error: 'Veritabanı bağlantısı kurulamadı' });
        }

        console.log('Firebase bağlantısı mevcut, koleksiyona erişiliyor...');
        
        // Şimdilik sadece yayınlanmış gönderileri al, sıralama yok
        const snapshot = await postsCollection.where('published', '==', true).get();
        const posts = [];
        
        console.log('Sorgu sonucu:', snapshot.size, 'adet yazı bulundu');
        
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('Ham veri:', data);
            
            // Content bir dizi ise, birleştir
            let content = '';
            if (Array.isArray(data.content)) {
                content = data.content.join(' ');
            } else if (typeof data.content === 'string') {
                content = data.content;
            }
            
            console.log('Content tipi:', typeof content);
            console.log('Content örneği:', content ? content.substring(0, 100) : 'İçerik yok');
            
            // HTML içeriğini düz metne çevir
            let plainContent = '';
            if (content) {
                // HTML etiketlerini kaldır
                plainContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
            
            posts.push({
                _id: doc.id,
                title: data.title || '',
                content: plainContent,
                image: data.coverImage ? data.coverImage.replace(/^\/uploads\//, '') : '', // coverImage'ı image olarak dönüştür ve /uploads/ önekini kaldır
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                published: data.published || false
            });
        });
        
        // Yazıları tarih sırasına göre JavaScript'te sırala
        posts.sort((a, b) => b.createdAt - a.createdAt);
        
        console.log('İşlenmiş yazılar:', posts);
        return res.json(posts);
    } catch (error) {
        console.error('Blog yazıları alınırken detaylı hata:', error);
        return res.status(500).json({ 
            error: 'Blog yazıları alınamadı',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.get('/public/posts/:id', async (req, res) => {
    try {
        const doc = await postsCollection.doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Blog yazısı bulunamadı' });
        }
        const data = doc.data();
        res.json({
            _id: doc.id,
            title: data.title || '',
            content: data.content || '',
            image: data.image || '',
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            published: data.published || false
        });
    } catch (error) {
        console.error('Blog yazısı alınırken hata:', error);
        res.status(500).json({ error: 'Blog yazısı alınamadı' });
    }
});

// Root URL yönlendirmesi ekleyelim
app.get('/', (req, res) => {
    res.redirect('/admin');
});

// Admin ana sayfası yönlendirmesi
app.get('/admin', (req, res) => {
    res.redirect('/admin/login');
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Dosya boyutu çok büyük (maksimum 5MB)'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Dosya yükleme hatası'
        });
    }
    res.status(500).json({
        success: false,
        message: 'Sunucu hatası',
        error: err.message
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`404: ${req.method} ${req.url}`);
    // API istekleri için JSON yanıtı
    if (req.path.startsWith('/api/') || req.xhr) {
        return res.status(404).json({
            success: false,
            message: 'Sayfa bulunamadı'
        });
    }
    // Normal sayfa istekleri için login'e yönlendir
    res.redirect('/admin/login');
});

// Start server
app.listen(port, () => {
    console.log(`Admin panel running at http://localhost:${port}/admin`);
});