document.addEventListener('DOMContentLoaded', async function() {
    // Ana sayfada olup olmadığımızı kontrol et
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const servicesContainer = document.getElementById('services-content');
        if (!servicesContainer) return;

        // Container'a stil ekle
        servicesContainer.style.position = 'relative';
        servicesContainer.style.zIndex = '1';
        servicesContainer.style.backgroundColor = '#fff';

        try {
            // Hizmetlerimiz sayfasını fetch et
            const response = await fetch('hizmetlerimiz.html');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // İstenen sectionları seç
            const sectionIds = [
                'analiz-section',
                'finansal-section',
                'karbon-section',
                's-rd-r-lebilirlik-section',
                'y-netim-section',
                'uyar--section'
            ];

            // Her section için
            sectionIds.forEach(id => {
                const section = doc.getElementById(id);
                if (section) {
                    // Section'ı kopyala ve ana sayfaya ekle
                    const clonedSection = section.cloneNode(true);
                    
                    // Section'a görünürlük stilleri ekle
                    clonedSection.style.display = 'block';
                    clonedSection.style.opacity = '1';
                    clonedSection.style.position = 'relative';
                    clonedSection.style.zIndex = '1';
                    
                    // Transform ve opacity özelliklerini sıfırla
                    const elements = clonedSection.querySelectorAll('[style*="transform"]');
                    elements.forEach(el => {
                        el.style.transform = 'none';
                        el.style.opacity = '1';
                    });
                    
                    servicesContainer.appendChild(clonedSection);
                }
            });
        } catch (error) {
            console.error('Hizmetler yüklenirken hata oluştu:', error);
        }
    }
});
