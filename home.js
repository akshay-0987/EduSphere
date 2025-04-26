import { auth, db } from './firebase-config.js';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, getDocs, runTransaction, addDoc, serverTimestamp, deleteField, deleteDoc  } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { deleteUser, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

/// ------------------------------------------------ Profile Dropdown & Auth State Start ------------------------------------------------ //

const profileImage = document.getElementById("profileImage");
const profileOptions = document.getElementById("profileOptions");
const logoutOption = document.getElementById("logoutOption");

function toggleProfileDropdown() {
    profileOptions.style.display = profileOptions.style.display === "block" ? "none" : "block";
}

profileImage.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent event bubbling
    toggleProfileDropdown();
});

document.addEventListener("click", (e) => {
    if (!profileOptions.contains(e.target) && e.target !== profileImage) {
        profileOptions.style.display = "none";
    }
});

// Load current user details
onAuthStateChanged(auth, async (user) => {
    updateProfileOptions(); // Update profile nav options based on state

    if (!user) {
        profileOptions.style.display = "none";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return console.error("No such user document!");

        const { profilePicUrl = './images/social logo.png', fullname, username } = userDoc.data();

        // Update profile nav
        document.getElementById('profile-name').textContent = fullname;
        document.getElementById('profile-handle').textContent = `@${username}`;
        document.getElementById('profileImage').src = profilePicUrl;
        document.getElementById('profileDropdownImage').src = profilePicUrl;

        // Sidebar profile
        document.getElementById('sidebarProfileName').textContent = fullname;
        document.getElementById('sidebarProfileHandle').textContent = `@${username}`;
        document.getElementById('sidebarProfileImage').src = profilePicUrl;

        // Load posts from user and their following
        loadPosts(user.uid);

        // Real-time listen to update post usernames
        listenForUserUpdates(user.uid);
    } catch (err) {
        console.error("Error loading user info:", err);
    }
});

function updateProfileOptions() {
    const user = auth.currentUser;
    document.getElementById('myProfileOption').style.display = user ? 'block' : 'none';
    document.getElementById('loginOption').style.display = user ? 'none' : 'block';
    document.getElementById('signupOption').style.display = user ? 'none' : 'block';
    document.getElementById('logoutOption').style.display = user ? 'block' : 'none';
}

if (logoutOption) {
    logoutOption.addEventListener("click", async () => {
        try {
            await auth.signOut();
            alert("You have successfully logged out.");
            window.location.href = "login.html";
        } catch (err) {
            alert("Error signing out. Please try again.");
            console.error(err);
        }
    });
}

// ------------------------------------------------ Profile Dropdown & Auth State End ------------------------------------------------ //


// ------------------------------------------------ Posts Loading Start ------------------------------------------------------ //

const profilePicCache = {};

// Load posts from the user and followed users
function loadPosts(userId) {
    const feedsContainer = document.querySelector('.feeds');
    feedsContainer.innerHTML = '<p>Loading posts...</p>';

    const userRef = doc(db, 'users', userId);
    getDoc(userRef).then(userSnapshot => {
        if (!userSnapshot.exists()) {
            feedsContainer.innerHTML = '<p>User not found.</p>';
            return;
        }

        const followedUsers = userSnapshot.data().following || [];
        followedUsers.push(userId); // Include self

        const postPromises = followedUsers.map(uid => {
            const postsRef = collection(db, 'users', uid, 'posts');
            return getDocs(query(postsRef, orderBy('timestamp', 'desc')))
                .catch(err => {
                    console.error(`Error fetching posts for ${uid}:`, err);
                    return [];
                });
        });

        Promise.all(postPromises).then(snapshots => {
            const allPosts = [];
            snapshots.forEach(snapshot => snapshot.forEach(doc => allPosts.push(doc)));
            allPosts.sort((a, b) => b.data().timestamp?.seconds - a.data().timestamp?.seconds);

            feedsContainer.innerHTML = '';
            allPosts.forEach(doc => {
                const ownerId = doc.data().ownerId;
                getOwnerProfilePic(ownerId).then(picUrl => renderPost(doc, picUrl));
            });
        });
    }).catch(err => {
        console.error("Error fetching user document:", err);
        feedsContainer.innerHTML = '<p>Error loading posts.</p>';
    });
}

function getOwnerProfilePic(ownerId) {
    if (profilePicCache[ownerId]) {
        return Promise.resolve(profilePicCache[ownerId]);
    }

    return getDoc(doc(db, 'users', ownerId)).then(userDoc => {
        const profilePicUrl = userDoc.exists() ? (userDoc.data().profilePicUrl || './images/social logo.png') : './images/social logo.png';
        profilePicCache[ownerId] = profilePicUrl;
        return profilePicUrl;
    }).catch(err => {
        console.error("Error fetching profile pic:", err);
        return './images/social logo.png';
    });
}

function updatePostUsernames(ownerId, newUsername) {
    document.querySelectorAll(`.feed[data-owner-id="${ownerId}"] .info a`).forEach(link => {
        link.textContent = `@${newUsername || "User"}`;
    });
}

function listenForUserUpdates(ownerId) {
    return onSnapshot(doc(db, 'users', ownerId), (doc) => {
        if (doc.exists()) {
            updatePostUsernames(ownerId, doc.data().username);
        }
    }, (err) => {
        console.error("Error listening for user update:", err);
    });
}

// ------------------------------------------------ Posts Loading End ------------------------------------------------------ //

function renderPost(doc, profilePicUrl) {
    const feedsContainer = document.querySelector('.feeds');
    if (!feedsContainer || !doc.exists()) return;

    const data = doc.data();
    const caption = data.caption || 'No caption provided';
    const hashtags = data.hashtags || 'yourHashtag';
    const likes = data.likes || 0;
    const timestamp = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();
    const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const postHTML = `
        <div class="feed fade-in" data-id="${doc.id}" data-owner-id="${data.ownerId}">
            <div class="head">
                <div class="user">
                    <div class="profile-photo">
                        <img src="${profilePicUrl}" alt="${data.username || 'User'}'s profile picture">
                    </div>
                    <div class="info">
                        <a href="/social-media-website-main/social-media-website-main/profile.html?uid=${data.ownerId}">
                            ${data.username || "User"}
                        </a>
                    </div>
                </div>
                <span class="edit">
                    <i class="uil uil-ellipsis-h"></i>
                    <button class="delete-button" style="display: none;">Delete</button>
                </span>
            </div>

            <div class="caption-container">
                <div class="caption">
                    <p>${caption}</p>
                </div>
            </div>

            <div class="caption">
                <p><b><span class="hashtag">${hashtags}</span></b></p>
            </div>

            <div class="action-buttons">
                <div class="interaction-buttons">
                    <span class="like-button" data-id="${doc.id}" data-owner-id="${data.ownerId}">
                        <i class="uil uil-heart"></i>
                        <span class="like-count">${likes}</span>
                    </span>
                    <span class="comment-icon">
                        <i class="uil uil-comment-dots"></i>
                    </span>
                </div>
            </div>

            <small>${formattedTime}</small>
        </div>
    `;

    feedsContainer.insertAdjacentHTML('afterbegin', postHTML);

    const postElement = feedsContainer.querySelector(`.feed[data-id="${doc.id}"]`);

    // Delete toggle
    const editIcon = postElement.querySelector('.edit i');
    const deleteButton = postElement.querySelector('.delete-button');
    editIcon.addEventListener('click', () => {
        deleteButton.style.display = deleteButton.style.display === 'none' ? 'block' : 'none';
    });

    deleteButton.addEventListener('click', () => deletePost(doc.id, data.ownerId));

    // Comment toggle
    const commentIcon = postElement.querySelector('.comment-icon');
    commentIcon.addEventListener('click', () => {
        toggleCommentsPopup(doc.id, data.ownerId);
    });

    // Like handler
    const likeButton = postElement.querySelector('.like-button');
    likeButton.addEventListener('click', async () => {
        await handleLike(doc.id, data.ownerId);
    });
}

// ------------------------------------------------ Posts End ------------------------------------------------------ //

// ------------------------------- Delete Post ------------------------------- //
async function deletePost(postId, ownerId) {
    try {
        const postRef = doc(db, 'users', ownerId, 'posts', postId);
        await deleteDoc(postRef);
        console.log('Post deleted successfully');
        document.querySelector(`.feed[data-id="${postId}"]`)?.remove();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
    }
}


// ------------------------------- Like Handling ------------------------------- //
async function handleLike(postId, ownerId) {
    const userId = auth.currentUser?.uid;
    const likeButton = document.querySelector(`[data-id="${postId}"] .like-button`);
    const likeCountElement = likeButton?.querySelector('.like-count');
    
    if (!userId || !likeButton || !likeCountElement) return;

    try {
        const postRef = doc(db, 'users', ownerId, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) return;

        const postData = postDoc.data();
        const currentLikes = postData.likes || 0;
        const likedUsers = postData.likedUsers || {};
        const isLiked = likedUsers[userId] !== undefined;

        likeCountElement.textContent = isLiked ? currentLikes - 1 : currentLikes + 1;
        likeButton.classList.toggle('liked', !isLiked);

        likeButton.classList.add('clicked');
        setTimeout(() => likeButton.classList.remove('clicked'), 300);


        await updateDoc(postRef, {
            likes: isLiked ? currentLikes - 1 : currentLikes + 1,
            [`likedUsers.${userId}`]: isLiked ? deleteField() : new Date()
        });

        console.log(`${isLiked ? 'Unliked' : 'Liked'} post: ${postId}`);
    } catch (error) {
        console.error('Error updating like:', error);
    }
}

async function checkUserLikeStatus(postId, ownerId) {
    const userId = auth.currentUser?.uid;
    const likeButton = document.querySelector(`[data-id="${postId}"] .like-button`);
    const likeCountElement = likeButton?.querySelector('.like-count');

    if (!userId || !likeButton || !likeCountElement) return;

    try {
        const postRef = doc(db, 'users', ownerId, 'posts', postId);
        const postDoc = await getDoc(postRef);

        if (!postDoc.exists()) return;

        const postData = postDoc.data();
        likeCountElement.textContent = postData.likes || 0;
        const isLiked = postData.likedUsers?.[userId] !== undefined;
        likeButton.classList.toggle('liked', isLiked);
    } catch (error) {
        console.error('Error checking like status:', error);
    }
}

// Initialize like status for all buttons
window.addEventListener('load', () => {
    document.querySelectorAll('.like-button').forEach(button => {
        const postId = button.dataset.id;
        const ownerId = button.dataset.ownerId;
        checkUserLikeStatus(postId, ownerId);

        button.addEventListener('click', () => handleLike(postId, ownerId));
    });
});


// ------------------------------- Comments ------------------------------- //
async function loadComments(postId, ownerId) {
    const container = document.getElementById('commentsContainer');
    if (!container) return;

    try {
        const commentsRef = collection(db, 'users', ownerId, 'posts', postId, 'comments');
        const snapshot = await getDocs(query(commentsRef, orderBy('timestamp', 'asc')));

        container.innerHTML = '';

        snapshot.forEach(async (doc) => {
            const { username = "User", comment } = doc.data();
        
            let profilePicUrl = 'default.png';
        
            try {
                const userQuery = query(
                    collection(db, 'users'),
                    where('username', '==', username)
                );
                const userSnapshot = await getDocs(userQuery);
                if (!userSnapshot.empty) {
                    const userData = userSnapshot.docs[0].data();
                    profilePicUrl = userData.profilePicUrl || 'default.png';
                }
            } catch (err) {
                console.error("Failed to fetch profile picture:", err);
            }
        
            const commentElement = document.createElement('div');
commentElement.className = 'comment-item';

commentElement.innerHTML = `
  <img src="${profilePicUrl}" 
      alt="${username}'s profile picture" 
      class="comment-avatar">
  <p class="comment-content"><b>${username}:</b> ${comment}</p>
  <button class="delete-comment-btn" 
      data-comment-id="${doc.id}" 
      data-post-id="${postId}" 
      data-owner-id="${ownerId}">
      Delete
  </button>
`;

document.getElementById('commentsContainer').appendChild(commentElement);
});
        
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

async function deleteComment(postId, ownerId, commentId) {
    try {
        await deleteDoc(doc(db, 'users', ownerId, 'posts', postId, 'comments', commentId));
        await loadComments(postId, ownerId);
    } catch (error) {
        console.error('Error deleting comment:', error);
    }
}

async function handleComment(postId, ownerId, comment) {
    if (comment.trim() === "") return;

    try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const username = userDoc.exists() ? userDoc.data().username || "User" : "User";

        await addDoc(collection(db, 'users', ownerId, 'posts', postId, 'comments'), {
            username,
            comment,
            timestamp: serverTimestamp()
        });

        await loadComments(postId, ownerId);
        document.getElementById('commentInput').value = "";
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

function toggleCommentsPopup(postId, ownerId) {
    const popup = document.getElementById('commentsPopup');
    const input = document.getElementById('commentInput');
    const sendBtn = document.getElementById('sendCommentBtn');

    if (!popup || !input || !sendBtn) return;

    // Force show
    popup.classList.remove('hidden');
    input.value = "";
    sendBtn.dataset.postId = postId;
    sendBtn.dataset.ownerId = ownerId;

    loadComments(postId, ownerId);
}


// Set up comment popup open buttons
document.querySelectorAll('.comment-button').forEach(button => {
    button.addEventListener('click', () => {
        const postId = button.dataset.postId;
        const ownerId = button.dataset.ownerId;
        toggleCommentsPopup(postId, ownerId);
    });
});

// Close popup
document.getElementById('closeCommentsBtn')?.addEventListener('click', () => {
    document.getElementById('commentsPopup')?.classList.add('hidden');
});

// Send comment
document.getElementById('sendCommentBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('sendCommentBtn');
    const postId = btn.dataset.postId;
    const ownerId = btn.dataset.ownerId;
    const comment = document.getElementById('commentInput')?.value || "";

    if (postId && ownerId) {
        handleComment(postId, ownerId, comment);
    }
});

// Delete comment (event delegation)
document.getElementById('commentsContainer')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-comment-btn')) {
        const commentId = e.target.dataset.commentId;
        const postId = e.target.dataset.postId;
        const ownerId = e.target.dataset.ownerId;
        deleteComment(postId, ownerId, commentId);
    }
});

// ------------------------------------------------ Posts Commenting End ------------------------------------------------------ //

// ------------------------------------------------ Search Modal Start ------------------------------------------------------ //

const searchModal = document.getElementById('searchModal');
const searchInput = document.getElementById('searchInput');
const suggestionsContainer = document.getElementById('suggestionsContainer');

// Open Search Modal
document.getElementById('exploreMenuItem').addEventListener('click', () => {
    searchModal.style.display = 'block';
    searchInput.focus();
});

// Close Search Modal
document.querySelector('.close-btn').addEventListener('click', () => {
    searchModal.style.display = 'none';
    suggestionsContainer.innerHTML = '';
    searchInput.value = '';
});

// Manual Search Button Click
document.getElementById('searchButton').addEventListener('click', async () => {
    const username = searchInput.value.trim();
    if (!username) return alert('Please enter a username.');

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userId = querySnapshot.docs[0].id;
            window.location.href = `profile.html?uid=${userId}`;
        } else {
            alert('User not found');
        }
    } catch (error) {
        console.error('Error searching for user:', error);
        alert('An error occurred while searching. Please try again.');
    }
});

// Live Suggestions
searchInput.addEventListener('input', async () => {
    const queryText = searchInput.value.trim();

    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'none'; // Hide by default

    if (!queryText) return;

    try {
        const q = query(
            collection(db, 'users'),
            where('username', '>=', queryText),
            where('username', '<=', queryText + '\uf8ff')
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            suggestionsContainer.innerHTML = '<p style="padding: 1rem; color: #fff;">No users found</p>';
            suggestionsContainer.style.display = 'block';
            return;
        }

        querySnapshot.forEach(doc => {
            const { username, profilePicUrl } = doc.data();
            const userId = doc.id;

            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-item';

            suggestion.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${profilePicUrl || 'default.png'}" 
                        alt="Profile Picture" 
                        style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: #ccc;">
                    <span>${username}</span>
                </div>
            `;

            suggestion.addEventListener('click', () => {
                window.location.href = `profile.html?uid=${userId}`;
            });

            suggestionsContainer.appendChild(suggestion);
        });

        suggestionsContainer.style.display = 'block'; // Show after appending
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
});


// ------------------------------------------------ Search Modal End ------------------------------------------------------ //



// ------------------------------------------------ Notifications Start ------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const notificationBtn = document.getElementById('notifications');
    const notificationsPopup = notificationBtn.querySelector('.notifications-popup');
    const notificationCount = notificationBtn.querySelector('.notification-count');
  
    notificationBtn.addEventListener('click', () => {
      const isVisible = notificationsPopup.style.display === 'block';
      notificationsPopup.style.display = isVisible ? 'none' : 'block';
      notificationsPopup.style.opacity = isVisible ? '0' : '1';
  
      if (!isVisible) {
        onAuthStateChanged(auth, async user => {
          if (user) await fetchNotifications(user.uid);
        });
      } else {
        clearNotifications();
      }
    });
  
    document.addEventListener('click', e => {
      if (!notificationBtn.contains(e.target)) {
        clearNotifications();
      }
    });
  
    async function fetchNotifications(userId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        let count = 0;
        notificationsPopup.innerHTML = ''; // Reset
  
        // Followers
        if (Array.isArray(userData.followers)) {
          for (const followerId of userData.followers) {
            const follower = await getUserData(followerId);
            if (follower) {
              addNotification(follower.fullname, 'started following you', follower.profilePicUrl, null);
              count++;
            }
          }
        }
  
        const postsSnapshot = await getDocs(collection(db, 'users', userId, 'posts'));
        for (const postDoc of postsSnapshot.docs) {
          const postData = postDoc.data();
          const postId = postDoc.id;
  
          // Likes
          if (postData.likedUsers) {
            for (const likeId in postData.likedUsers) {
              const liker = await getUserData(likeId);
              if (liker) {
                addNotification(liker.fullname, 'liked your post', liker.profilePicUrl, postData.likedUsers[likeId], postId);
                count++;
              }
            }
          }
  
          // Comments
          if (Array.isArray(postData.comments)) {
            for (const comment of postData.comments) {
              const commenter = await getUserData(comment.userId);
              if (commenter) {
                addNotification(commenter.fullname, 'commented on your post', commenter.profilePicUrl, comment.timestamp, postId);
                count++;
              }
            }
          }
        }
  
        updateNotificationCount(count);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    }
  
    function addNotification(name, action, picUrl, timestamp, postId = null) {
      const div = document.createElement('div');
      div.className = 'notification-item';
  
      const timeAgo = timestamp ? `<small class="text-muted">${formatTime(timestamp)}</small>` : '';
      div.innerHTML = `
        <div class="profile-photo">
          <img src="${picUrl || './images/social logo.png'}" />
        </div>
        <div class="notification-body">
          <b>${name}</b> ${action}
          ${timeAgo}
        </div>
      `;
  
      // Click: mark read & go to post if available
      if (postId) {
        div.addEventListener('click', () => {
          window.location.href = `post.html?id=${postId}`;
        });
      } else {
        div.addEventListener('click', () => {
          div.style.opacity = '0.5'; // Mark as read
        });
      }
  
      notificationsPopup.prepend(div);
    }
  
    function formatTime(timestamp) {
      let date;
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
  
      if (isNaN(date)) return '';
      const diff = Math.floor((Date.now() - date.getTime()) / 60000); // mins
      if (diff < 1) return 'just now';
      if (diff < 60) return `${diff} min${diff === 1 ? '' : 's'} ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)} hour${Math.floor(diff / 60) === 1 ? '' : 's'} ago`;
      return date.toLocaleDateString();
    }
  
    function updateNotificationCount(count) {
      if (count > 0) {
        notificationCount.textContent = count;
        notificationCount.style.display = 'inline';
      } else {
        notificationCount.style.display = 'none';
      }
    }
  
    function clearNotifications() {
      notificationsPopup.style.display = 'none';
      notificationsPopup.innerHTML = '';
      notificationCount.textContent = '0';
      notificationCount.style.display = 'none';
    }
  
    async function getUserData(userId) {
      try {
        const docSnap = await getDoc(doc(db, 'users', userId));
        return docSnap.exists() ? docSnap.data() : null;
      } catch (error) {
        console.error('Error getting user data:', error);
        return null;
      }
    }
  });
  

// ------------------------------------------------ Notifications End ------------------------------------------------------

// ------------------------------------------------ Settings modal ------------------------------------------------------

window.resetPassword = async function () {
    if (!auth.currentUser) return;
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      toastr.success('Password reset link sent');
    } catch (e) {
      toastr.error('Error sending email');
    }
  }
  
  window.deleteAccount = async function () {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid));
      await deleteUser(auth.currentUser);
      toastr.success("Account deleted");
      window.location.href = 'login.html';
    } catch (e) {
      toastr.error("Failed to delete account");
    }
  }
  
  window.logout = async function () {
    try {
      await signOut(auth);
      toastr.success("Logged out");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 800);
    } catch (e) {
      toastr.error("Error during logout");
    }
  }
  
  window.toggleTheme = function () {
    const current = localStorage.getItem('theme') || 'auto';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light';
    localStorage.setItem('theme', next);
    applyTheme();
    toastr.info(`Theme set to ${next}`);
  }
  
  function applyTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.body.style.backgroundColor = '#121212';
      document.body.style.color = '#fff';
    } else if (theme === 'light') {
      document.body.style.backgroundColor = '#f5f5f5';
      document.body.style.color = '#000';
    } else {
      document.body.style.backgroundColor = '';
      document.body.style.color = '#fff';
    }
  }
  applyTheme();