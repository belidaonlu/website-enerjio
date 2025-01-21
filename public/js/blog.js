async function loadBlogPosts() {
    try {
        console.log('Blog yazıları yükleniyor...');
        const response = await fetch('http://localhost:3002/public/posts', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('Sunucu yanıtı:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const posts = await response.json();
        console.log('Alınan yazılar:', posts);
        displayBlogPosts(posts);
    } catch (error) {
        console.error('Blog yazıları yüklenirken hata:', error);
        const container = document.querySelector('.blog-content');
        container.innerHTML = `
            <div class="alert alert-danger">
                Blog yazıları yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.<br>
                Hata detayı: ${error.message}
            </div>
        `;
    }
}

function displayBlogPosts(posts) {
    const container = document.querySelector('.blog-content');
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Henüz yayınlanmış blog yazısı bulunmuyor.</div>';
        return;
    }

    const postsHTML = posts.map(post => {
        // Resim URL'ini hazırla
        let imageUrl = '/images/default-blog-image.jpg';
        if (post.coverImage) {
            imageUrl = post.coverImage.startsWith('/') ? 
                `http://localhost:3002${post.coverImage}` : 
                post.coverImage;
        }

        return `
            <article class="blog-post">
                <div class="post-image">
                    <img src="${imageUrl}" alt="${post.title}" class="img-fluid">
                </div>
                <div class="post-content">
                    <h2>${post.title}</h2>
                    <div class="post-meta">
                        <span class="date">
                            ${post.createdAt ? new Date(post.createdAt).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            }) : 'Tarih belirtilmemiş'}
                        </span>
                        ${post.author && post.author.name ? 
                            `<span class="author">Yazar: ${post.author.name}</span>` : 
                            ''}
                    </div>
                    <div class="post-text">
                        ${post.content.length > 300 ? post.content.substring(0, 300) + '...' : post.content}
                    </div>
                    <a href="/blog-post.html?id=${post._id}" class="button-primary blog-button w-inline-block">
                        <div class="button-primary-text-wrapper">
                            <div>Devamını Oku</div>
                            <div class="button-primary-arrow small"></div>
                        </div>
                    </a>
                </div>
            </article>
        `;
    }).join('');

    container.innerHTML = postsHTML;
}

// Sayfa yüklendiğinde blog yazılarını yükle
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sayfa yüklendi, blog yazıları yükleniyor...');
    loadBlogPosts();
}); 