// Firebase Initialization (ensure you have your Firebase config here)
const firebaseConfig = {
    apiKey: "AIzaSyDYvFdWoLL-YAObctYXBfkqwkUbLBXTsTk",
    authDomain: "arblog-a19f3.firebaseapp.com",
    projectId: "arblog-a19f3",
    storageBucket: "arblog-a19f3.appspot.com",
    messagingSenderId: "1001446483266",
    appId: "1:1001446483266:web:436692dd843096e5eed4db",
    measurementId: "G-4C40XF2L3W"
  };

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Get elements
const profilePic = document.getElementById('profilePic');
const usernameElement = document.getElementById('username');
const bioElement = document.getElementById('bio');
const followBtn = document.getElementById('followBtn');
const followersElement = document.getElementById('followers');
const postsContainer = document.getElementById('postsContainer');
const darkModeToggle = document.getElementById('darkModeToggle');

// Toggle Dark Mode
darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

// Get User Data (replace with actual user data fetching logic)
function loadUserProfile() {
    const userId = auth.currentUser?.uid;
    if (userId) {
        db.collection('users').doc(userId).get().then((doc) => {
            const data = doc.data();
            profilePic.src = data.profileImage || 'default-profile.jpg';
            usernameElement.textContent = data.username || 'Anonymous';
            bioElement.textContent = data.bio || 'No bio available.';
            followersElement.textContent = data.followers || 0;
        }).catch((error) => {
            console.error('Error getting user data:', error);
        });

        loadUserPosts(userId);
    }
}

// Load User Posts (replace with actual logic)
function loadUserPosts(userId) {
    db.collection('posts').where('userId', '==', userId).get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.classList.add('post');
            postElement.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.content}</p>
            `;
            postsContainer.appendChild(postElement);
        });
    }).catch((error) => {
        console.error('Error loading posts:', error);
    });
}

// Follow Button Logic (simplified)
followBtn.addEventListener('click', () => {
    const userId = auth.currentUser?.uid;
    if (userId) {
        db.collection('users').doc(userId).update({
            followers: firebase.firestore.FieldValue.increment(1),
        }).then(() => {
            followersElement.textContent = parseInt(followersElement.textContent) + 1;
        }).catch((error) => {
            console.error('Error following user:', error);
        });
    }
});

// Initialize Profile on Page Load
if (auth.currentUser) {
    loadUserProfile();
}
