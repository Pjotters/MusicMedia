// MusicMedia AI Suno-style logic
let currentTab = 'simple';
let tags = [];
let isInstrumental = true;
let loading = false;

const promptInput = document.getElementById('ai-prompt');
const tagInput = document.getElementById('ai-tag-input');
const tagsDiv = document.getElementById('ai-tags');
const instrumentalToggle = document.getElementById('ai-instrumental-toggle');
const generateBtn = document.getElementById('ai-generate-btn');
const feedbackDiv = document.getElementById('ai-feedback');
const feedbackText = document.getElementById('ai-feedback-text');
const spinner = document.querySelector('.ai-suno-spinner');
const galleryDiv = document.getElementById('ai-gallery');
const workspaceTitle = document.getElementById('ai-workspace-title');
const communityBtn = document.getElementById('ai-community-btn');
const backBtn = document.getElementById('ai-back-btn');

// Tab wissel
function setTab(tab) {
    currentTab = tab;
    document.getElementById('tab-simple').classList.toggle('active', tab === 'simple');
    document.getElementById('tab-custom').classList.toggle('active', tab === 'custom');
    // Simple = instrumentaal, Custom = vocals
    instrumentalToggle.checked = (tab === 'simple');
    isInstrumental = (tab === 'simple');
    promptInput.value = '';
    tags = [];
    renderTags();
}
document.getElementById('tab-simple').onclick = () => setTab('simple');
document.getElementById('tab-custom').onclick = () => setTab('custom');

// Tags toevoegen
function renderTags() {
    tagsDiv.innerHTML = '';
    tags.forEach((tag, i) => {
        const el = document.createElement('span');
        el.className = 'ai-suno-tag';
        el.textContent = tag;
        el.onclick = () => { tags.splice(i, 1); renderTags(); };
        tagsDiv.appendChild(el);
    });
}
tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && tagInput.value.trim()) {
        tags.push(tagInput.value.trim());
        tagInput.value = '';
        renderTags();
    }
});

instrumentalToggle.onchange = () => {
    isInstrumental = instrumentalToggle.checked;
    setTab(isInstrumental ? 'simple' : 'custom');
};

// Workspace/community tab
let inCommunity = false;
communityBtn.onclick = () => {
    inCommunity = true;
    workspaceTitle.textContent = 'Community';
    communityBtn.style.display = 'none';
    backBtn.style.display = '';
    loadGallery();
};
backBtn.onclick = () => {
    inCommunity = false;
    workspaceTitle.textContent = 'My Workspace';
    communityBtn.style.display = '';
    backBtn.style.display = 'none';
    loadGallery();
};

// Inspiratie quotes/funfacts
const funfacts = [
    '🎶 Wist je dat muziek je hartslag kan synchroniseren?',
    '✨ Muziek is de enige taal die iedereen begrijpt.',
    '🎧 Je brein maakt dopamine aan bij je favoriete liedje!',
    '🧠 Muziek luisteren verbetert je geheugen.',
    '🌟 “Where words fail, music speaks.”',
    '🎹 Elke AI-track is uniek, net als jij!',
    '🎤 Zingen maakt gelukkig, zelfs als niemand luistert.',
    '🎸 Muziek is de soundtrack van het leven.',
    '🥁 Ritme zit in je DNA!',
    '🎵 Muziek verbindt mensen wereldwijd.'
];
function showRandomFunfact() {
    const el = document.getElementById('ai-funfact');
    if (el) {
        const idx = Math.floor(Math.random() * funfacts.length);
        el.textContent = funfacts[idx];
    }
}

// AI genereren
async function generateAI() {
    if (loading) return;
    const token = localStorage.getItem('musicmedia_token');
    if (!token) {
        alert('Log eerst in!');
        window.location.href = 'login.html';
        return;
    }
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('Beschrijf je muziek!');
        return;
    }
    loading = true;
    feedbackDiv.style.display = '';
    feedbackText.textContent = 'Bezig met maken van audio...';
    spinner.classList.add('spin');
    generateBtn.disabled = true;
    showRandomFunfact();
    // Opbouw payload
    let payload = { type: isInstrumental ? 'instrumental' : 'vocals' };
    if (isInstrumental) {
        payload.genre = tags.join(' ');
        payload.sfeer = '';
        payload.instrumenten = '';
    } else {
        payload.lyrics = prompt;
        payload.voice = tags[0] || '';
    }
    payload.start = 0; payload.end = 10;
    try {
        const res = await fetch(window.config.apiUrl + '/api/aigenerate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.track) {
            feedbackText.textContent = 'Muziek gegenereerd!';
            setTimeout(() => { feedbackDiv.style.display = 'none'; loading = false; generateBtn.disabled = false; }, 1200);
            loadGallery();
        } else {
            feedbackText.textContent = data.error || 'AI-generatie mislukt.';
            setTimeout(() => { feedbackDiv.style.display = 'none'; loading = false; generateBtn.disabled = false; }, 1800);
        }
    } catch (err) {
        feedbackText.textContent = 'Fout bij genereren: ' + err.message;
        setTimeout(() => { feedbackDiv.style.display = 'none'; loading = false; generateBtn.disabled = false; }, 1800);
    }
}
generateBtn.onclick = generateAI;

// Gallery laden
async function loadGallery() {
    const token = localStorage.getItem('musicmedia_token');
    galleryDiv.innerHTML = '<div class="ai-suno-gallery-loading">Laden...</div>';
    try {
        const res = await fetch(window.config.apiUrl + '/api/music', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Geen tracks');
        let tracks = data.filter(t => t.artist && t.artist.includes('AI'));
        if (inCommunity) {
            // Toon tracks van andere users (mock: alles behalve userId = localStorage.user_id)
            const myId = localStorage.user_id;
            tracks = tracks.filter(t => t.userId !== myId);
        } else {
            // Alleen eigen tracks (mock: alles met userId = localStorage.user_id)
            const myId = localStorage.user_id;
            tracks = tracks.filter(t => t.userId === myId || !t.userId);
        }
        if (tracks.length === 0) {
            galleryDiv.innerHTML = '<div class="ai-suno-gallery-empty">Nog geen AI-tracks gevonden.</div>';
            return;
        }
        galleryDiv.innerHTML = tracks.reverse().map(track => `
            <div class="ai-suno-track-card">
                <div class="ai-suno-track-title">${track.title || 'AI Track'}</div>
                <div class="ai-suno-track-meta">${track.type} &bull; ${new Date(track.created).toLocaleString()}</div>
                <audio controls src="../backend/uploads/${track.filename}"></audio>
            </div>
        `).join('');
    } catch (err) {
        galleryDiv.innerHTML = '<div class="ai-suno-gallery-error">Fout bij laden gallery: ' + err.message + '</div>';
    }
}

// Init
setTab('simple');
loadGallery();
