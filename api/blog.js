const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// MongoDB bağlantısı
mongoose.connect('mongodb://localhost:27017/enerjio-blog', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Blog API: MongoDB bağlantısı başarılı');
}).catch(err => {
    console.error('Blog API: MongoDB bağlantı hatası:', err);
});

// Blog Post modeli
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    excerpt: String,
    image: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// Tüm blog yazılarını getir
router.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        console.error('Blog posts fetch error:', error);
        res.status(500).json({ error: 'Blog yazıları yüklenirken bir hata oluştu' });
    }
});

// Tekil blog yazısını getir
router.get('/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Blog yazısı bulunamadı' });
        }
        res.json(post);
    } catch (error) {
        console.error('Blog post fetch error:', error);
        res.status(500).json({ error: 'Blog yazısı yüklenirken bir hata oluştu' });
    }
});

module.exports = router;
