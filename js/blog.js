// Blog yazılarını yükle
async function loadBlogPosts() {
    const loadingElement = document.querySelector('.loading');
    const errorElement = document.querySelector('.error-message');
    const blogGrid = document.querySelector('.blog-grid');

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
            const imageUrl = post.image ? `http://localhost:3002/uploads/${post.image}` : '/images/default.jpg';
            
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

// Sayfa yüklendiğinde blog yazılarını yükle
document.addEventListener('DOMContentLoaded', loadBlogPosts);
