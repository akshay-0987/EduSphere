import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.onload = function () {
  const urlParams = new URLSearchParams(window.location.search);
  let fullname = urlParams.get('fullname');
  const phone = urlParams.get('phone');
  const hallticketno = urlParams.get('hallticketno');

  if (fullname && phone && hallticketno) {
    fullname = decodeURIComponent(fullname)
      .replace(/\b(KMIT|Kmit123\$|Kmit123%24)\b/g, '')
      .trim();

    document.getElementById('signup-fullname').value = fullname;
    document.getElementById('signup-phone').value = phone;
    document.getElementById('signup-username').value = hallticketno;
    document.getElementById('signup-username').readOnly = true;
  }

  // ✅ Offline Detection
  window.addEventListener('offline', () => {
    toastr.error("You're offline! Check your internet connection.");
  });
};

window.signup = async function signup() {
  const signupButton = document.getElementById("signup-button");
  const email = document.getElementById('signup-email').value.trim();
  let fullname = document.getElementById('signup-fullname').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const phone = document.getElementById('signup-phone').value.trim();

  fullname = fullname.replace(/\b(KMIT|Kmit123\$|Kmit123%24)\b/g, '').trim();

  if (!validateEmail(email)) {
    toastr.error("Please enter a valid email.");
    return;
  }
  if (username.length < 3) {
    toastr.error("Username must be at least 3 characters.");
    return;
  }
  if (fullname.length < 1) {
    toastr.error("Full name cannot be empty.");
    return;
  }
  if (password.length < 6) {
    toastr.error("Password must be at least 6 characters.");
    return;
  }

  try {
    signupButton.disabled = true;
    signupButton.innerText = "Signing Up...";
    NProgress.start();

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);

    await setDoc(doc(db, 'users', user.uid), {
      email,
      fullname,
      username,
      phone,
      isProfileComplete: false
    });

    toastr.success("Signup successful! Please verify your email before logging in.");
    window.location.href = "login.html";
  } catch (error) {
    handleSignupError(error);
  } finally {
    signupButton.disabled = false;
    signupButton.innerText = "Sign Up";
    NProgress.done();
  }
};

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function handleSignupError(error) {
  console.error("Error signing up: ", error);
  if (error.code === 'auth/email-already-in-use') {
    toastr.error("User already exists. Please log in instead.");
    window.location.href = "login.html";
  } else if (error.code === 'auth/weak-password') {
    toastr.error("Password is too weak. Please choose a stronger password.");
  } else {
    toastr.error("Sign up failed! Please try again later.");
  }
}

window.toggleSignupPassword = function toggleSignupPassword() {
  const passwordField = document.getElementById("signup-password");
  const toggleBtn = document.getElementById("toggle-signup-password");
  if (passwordField.type === "password") {
    passwordField.type = "text";
    toggleBtn.textContent = "🙈";
  } else {
    passwordField.type = "password";
    toggleBtn.textContent = "👁️";
  }
};

window.toggleDarkMode = function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
};
