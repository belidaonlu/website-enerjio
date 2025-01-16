const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// CORS yapılandırması
app.use(cors({
  origin: ['http://localhost:4000', 'http://127.0.0.1:4000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware'ler
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.', { 
  extensions: ['html', 'htm']
}));
app.use(express.static(path.join(__dirname)));

console.log('Statik dosya dizini yapılandırıldı');

// E-posta yapılandırması
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test e-postası gönderimi
transporter.verify((error, success) => {
  if (error) {
    console.error('E-posta yapılandırma hatası:', error);
    console.error('Gmail kullanıcı adı:', process.env.GMAIL_USER);
    // Şifreyi güvenlik nedeniyle loglamıyoruz
  } else {
    console.log('E-posta sunucusu hazır');
    // Test e-postası gönder
    const testMailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: 'Test E-postası',
      text: 'Bu bir test e-postasıdır.'
    };
    
    transporter.sendMail(testMailOptions, (error, info) => {
      if (error) {
        console.error('Test e-postası gönderim hatası:', error);
      } else {
        console.log('Test e-postası başarıyla gönderildi:', info.response);
      }
    });
  }
});

app.get('/', (req, res) => {
  console.log('Ana sayfa isteği alındı');
  res.sendFile('index.html', { root: '.' });
});

app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'blog.html'));
});

app.get('/blog-post', (req, res) => {
  res.sendFile(path.join(__dirname, 'blog-post.html'));
});

app.post('/demo-form', async (req, res) => {
  console.log('Demo form isteği alındı');
  console.log('Form verileri:', req.body);
  
  try {
    const { 'İ-im-Soyisim': name, 'E-posta': email, Telefon: phone, irket: company, 'Web-sitesi': website, Pozisyon: position } = req.body;

    // Form verilerinin kontrolü
    if (!name || !email || !phone) {
      console.error('Eksik form verileri:', { name, email, phone });
      return res.status(400).json({ 
        error: 'Lütfen tüm zorunlu alanları doldurun',
        received: { name, email, phone }
      });
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: 'Demo Formu Gönderimi',
      text: `
        İsim-Soyisim: ${name}
        E-posta: ${email}
        Telefon: ${phone}
        Şirket: ${company || 'Belirtilmedi'}
        Web Sitesi: ${website || 'Belirtilmedi'}
        Pozisyon: ${position || 'Belirtilmedi'}
      `
    };

    // Promise'e dönüştürülmüş sendMail
    const info = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('E-posta gönderim hatası detayları:', error);
          reject(error);
        } else {
          resolve(info);
        }
      });
    });

    console.log('E-posta başarıyla gönderildi:', info.response);
    res.status(200).json({
      success: true,
      message: 'Demo formu başarıyla gönderildi'
    });
  } catch (error) {
    console.error('İşlem hatası:', error);
    res.status(500).json({
      error: 'E-posta gönderilirken bir hata oluştu',
      details: error.message
    });
  }
});

const PORT = 4000; // Web sitesi için sabit port
app.listen(PORT, () => {
  console.log(`Web sitesi sunucusu ${PORT} portunda çalışıyor`);
});