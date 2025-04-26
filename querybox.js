import { db } from './firebase-config.js';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, arrayUnion, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

let currentQuestionId = null;

// Tab Elements
const askTab = document.getElementById('askTab');
const answerTab = document.getElementById('answerTab');
const viewTab = document.getElementById('viewTab');

// Sections
const askSection = document.getElementById('askSection');
const answerSection = document.getElementById('answerSection');
const viewSection = document.getElementById('viewSection');

// Popup buttons
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const cancelPopupBtn = document.getElementById('cancelPopupBtn');

// Tab Switching
askTab.addEventListener('click', () => switchTab('ask'));
answerTab.addEventListener('click', () => switchTab('answer'));
viewTab.addEventListener('click', () => switchTab('view'));

submitAnswerBtn.addEventListener('click', submitAnswer);
cancelPopupBtn.addEventListener('click', closePopup);

// Fix: attach submitQuery to the Ask button via JS
document.getElementById('submitQueryBtn').addEventListener('click', submitQuery);

function switchTab(tab) {
  askSection.classList.add('hidden');
  answerSection.classList.add('hidden');
  viewSection.classList.add('hidden');
  askTab.classList.remove('active-tab');
  answerTab.classList.remove('active-tab');
  viewTab.classList.remove('active-tab');

  if (tab === 'ask') {
    askSection.classList.remove('hidden');
    askTab.classList.add('active-tab');
  } else if (tab === 'answer') {
    answerSection.classList.remove('hidden');
    answerTab.classList.add('active-tab');
    loadQuestions('answerList', true);
  } else {
    viewSection.classList.remove('hidden');
    viewTab.classList.add('active-tab');
    loadQuestions('viewList', false);
  }
}

async function submitQuery() {
  const question = document.getElementById('askQuestion').value.trim();
  const link = document.getElementById('askLink').value.trim();

  if (!question) {
    alert('Please enter a valid question.');
    return;
  }

  try {
    await addDoc(collection(db, 'query'), {
      question,
      link,
      answers: [],
      timestamp: serverTimestamp()
    });

    document.getElementById('askQuestion').value = '';
    document.getElementById('askLink').value = '';
  } catch (error) {
    console.error('Error submitting query:', error);
    alert('Failed to submit query. Try again.');
  }
}

function loadQuestions(containerId, withAnswerBtn = false) {
    const list = document.getElementById(containerId);
    list.innerHTML = '';
  
    const q = query(collection(db, 'query'), orderBy('timestamp', 'desc'));
  
    onSnapshot(q, snapshot => {
      list.innerHTML = '';
  
      const filteredDocs = snapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        // For "view queries", show only solved (answered) ones
        if (!withAnswerBtn) return data.answers && data.answers.length > 0;
        return true;
      });
  
      if (filteredDocs.length === 0) {
        list.innerHTML = `
          <div class="glass p-4 text-center text-lg text-white">
            ${withAnswerBtn ? 'No new Questions to solve 😭' : 'No Questions solved yet ✨'}
          </div>`;
        return;
      }
  
      filteredDocs.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement('div');
        div.className = 'bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all space-y-4 relative';
  
        // Base question + optional Answer button beside it
        div.innerHTML = `
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <p class="text-base font-semibold text-cyan-300">Question:</p>
              <p class="text-lg font-medium text-white mt-1">${data.question}</p>
              ${data.link ? `<a href="${data.link}" class="text-cyan-200 underline text-sm break-words mt-1 block" target="_blank">${data.link}</a>` : ''}
            </div>
            ${withAnswerBtn
              ? `<button class="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-white font-semibold shadow answer-btn" data-id="${docSnap.id}">Answer</button>`
              : ''}
          </div>
  
          ${data.answers?.length && containerId === 'viewList'
            ? `
              <div class="space-y-3 mt-2">
                <p class="text-base font-semibold text-green-300">Answer${data.answers.length > 1 ? 's' : ''}:</p>
                ${data.answers.map(a => `
                  <div class="bg-white/20 backdrop-blur-md p-4 rounded-xl shadow-sm text-white">
                    <p class="text-sm mb-1">${a.text}</p>
                    ${a.link ? `<a href="${a.link}" class="text-blue-300 underline text-xs block mt-0.5" target="_blank">${a.link}</a>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''
          }
        `;
  
        list.appendChild(div);
      });
  
      // Attach click handlers for "Answer" buttons
      if (withAnswerBtn) {
        const buttons = list.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
          btn.addEventListener('click', () => {
            currentQuestionId = btn.dataset.id;
            document.getElementById('answerPopup').classList.remove('hidden');
          });
        });
      }
    });
  }
  
function closePopup() {
  document.getElementById('answerPopup').classList.add('hidden');
  document.getElementById('answerInput').value = '';
  document.getElementById('answerLink').value = '';
}

async function submitAnswer() {
  const answer = document.getElementById('answerInput').value.trim();
  const link = document.getElementById('answerLink').value.trim();

  if (!answer || !currentQuestionId) {
    alert('Answer is required.');
    return;
  }

  try {
    const ref = doc(db, 'query', currentQuestionId);
    await updateDoc(ref, {
      answers: arrayUnion({ text: answer, link })
    });

    closePopup();
  } catch (error) {
    console.error('Error submitting answer:', error);
    alert('Failed to submit answer. Try again.');
  }
}
