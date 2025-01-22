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
const { v4: uuidv4 } = require('uuid');
const methodOverride = require('method-override');
const firebaseConfig = require('./config/firebaseConfig');

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
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

// Firestore ve Storage referansları
const db = admin.firestore();
const bucket = admin.storage().bucket();
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
    name: 'sessionId',
    unset: 'destroy'
}));

// Method override middleware ekleyin (en üstte diğer middleware'lerden önce)
app.use(methodOverride('_method'));

// POST isteklerini kabul et
app.use((req, res, next) => {
    if (req.method === 'POST') {
        return next();
    }
    next();
});

// Uploads klasörünü kontrol et ve oluştur
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    }),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('Sadece resim dosyaları yüklenebilir.'), false);
            return;
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Multer hata yakalama middleware'i
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Dosya boyutu çok büyük! Maksimum 5MB yükleyebilirsiniz.'
            });
        }
    }
    next(err);
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
    try {
        if (req.session.user) {
            return res.redirect('/admin/dashboard');
        }

        // firebaseConfig'i doğrudan obje olarak gönder
        const clientConfig = {
            apiKey: "AIzaSyB84ol0Fu-nJtU8I5S8dajMFVjhgdyFQ8Y",
            authDomain: "enerjio-website.firebaseapp.com",
            projectId: "enerjio-website",
            storageBucket: "enerjio-website.firebasestorage.app",
            messagingSenderId: "71871281855",
            appId: "1:71871281855:web:6d198285f5d37495e1a40a",
            measurementId: "G-LR8RX0VYF3"
        };

        res.render('login', { firebaseConfig: clientConfig });
    } catch (error) {
        console.error('Login page error:', error);
        res.status(500).send('Bir hata oluştu');
    }
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

app.post('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.clearCookie('sessionId');
        res.redirect('/admin/login');
    });
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
        console.log('Yeni yazı ekleme isteği alındı');
        console.log('Body:', req.body);
        console.log('File:', req.file);
        
        const { title, content, published } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Başlık ve içerik zorunludur' 
            });
        }

        const post = {
            title,
            content,
            coverImage: req.file ? `/uploads/${req.file.filename}` : null,
            published: published === 'true',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            author: {
                email: req.session.user.email,
                name: req.session.user.name
            }
        };

        const docRef = await postsCollection.add(post);
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Yeni yazı ekleme hatası:', error);
        res.status(500).render('error', {
            message: 'Yazı eklenirken bir hata oluştu',
            error: error
        });
    }
});

app.get('/admin/new-post', requireAuth, (req, res) => {
    res.render('new-post', { 
        user: req.session.user
    });
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

app.post('/admin/posts/:id', requireAuth, upload.single('coverImage'), async (req, res) => {
    try {
        console.log('POST update isteği alındı');
        console.log('Body:', req.body);
        
        const { title, content } = req.body;
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (req.file) {
            // Eski resmi sil
            const oldPost = post.data();
            if (oldPost.coverImage) {
                const oldImageName = oldPost.coverImage.split('/').pop();
                try {
                    await bucket.file(`blog-images/${oldImageName}`).delete();
                } catch (err) {
                    console.error('Eski resim silinirken hata:', err);
                }
            }

            // Yeni resmi yükle
            const uniqueFileName = `${uuidv4()}${path.extname(req.file.originalname)}`;
            const uploadPath = path.join(__dirname, 'public/uploads', uniqueFileName);
            
            // Dosyayı local'e kaydet
            fs.copyFileSync(req.file.path, uploadPath);
            
            // URL'i ayarla
            updateData.coverImage = `/uploads/${uniqueFileName}`;
            
            // Geçici dosyayı sil
            fs.unlinkSync(req.file.path);
        }

        await postRef.update(updateData);
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Post güncelleme hatası:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Post güncellenirken bir hata oluştu',
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
        const postData = {
            title: req.body.title,
            content: req.body.content,
            published: false, // Her güncelleme sonrası taslak olarak ayarla
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (req.file) {
            // Eğer yeni bir görsel yüklendiyse
            const bucket = admin.storage().bucket();
            const blob = bucket.file(req.file.filename);
            
            await new Promise((resolve, reject) => {
                const blobStream = blob.createWriteStream({
                    metadata: {
                        contentType: req.file.mimetype,
                    },
                });

                blobStream.on('error', reject);
                blobStream.on('finish', resolve);
                blobStream.end(req.file.buffer);
            });

            const [url] = await blob.getSignedUrl({
                action: 'read',
                expires: '03-01-2500',
            });

            postData.coverImage = url;
        }

        await postsCollection.doc(req.params.id).update(postData);
        res.json({ success: true });
    } catch (error) {
        console.error('Güncelleme hatası:', error);
        res.status(500).json({ 
            error: 'Güncelleme başarısız oldu', 
            details: error.message 
        });
    }
});

app.post('/admin/posts/:id/delete', requireAuth, async (req, res) => {
    try {
        const postRef = postsCollection.doc(req.params.id);
        const post = await postRef.get();

        if (!post.exists) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post bulunamadı' 
            });
        }

        // Önce post'un cover image'ını sil (eğer varsa)
        const postData = post.data();
        if (postData.coverImage) {
            try {
                const imageName = postData.coverImage.split('/').pop();
                await bucket.file(`blog-images/${imageName}`).delete();
            } catch (err) {
                console.error('Cover image silinirken hata:', err);
            }
        }

        // Post'u sil
        await postRef.delete();
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Post silme hatası:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Post silinirken bir hata oluştu',
            error: error.message 
        });
    }
});

// Yayın durumunu değiştirme route'u
app.post('/admin/posts/:id/toggle', requireAuth, async (req, res) => {
    try {
        const doc = await postsCollection.doc(req.params.id).get();
        const currentStatus = doc.data().published;
        
        await postsCollection.doc(req.params.id).update({
            published: !currentStatus
        });
        
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Durum değiştirme hatası:', error);
        res.status(500).json({ error: 'Durum değiştirme başarısız oldu' });
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
                coverImage: data.coverImage || '', // image yerine coverImage kullan
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
            coverImage: data.coverImage || '',
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            published: data.published || false,
            author: data.author || null
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