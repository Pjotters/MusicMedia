const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = 'musicmedia_super_secret_key'; // Voor demo, later .env maken

// Storage for uploads
const upload = multer({
    dest: path.join(__dirname, 'uploads'),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'audio/mp3' || file.mimetype === 'audio/wav' || file.mimetype === 'audio/mpeg') {
            cb(null, true);
        } else {
            cb(new Error('Alleen mp3 en wav toegestaan!'));
        }
    }
});

// Helper to read/write JSON
function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, file)));
    } catch {
        return [];
    }
}
function writeJSON(file, data) {
    fs.writeFileSync(path.join(__dirname, file), JSON.stringify(data, null, 2));
}

// Helper: gebruikersnaam/email validatie
function validUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
function validEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
function validPassword(password) {
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// Auth middleware
function auth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen token' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Ongeldige token' });
    }
}

// REGISTRATIE
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!validUsername(username)) return res.status(400).json({ error: 'Ongeldige gebruikersnaam' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' });
    if (!validPassword(password)) return res.status(400).json({ error: 'Wachtwoord te zwak' });
    const users = readJSON('users.json');
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Gebruikersnaam bestaat al' });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'E-mail bestaat al' });
    const hash = bcrypt.hashSync(password, 10);
    const newUser = {
        id: Date.now(),
        username,
        email,
        password: hash,
        role: 'user',
        profile: { bio: '', avatar: '' },
        subscription: 'free',
        created: new Date().toISOString()
    };
    users.push(newUser);
    writeJSON('users.json', users);
    res.json({ success: true });
});

// LOGIN
app.post('/api/login', (req, res) => {
    const { usernameOrEmail, password } = req.body;
    const users = readJSON('users.json');
    const user = users.find(u => u.username === usernameOrEmail || u.email === usernameOrEmail);
    if (!user) return res.status(400).json({ error: 'Gebruiker niet gevonden' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Wachtwoord onjuist' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
});

// PROFIEL OPHALEN/UPDATEN
app.get('/api/profile', auth, (req, res) => {
    const users = readJSON('users.json');
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Niet gevonden' });
    res.json({ username: user.username, email: user.email, profile: user.profile, subscription: user.subscription });
});
app.post('/api/profile/update', auth, (req, res) => {
    const { username, email, bio, avatar } = req.body;
    const users = readJSON('users.json');
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Niet gevonden' });
    if (username && validUsername(username)) user.username = username;
    if (email && validEmail(email)) user.email = email;
    if (bio !== undefined) user.profile.bio = bio;
    if (avatar !== undefined) user.profile.avatar = avatar;
    writeJSON('users.json', users);
    res.json({ success: true });
});

// ABONNEMENT KIEZEN
app.post('/api/subscription', auth, (req, res) => {
    const { plan } = req.body; // 'free', 'basic', 'premium'
    if (![ 'free', 'basic', 'premium' ].includes(plan)) return res.status(400).json({ error: 'Ongeldig plan' });
    const users = readJSON('users.json');
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Niet gevonden' });
    user.subscription = plan;
    writeJSON('users.json', users);
    res.json({ success: true });
});

// MOCK BETALING
app.post('/api/payment/mock', auth, (req, res) => {
    // Simuleer "betaling"
    res.json({ success: true, message: 'Betaling gesimuleerd!' });
});

// PLAYLISTS CRUD
app.get('/api/playlists', (req, res) => {
    res.json(readJSON('playlists.json'));
});
app.post('/api/playlists', auth, (req, res) => {
    const { name, tracks } = req.body;
    const playlists = readJSON('playlists.json');
    const newPlaylist = {
        id: Date.now(),
        name,
        userId: req.user.id,
        tracks: tracks || [],
        created: new Date().toISOString(),
        public: true
    };
    playlists.push(newPlaylist);
    writeJSON('playlists.json', playlists);
    res.json({ success: true, playlist: newPlaylist });
});
app.post('/api/playlists/:playlistId/add', auth, (req, res) => {
    const { trackId } = req.body;
    const playlists = readJSON('playlists.json');
    const music = readJSON('music.json');
    const playlist = playlists.find(p => p.id == req.params.playlistId && p.userId === req.user.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist niet gevonden' });
    if (!music.find(m => m.id == trackId)) return res.status(404).json({ error: 'Track niet gevonden' });
    if (!playlist.tracks.includes(trackId)) playlist.tracks.push(trackId);
    writeJSON('playlists.json', playlists);
    res.json({ success: true, playlist });
});
app.post('/api/playlists/:playlistId/remove', auth, (req, res) => {
    const { trackId } = req.body;
    const playlists = readJSON('playlists.json');
    const playlist = playlists.find(p => p.id == req.params.playlistId && p.userId === req.user.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist niet gevonden' });
    playlist.tracks = playlist.tracks.filter(id => id != trackId);
    writeJSON('playlists.json', playlists);
    res.json({ success: true, playlist });
});

// ALBUMS CRUD
app.get('/api/albums', (req, res) => {
    res.json(readJSON('albums.json'));
});
app.post('/api/albums', auth, (req, res) => {
    const { name, tracks } = req.body;
    const albums = readJSON('albums.json');
    const newAlbum = {
        id: Date.now(),
        name,
        userId: req.user.id,
        tracks: tracks || [],
        created: new Date().toISOString(),
        public: true
    };
    albums.push(newAlbum);
    writeJSON('albums.json', albums);
    res.json({ success: true, album: newAlbum });
});
app.post('/api/albums/:albumId/add', auth, (req, res) => {
    const { trackId } = req.body;
    const albums = readJSON('albums.json');
    const music = readJSON('music.json');
    const album = albums.find(a => a.id == req.params.albumId && a.userId === req.user.id);
    if (!album) return res.status(404).json({ error: 'Album niet gevonden' });
    if (!music.find(m => m.id == trackId)) return res.status(404).json({ error: 'Track niet gevonden' });
    if (!album.tracks.includes(trackId)) album.tracks.push(trackId);
    writeJSON('albums.json', albums);
    res.json({ success: true, album });
});
app.post('/api/albums/:albumId/remove', auth, (req, res) => {
    const { trackId } = req.body;
    const albums = readJSON('albums.json');
    const album = albums.find(a => a.id == req.params.albumId && a.userId === req.user.id);
    if (!album) return res.status(404).json({ error: 'Album niet gevonden' });
    album.tracks = album.tracks.filter(id => id != trackId);
    writeJSON('albums.json', albums);
    res.json({ success: true, album });
});

// ADMIN: nummers reviewen
app.get('/api/admin/review', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Geen toegang' });
    const music = readJSON('music.json');
    const flagged = music.filter(m => m.status === 'flagged' || m.status === 'error');
    res.json(flagged);
});
app.post('/api/admin/review', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Geen toegang' });
    const { trackId, action } = req.body; // action: 'approve', 'reject', 'explicit'
    const music = readJSON('music.json');
    const track = music.find(m => m.id === trackId);
    if (!track) return res.status(404).json({ error: 'Niet gevonden' });
    if (action === 'approve') track.status = 'approved';
    else if (action === 'reject') track.status = 'unpublished';
    else if (action === 'explicit') track.explicit = true;
    writeJSON('music.json', music);
    res.json({ success: true });
});

// AI-CHECK endpoint (mock)
app.post('/api/aicheck', (req, res) => {
    // Simuleer AI-check (in product live AI)
    const { trackId } = req.body;
    // Random resultaat
    const result = Math.random();
    let status = 'ok';
    if (result < 0.1) status = 'error';
    else if (result < 0.3) status = 'flagged';
    else status = 'approved';
    // Update music.json
    const music = readJSON('music.json');
    const track = music.find(m => m.id === trackId);
    if (track) track.status = status;
    writeJSON('music.json', music);
    res.json({ success: true, status });
});

// ECHTE AI-MUZIEK GENERATIE VIA RIFFUSION
app.post('/api/aigenerate', auth, async (req, res) => {
    const { type, genre, sfeer, instrumenten, lyrics, voice } = req.body;
    try {
        // Bouw prompt voor Riffusion
        let prompt = '';
        if (type === 'instrumental') {
            prompt = `${genre || ''} ${sfeer || ''} ${instrumenten || ''}`.trim();
        } else {
            prompt = `vocals: ${lyrics || ''} voice: ${voice || ''}`.trim();
        }
        // Riffusion API-call (voorbeeld: /riffusion/interpolate)
        const riffusionRes = await fetch('http://127.0.0.1:7860/riffusion/interpolate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt_a: prompt, prompt_b: prompt, alpha: 0.5 })
        });
        if (!riffusionRes.ok) return res.status(500).json({ error: 'AI-generatie mislukt (riffusion)' });
        // Ontvang audio-bestand (bijvoorbeeld als wav/mp3 blob)
        const audioBuffer = await riffusionRes.buffer();
        const filename = 'ai_' + Date.now() + '.wav';
        const filePath = path.join(__dirname, 'uploads', filename);
        fs.writeFileSync(filePath, audioBuffer);
        // Voeg toe aan music.json
        const music = readJSON('music.json');
        const newTrack = {
            id: Date.now(),
            title: type === 'instrumental' ? `AI Track (${genre || 'Onbekend'})` : `AI Vocals (${lyrics?.substring(0,10) || '...'})`,
            artist: 'AI (Riffusion)',
            filename,
            originalname: 'AI Generated',
            status: 'pending',
            aiFlag: null,
            explicit: false,
            created: new Date().toISOString()
        };
        music.push(newTrack);
        writeJSON('music.json', music);
        res.json({ success: true, track: newTrack });
    } catch (err) {
        console.error('AI-generatie fout:', err);
        res.status(500).json({ error: 'AI-generatie mislukt (server)' });
    }
});

// ADMIN login (voor admin.html)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const admins = readJSON('admin.json');
    const admin = admins.find(a => a.username === username);
    if (!admin) return res.status(400).json({ error: 'Admin niet gevonden' });
    if (!bcrypt.compareSync(password, admin.password)) return res.status(400).json({ error: 'Wachtwoord onjuist' });
    const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
});

// Upload endpoint
app.post('/api/upload', upload.single('music'), (req, res) => {
    const { title, artist } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Geen bestand!' });
    const music = readJSON('music.json');
    const newTrack = {
        id: Date.now(),
        title,
        artist,
        filename: req.file.filename,
        originalname: req.file.originalname,
        status: 'pending', // voor AI check
        aiFlag: null,
        explicit: false
    };
    music.push(newTrack);
    writeJSON('music.json', music);
    res.json({ success: true, track: newTrack });
});

// Muziek ophalen (publiek)
app.get('/api/music', (req, res) => {
    const music = readJSON('music.json');
    res.json(music);
});

// Muziek streamen
app.get('/api/stream/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('Niet gevonden');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.sendFile(filePath);
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log('Backend server draait op poort', PORT);
});
