require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const fs = require('fs');
const app = express();

// Uploads klasörünü oluştur
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS ayarları
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// MongoDB bağlantısı
mongoose.connect('mongodb://localhost:27017/enerjio-blog', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('MongoDB bağlantısı başarılı');
    await createInitialAdmin(); // İlk admin kullanıcısını oluştur
}).catch(err => {
    console.error('MongoDB bağlantı hatası:', err);
});

// İlk admin kullanıcısını oluştur
const createInitialAdmin = async () => {
    try {
        await Admin.deleteMany({}); // Mevcut tüm admin kayıtlarını sil
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await Admin.create({
            username: 'admin',
            password: hashedPassword
        });
        console.log('İlk admin kullanıcısı başarıyla oluşturuldu');
    } catch (error) {
        console.error('Admin oluşturma hatası:', error);
    }
};

// Admin kullanıcı modeli
const adminSchema = new mongoose.Schema({
    username: String,
    password: String
});

const Admin = mongoose.model('Admin', adminSchema);

// Express middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Multer yapılandırması
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Blog Post Modeli
const Post = mongoose.model('Post', {
    title: String,
    slug: String,
    content: String,
    image: String,
    author: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware - Auth kontrolü
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Routes
app.get('/admin/login', (req, res) => {
    res.render('login');
});

app.post('/admin/login', async (req, res) => {
    console.log('Login denemesi:', req.body); // Gelen verileri logla
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        console.log('Bulunan admin:', admin); // Admin bilgisini logla
        
        if (admin && await bcrypt.compare(password, admin.password)) {
            console.log('Giriş başarılı'); // Başarılı girişi logla
            req.session.isAuthenticated = true;
            res.redirect('/admin/dashboard');
        } else {
            console.log('Giriş başarısız'); // Başarısız girişi logla
            res.render('login', { error: 'Geçersiz kullanıcı adı veya şifre' });
        }
    } catch (error) {
        console.error('Login hatası:', error);
        res.render('login', { error: 'Bir hata oluştu' });
    }
});

app.get('/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.render('dashboard', { posts, moment });
    } catch (error) {
        console.error('Dashboard hatası:', error);
        res.render('dashboard', { posts: [], error: 'Blog yazıları yüklenirken bir hata oluştu' });
    }
});

app.get('/admin/posts/new', requireAuth, (req, res) => {
    res.render('new-post');
});

app.post('/admin/posts', requireAuth, upload.single('image'), async (req, res) => {
    const { title, content } = req.body;
    const slug = require('slugify')(title, { lower: true });
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    
    await Post.create({
        title,
        slug,
        content,
        image,
        author: 'Admin'
    });
    
    res.redirect('/admin/dashboard');
});

app.get('/admin/posts/:id/edit', requireAuth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    res.render('edit-post', { post });
});

app.post('/admin/posts/:id', requireAuth, upload.single('image'), async (req, res) => {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);
    
    post.title = title;
    post.content = content;
    post.slug = require('slugify')(title, { lower: true });
    if (req.file) {
        post.image = `/uploads/${req.file.filename}`;
    }
    post.updatedAt = Date.now();
    
    await post.save();
    res.redirect('/admin/dashboard');
});

app.post('/admin/posts/:id/delete', requireAuth, async (req, res) => {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

// API Endpoints (Blog sayfası için)
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
});

app.get('/api/posts/:slug', async (req, res) => {
    const post = await Post.findOne({ slug: req.params.slug });
    res.json(post);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
