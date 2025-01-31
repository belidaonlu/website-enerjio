// HTML karakterlerini decode et
function decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// Blog yazılarını yükle
async function loadBlogPosts() {
    const loadingElement = document.querySelector('.loading');
    const errorElement = document.querySelector('.error-message');
    const featuredLeftElement = document.querySelector('.blog-featured-left');
    const featuredRightElement = document.querySelector('.blog-featured-right');
    const blogGridElement = document.querySelector('.blog-grid');

    if (!loadingElement || !errorElement || !featuredLeftElement || !featuredRightElement || !blogGridElement) return;

    try {
        // Yükleme başladığında
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        featuredLeftElement.innerHTML = '';
        featuredRightElement.innerHTML = '';
        blogGridElement.innerHTML = '';

        const response = await fetch('http://localhost:3002/public/posts');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const posts = await response.json();
        
        // Blog yazıları başarıyla yüklendi
        loadingElement.style.display = 'none';
        
        if (!Array.isArray(posts) || posts.length === 0) {
            blogGridElement.innerHTML = '<div class="no-posts">Henüz blog yazısı bulunmuyor.</div>';
            return;
        }

        // Son yazıyı sol tarafa yerleştir
        if (posts.length > 0) {
            const lastPost = posts[0];
            featuredLeftElement.innerHTML = `
                <div class="blog-card">
                    <div class="blog-image">
                        <img src="${lastPost.coverImage}" alt="${lastPost.title}" class="blog-image-content">
                    </div>
                    <div class="blog-content">
                        <div class="blog-meta">${new Date(lastPost.createdAt).toLocaleDateString('tr-TR')}</div>
                        <h2>${decodeHTML(lastPost.title)}</h2>
                        <p>${decodeHTML(lastPost.content).replace(/<[^>]*>/g, ' ').substring(0, 150)}...</p>
                        <a href="blog-post.html?id=${lastPost._id}" class="blog-read-more">Devamını Oku</a>
                    </div>
                </div>
            `;
        }

        // Sonraki 3 yazıyı sağ tarafa yerleştir
        const nextThreePosts = posts.slice(1, 4);
        const rightHTML = nextThreePosts.map(post => `
            <div class="blog-card">
                <div class="blog-image">
                    <img src="${post.coverImage}" alt="${post.title}" class="blog-image-content">
                </div>
                <div class="blog-content">
                    <div class="blog-meta">${new Date(post.createdAt).toLocaleDateString('tr-TR')}</div>
                    <h2>${decodeHTML(post.title)}</h2>
                    <a href="blog-post.html?id=${post._id}" class="blog-read-more">Devamını Oku</a>
                </div>
            </div>
        `).join('');
        featuredRightElement.innerHTML = rightHTML;

        // Tüm yazıları alt grid'e yerleştir
        const allPostsHTML = posts.map(post => `
            <div class="blog-card">
                <div class="blog-image">
                    <img src="${post.coverImage}" alt="${post.title}" class="blog-image-content">
                </div>
                <div class="blog-content">
                    <div class="blog-meta">${new Date(post.createdAt).toLocaleDateString('tr-TR')}</div>
                    <h2>${decodeHTML(post.title)}</h2>
                    <p>${decodeHTML(post.content).replace(/<[^>]*>/g, ' ').substring(0, 150)}...</p>
                    <a href="blog-post.html?id=${post._id}" class="blog-read-more">Devamını Oku</a>
                </div>
            </div>
        `).join('');
        blogGridElement.innerHTML = allPostsHTML;

    } catch (error) {
        console.error('Blog yazıları yüklenirken hata:', error);
        loadingElement.style.display = 'none';
        errorElement.style.display = 'block';
        errorElement.textContent = 'Blog yazıları yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
    }
}

// Back to top button functionality
window.onscroll = function() {
    const backToTopButton = document.getElementById('scrollToTopBtn');
    if (backToTopButton) {
        if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
            backToTopButton.style.display = 'block';
        } else {
            backToTopButton.style.display = 'none';
        }
    }
}

// Sayfa yüklendiğinde blog yazılarını yükle
document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes('blog.html')) {
        loadBlogPosts();
    }
});
