const firebaseConfig = {
  apiKey: "AIzaSyCzuT02YJc-HO0jdV1o-MGolu9SXKvOAa8",
  authDomain: "admintbot.firebaseapp.com",
  databaseURL: "https://admintbot-default-rtdb.firebaseio.com", // Make sure this is the correct URL for Realtime Database
  projectId: "admintbot",
  storageBucket: "admintbot.firebasestorage.app",
  messagingSenderId: "498830915482",
  appId: "1:498830915482:web:15d59c53ed8ebcd7852c23"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database(); // Get a reference to the Realtime Database