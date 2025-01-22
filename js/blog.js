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
            // Firebase Storage URL'ini doğrudan kullan
            const imageUrl = post.coverImage || '/images/default.jpg';
            
            const postElement = document.createElement('div');
            postElement.className = 'blog-card';
            
            const imageElement = document.createElement('img');
            imageElement.src = imageUrl;
            imageElement.alt = post.title || 'Blog görseli';
            imageElement.className = 'blog-image-content';
            imageElement.onerror = () => {
                console.error('Resim yüklenemedi:', imageUrl);
                imageElement.src = '/images/default.jpg';
            };
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'blog-image';
            imageContainer.appendChild(imageElement);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'blog-content';
            
            const titleElement = document.createElement('h2');
            titleElement.textContent = post.title;
            
            const dateElement = document.createElement('p');
            dateElement.className = 'date';
            const date = new Date(post.createdAt);
            dateElement.textContent = date.toLocaleDateString('tr-TR');
            
            const excerptElement = document.createElement('p');
            excerptElement.className = 'excerpt';
            excerptElement.textContent = post.content ? post.content.substring(0, 150) + '...' : '';
            
            const readMoreElement = document.createElement('a');
            readMoreElement.href = `blog-post.html?id=${post._id}`;
            readMoreElement.className = 'read-more';
            readMoreElement.textContent = 'Devamını Oku';
            
            contentDiv.appendChild(titleElement);
            contentDiv.appendChild(dateElement);
            contentDiv.appendChild(excerptElement);
            contentDiv.appendChild(readMoreElement);
            
            postElement.appendChild(imageContainer);
            postElement.appendChild(contentDiv);
            
            blogGrid.appendChild(postElement);
        });
    } catch (error) {
        console.error('Blog yazıları yüklenirken hata:', error);
        loadingElement.style.display = 'none';
        errorElement.style.display = 'block';
        errorElement.textContent = 'Blog yazıları yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
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
