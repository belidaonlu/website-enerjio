const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// CORS yapılandırması
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware'ler
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.', { 
  extensions: ['html', 'htm']
}));

console.log('Statik dosya dizini yapılandırıldı');

// E-posta yapılandırması
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Test e-postası gönderimi
transporter.verify((error, success) => {
  if (error) {
    console.error('E-posta yapılandırma hatası:', error);
  } else {
    console.log('E-posta sunucusu hazır');
  }
});

app.get('/', (req, res) => {
  console.log('Ana sayfa isteği alındı');
  res.sendFile('index.html', { root: '.' });
});

app.post('/demo-form', (req, res) => {
  console.log('Demo form isteği alındı:', req.body);
  
  const { 'İ-im-Soyisim': name, 'E-posta': email, Telefon: phone, irket: company, 'Web-sitesi': website, Pozisyon: position } = req.body;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: 'belidaonlu@gmail.com',
    subject: 'Demo Formu Gönderimi',
    text: `
      İsim-Soyisim: ${name}
      E-posta: ${email}
      Telefon: ${phone}
      Şirket: ${company}
      Web Sitesi: ${website}
      Pozisyon: ${position}
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('E-posta gönderim hatası:', error);
      res.status(500).send('Bir hata oluştu, lütfen daha sonra tekrar deneyin.');
    } else {
      console.log('E-posta gönderildi:', info.response);
      res.status(200).send('Demo formu başarıyla gönderildi.');
    }
  });
});

// Command line arguments parsing
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1]) : process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`Ayrıca http://127.0.0.1:${PORT} veya http://[yerel IP]:${PORT} üzerinden de erişilebilir`);
});