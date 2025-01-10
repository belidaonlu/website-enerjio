// Blog yazılarını yükle
async function loadBlogPosts() {
    try {
        const response = await fetch('http://localhost:4000/api/posts');
        const posts = await response.json();
        
        const blogGrid = document.querySelector('.blog-grid');
        blogGrid.innerHTML = ''; // Mevcut içeriği temizle
        
        posts.forEach(post => {
            const imageUrl = post.image ? `http://localhost:4000/uploads/${post.image}` : 'images/default-blog-image.jpg';
            
            const postElement = document.createElement('div');
            postElement.className = 'blog-card';
            
            const imageElement = document.createElement('img');
            imageElement.src = imageUrl;
            imageElement.alt = post.title;
            imageElement.onerror = () => {
                imageElement.src = 'images/default-blog-image.jpg';
            };
            
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
        document.querySelector('.blog-grid').innerHTML = `
            <div class="error-message">
                Blog yazıları yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.
            </div>
        `;
    }
}

// Sayfa yüklendiğinde blog yazılarını yükle
document.addEventListener('DOMContentLoaded', loadBlogPosts);
