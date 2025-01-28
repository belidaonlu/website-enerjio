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
        console.log('Gelen blog yazıları:', posts);
        
        // Blog yazıları başarıyla yüklendi
        loadingElement.style.display = 'none';
        
        if (!Array.isArray(posts) || posts.length === 0) {
            blogGridElement.innerHTML = '<div class="no-posts">Henüz blog yazısı bulunmuyor.</div>';
            return;
        }

        // Son yazıyı sol tarafa yerleştir
        if (posts.length > 0) {
            const lastPost = posts[0];
            featuredLeftElement.appendChild(createBlogPostElement(lastPost));
        }

        // Sonraki 3 yazıyı sağ tarafa yerleştir
        for (let i = 1; i <= 3 && i < posts.length; i++) {
            featuredRightElement.appendChild(createBlogPostElement(posts[i]));
        }

        // Tüm yazıları alt grid'e yerleştir
        posts.forEach(post => {
            blogGridElement.appendChild(createBlogPostElement(post));
        });

    } catch (error) {
        console.error('Blog yazıları yüklenirken hata:', error);
        loadingElement.style.display = 'none';
        errorElement.style.display = 'block';
        errorElement.textContent = 'Blog yazıları yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
    }
}

function createBlogPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'blog-card';
    
    const imageUrl = post.coverImage || '/images/default.jpg';
    
    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.alt = post.title || 'Blog görseli';
    imageElement.className = 'blog-image-content';
    imageElement.onerror = (e) => {
        console.error('Görsel yüklenemedi:', imageUrl, e);
        imageElement.src = '/images/default.jpg';
    };
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'blog-image';
    imageContainer.appendChild(imageElement);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'blog-content';
    
    const titleElement = document.createElement('h2');
    titleElement.textContent = decodeHTML(post.title);
    
    const dateElement = document.createElement('p');
    dateElement.className = 'date';
    const date = new Date(post.createdAt);
    dateElement.textContent = date.toLocaleDateString('tr-TR');
    
    const excerptElement = document.createElement('p');
    excerptElement.className = 'excerpt';
    const decodedContent = decodeHTML(post.content);
    const plainContent = decodedContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    excerptElement.textContent = plainContent.substring(0, 150) + '...';
    
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
    
    return postElement;
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
document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes('blog.html')) {
        loadBlogPosts();
    }
});
