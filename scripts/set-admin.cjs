// Script para establecer un usuario como admin en Firestore
// Ejecutar con: node scripts/set-admin.js

const admin = require('firebase-admin');

// Inicializar con las credenciales del proyecto
admin.initializeApp({
  projectId: 'administracion-ofi-hrms'
});

const db = admin.firestore();

async function setUserAsAdmin(email) {
  try {
    // Buscar usuario por email en Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('Usuario encontrado:', userRecord.uid);

    // Actualizar o crear documento en Firestore con rol admin
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      role: 'admin',
      displayName: email.split('@')[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Usuario ${email} ahora es ADMIN`);

    // Listar todos los usuarios
    const usersSnapshot = await db.collection('users').get();
    console.log('\nUsuarios en Firestore:');
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.email}: ${data.role}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

// Email del usuario a hacer admin
setUserAsAdmin('administracion@ivanguaderrama.com');
