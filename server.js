const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

app.post('/demo-form', (req, res) => {
  const { 'İ-im-Soyisim': name, 'E-posta': email, Telefon: phone, irket: company, 'Web-sitesi': website, Pozisyon: position } = req.body;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: 'noreply@enerj.io',
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
      console.log(error);
      res.status(500).send('Bir hata oluştu, lütfen daha sonra tekrar deneyin.');
    } else {
      console.log('Email sent: ' + info.response);
      res.status(200).send('Demo formu başarıyla gönderildi.');
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} nolu portta çalışıyor.`);
});