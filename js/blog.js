// Blog yazılarını yükle
async function loadBlogPosts() {
    const loadingElement = document.querySelector('.loading');
    const errorElement = document.querySelector('.error-message');
    const blogGrid = document.querySelector('.blog-grid');

    if (!loadingElement || !errorElement || !blogGrid) return;

    try {
        // Yükleme başladığında
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        blogGrid.innerHTML = '';

        const response = await fetch('http://localhost:3002/public/posts');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const posts = await response.json();
        console.log('Gelen blog yazıları:', posts);
        
        if (!Array.isArray(posts)) {
            throw new Error('Blog yazıları bir dizi değil: ' + JSON.stringify(posts));
        }

        // Blog yazıları başarıyla yüklendi
        loadingElement.style.display = 'none';
        
        if (posts.length === 0) {
            blogGrid.innerHTML = '<div class="no-posts">Henüz blog yazısı bulunmuyor.</div>';
            return;
        }
        
        posts.forEach(post => {
            // Firebase Storage'dan gelen coverImage URL'sini kullan
            const imageUrl = post.coverImage || '/images/default.jpg';
            
            const postElement = document.createElement('div');
            postElement.className = 'blog-card';
            
            const imageElement = document.createElement('img');
            imageElement.src = imageUrl;
            imageElement.alt = post.title || 'Blog görseli';
            imageElement.className = 'blog-image-content';
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'blog-image';
            imageContainer.appendChild(imageElement);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'blog-content';
            contentDiv.innerHTML = `
                <h3>${post.title}</h3>
                <div class="blog-meta">${new Date(post.createdAt).toLocaleDateString('tr-TR')}</div>
                <p>${post.content.substring(0, 150)}...</p>
                <a href="blog-post.html?id=${post._id}" class="read-more">Devamını Oku</a>
            `;
            
            postElement.appendChild(imageContainer);
            postElement.appendChild(contentDiv);
            blogGrid.appendChild(postElement);
        });
    } catch (error) {
        console.error('Blog yazıları yüklenirken hata:', error);
        loadingElement.style.display = 'none';
        errorElement.style.display = 'block';
    }
}

// Back to top button functionality
const backToTopButton = document.querySelector('.back-to-top');
if (backToTopButton) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopButton.classList.add('is-visible');
        } else {
            backToTopButton.classList.remove('is-visible');
        }
    });

    backToTopButton.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Sayfa yüklendiğinde hangi fonksiyonun çalışacağını belirleyen kontrol eklendi
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('blog.html')) {
        loadBlogPosts();
    }
});
