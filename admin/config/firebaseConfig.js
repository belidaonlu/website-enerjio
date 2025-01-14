const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = {
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

const admin = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(admin);
const db = getFirestore(admin);

module.exports = { auth, db };
