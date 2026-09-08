// ============================================
//  Bigotes y Patitas - firebase-config.js
//  Inicializa Firebase (Firestore + Authentication)
//  y exporta las instancias para usarse en el resto
//  del panel de administración.
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuración real del proyecto "bigotes-y-patitas-7a192"
export const firebaseConfig = {
  apiKey: "AIzaSyDfYw5zVQO6e-6gwUlUmeaHLBAael6wQkU",
  authDomain: "bigotes-y-patitas-7a192.firebaseapp.com",
  projectId: "bigotes-y-patitas-7a192",
  storageBucket: "bigotes-y-patitas-7a192.firebasestorage.app",
  messagingSenderId: "721271173411",
  appId: "1:721271173411:web:548741836fcc683bcbdc96",
  measurementId: "G-SX72VCD4B1",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
