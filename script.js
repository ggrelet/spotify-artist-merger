import config from './config.js';

let userAccessToken = null;
let debounceTimer;
let selectedArtists = new Map(); // Store selected artists using Map to prevent duplicates
let userId; // Store the user ID

const REQUIRED_ARTISTS = 3;
const TRACKS_PER_ARTIST = 2;

// Initialize UI elements
const searchButton = document.getElementById('search-button');
const artistSearch = document.getElementById('artist-search');
const resultsDiv = document.getElementById('results');
const selectedList = document.getElementById('selected-list');
const autocompleteList = document.getElementById('autocomplete-list');
const mergeButton = document.getElementById('merge-button');
const mergeStatus = document.getElementById('merge-status');
const loginButton = document.getElementById('login-button');
const overlayLoginButton = document.getElementById('overlay-login-button');
const loginOverlay = document.getElementById('login-overlay');
const profilePicture = document.getElementById('profile-picture');
const usernameElement = document.getElementById('username');
const playlistWidget = document.getElementById('playlist-widget');
const mergeButtonContainer = document.querySelector('.merge-button-container');

// Spotify authentication
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

loginButton.addEventListener('click', async () => {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);
    
    // Store the code verifier in localStorage
    localStorage.setItem('code_verifier', codeVerifier);
    
    const scope = 'user-read-private playlist-modify-public playlist-modify-private';
    const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope: scope,
    });
    
    window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
});

overlayLoginButton.addEventListener('click', () => {
    loginButton.click(); // Reuse the main login button's click handler
});

function updateAuthUI() {
    const mainContent = document.querySelector('.main-content');
    const mergeContainer = document.querySelector('.merge-button-container');
    
    if (userAccessToken) {
        loginButton.style.display = 'none';
        profilePicture.classList.remove('hidden');
        loginOverlay.classList.add('hidden');
        mainContent.classList.remove('needs-auth');
        mergeContainer.classList.remove('needs-auth');
    } else {
        loginButton.style.display = 'block';
        profilePicture.classList.add('hidden');
        mainContent.classList.add('needs-auth');
        mergeContainer.classList.add('needs-auth');
        // Show login overlay when trying to interact with the app
        loginOverlay.classList.remove('hidden');
    }
}

// Check for authentication callback
async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        const codeVerifier = localStorage.getItem('code_verifier');
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: config.clientId,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: config.redirectUri,
                code_verifier: codeVerifier,
            }),
        });
        
        const data = await response.json();
        userAccessToken = data.access_token;
        localStorage.removeItem('code_verifier');
        
        // Remove code from URL
        window.history.replaceState({}, document.title, '/');
        
        // Update UI
        updateAuthUI();
        
        // Fetch and display user profile
        await updateUserProfile();
    }
}

async function updateUserProfile() {
    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${userAccessToken}`
            }
        });
        const data = await response.json();
        
        // Update profile picture
        if (data.images && data.images.length > 0) {
            profilePicture.src = data.images[0].url;
        }
        
        // Update username
        if (data.display_name) {
            usernameElement.textContent = `Logged in as ${data.display_name}`;
            usernameElement.classList.remove('hidden');
        }
        
        profilePicture.classList.remove('hidden');
        loginButton.classList.add('hidden');
        
        // Store user ID for playlist creation
        userId = data.id;
        
        document.querySelector('.main-content').classList.remove('needs-auth');
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}

async function searchArtists(query) {
    try {
        if (!userAccessToken) {
            loginOverlay.classList.remove('hidden');
            throw new Error('Login required');
        }
        
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`, {
            headers: {
                'Authorization': `Bearer ${userAccessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error searching artists:', error);
        throw error;
    }
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('');
}

function createArtistCard(artist, isSelected = false) {
    const artistDiv = document.createElement('div');
    artistDiv.className = 'artist-card';
    
    const imageUrl = artist.images[0]?.url || null;
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'artist-info';
    
    // Create clickable artist name and image
    const artistLink = document.createElement('a');
    artistLink.href = artist.external_urls.spotify;
    artistLink.target = '_blank';
    artistLink.className = 'artist-link';
    artistLink.innerHTML = `
        <h3>${artist.name}</h3>
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFEQjk1NCI+PHBhdGggZD0iTTYuNzUgMTJhLjc1Ljc1IDAgMDEtLjc1LS43NVY0LjVhLjc1Ljc1IDAgMDExLjUtMHY2Ljc1YS43NS43NSAwIDAxLS43NS43NXptMy43NSAwaC0xLjVWNC41YS43NS43NSAwIDAxMS41IDB2Ny41em0zLjc1IDBIOTVWNi43NWEuNzUuNzUgMCAwMTEuNSAwdjUuMjV6bTMuNzUgMGgtMS41VjMuNzVhLjc1Ljc1IDAgMDExLjUgMHY4LjI1eiIvPjwvc3ZnPg==" alt="Open in Spotify">
    `;
    
    const followersText = document.createElement('p');
    followersText.textContent = `${artist.followers.total.toLocaleString()} followers`;
    
    const genresContainer = document.createElement('div');
    genresContainer.className = 'genres';
    if (artist.genres.length) {
        artist.genres.forEach(genre => {
            const genrePill = document.createElement('span');
            genrePill.className = 'genre';
            genrePill.textContent = genre;
            genresContainer.appendChild(genrePill);
        });
    }
    
    const imgLink = document.createElement('a');
    imgLink.href = artist.external_urls.spotify;
    imgLink.target = '_blank';

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = artist.name;
        imgLink.appendChild(img);
    } else {
        const initialsDiv = document.createElement('div');
        initialsDiv.className = 'initial-avatar';
        initialsDiv.textContent = getInitials(artist.name);
        imgLink.appendChild(initialsDiv);
    }
    
    const button = document.createElement('button');
    if (!isSelected) {
        button.textContent = 'Add';
        button.onclick = () => addToSelected(artist);
    } else {
        button.textContent = 'Remove';
        button.onclick = () => removeFromSelected(artist.id);
    }
    
    infoDiv.appendChild(artistLink);
    infoDiv.appendChild(followersText);
    infoDiv.appendChild(genresContainer);
    
    artistDiv.appendChild(imgLink);
    artistDiv.appendChild(infoDiv);
    artistDiv.appendChild(button);
    
    return artistDiv;
}

function addToSelected(artist) {
    if (!selectedArtists.has(artist.id)) {
        selectedArtists.set(artist.id, artist);
        updateSelectedList();
        updateMergeButton();
    }
}

function removeFromSelected(artistId) {
    if (selectedArtists.delete(artistId)) {
        updateSelectedList();
        updateMergeButton();
    }
}

function updateSelectedList() {
    selectedList.innerHTML = '';
    selectedArtists.forEach(artist => {
        selectedList.appendChild(createArtistCard(artist, true));
    });
}

function displayArtistResults(artists) {
    resultsDiv.innerHTML = '';
    if (artists && artists.length > 0) {
        artists.forEach(artist => {
            resultsDiv.appendChild(createArtistCard(artist));
        });
    } else {
        resultsDiv.innerHTML = '<p>No artists found</p>';
    }
}

function showAutocomplete(artists) {
    autocompleteList.innerHTML = '';
    if (!artists || !artists.items || artists.items.length === 0) {
        autocompleteList.style.display = 'none';
        return;
    }

    artists.items.forEach(artist => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        
        const artistInfo = document.createElement('div');
        artistInfo.className = 'artist-info';
        
        const imageUrl = artist.images[0]?.url || 'placeholder-image-url';
        artistInfo.innerHTML = `
            <img src="${imageUrl}" alt="${artist.name}" onerror="this.src='placeholder-image-url'">
            <span>${artist.name}</span>
        `;
        
        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.onclick = (e) => {
            e.stopPropagation(); // Prevent the autocomplete item click
            addToSelected(artist);
            autocompleteList.style.display = 'none';
        };
        
        div.appendChild(artistInfo);
        div.appendChild(addButton);
        
        // Still keep the click on the whole item to show in search results
        div.addEventListener('click', () => {
            artistSearch.value = artist.name;
            displayArtistResults([artist]);
            autocompleteList.style.display = 'none';
        });
        
        autocompleteList.appendChild(div);
    });
    
    autocompleteList.style.display = 'block';
}

// Handle input changes with debouncing
artistSearch.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        autocompleteList.style.display = 'none';
        return;
    }
    
    debounceTimer = setTimeout(async () => {
        const data = await searchArtists(query);
        showAutocomplete(data.artists);
    }, 300);
});

// Hide autocomplete when clicking outside
document.addEventListener('click', (e) => {
    if (!autocompleteList.contains(e.target) && e.target !== artistSearch) {
        autocompleteList.style.display = 'none';
    }
});

// Search button click handler
searchButton.addEventListener('click', async () => {
    if (!userAccessToken) {
        loginOverlay.classList.remove('hidden');
        return;
    }
    
    const artistName = artistSearch.value.trim();
    if (artistName) {
        try {
            resultsDiv.innerHTML = '<p>Searching...</p>';
            const data = await searchArtists(artistName);
            displayArtistResults(data.artists.items);
            autocompleteList.style.display = 'none';
        } catch (error) {
            console.error('Error:', error);
            resultsDiv.innerHTML = '<p>Error searching for artists. Please try again.</p>';
        }
    }
});

artistSearch.addEventListener('focus', () => {
    if (!userAccessToken) {
        loginOverlay.classList.remove('hidden');
        artistSearch.blur(); // Remove focus from input
    }
});

function updateMergeButton() {
    const selectedCount = selectedArtists.size;
    if (selectedCount >= 3) {
        mergeButton.classList.add('visible');
        mergeStatus.textContent = `${selectedCount} artists selected`;
        if (!userAccessToken) {
            loginOverlay.classList.remove('hidden');
        }
    } else {
        mergeButton.classList.remove('visible');
        mergeStatus.textContent = 'Select at least 3 artists';
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function createMergedPlaylist() {
    try {
        console.log('Starting playlist creation...');
        // Get top tracks for each artist
        const trackPromises = Array.from(selectedArtists.values()).map(artist => getTopTracks(artist.id));
        const tracksArrays = await Promise.all(trackPromises);
        
        // Flatten and get track URIs
        const trackUris = shuffleArray(
            tracksArrays
                .flat()
                .filter(track => track && track.uri)
                .map(track => track.uri)
        );
        
        console.log('Track URIs:', trackUris);
        
        if (!trackUris.length) {
            throw new Error('No valid tracks found for the selected artists');
        }

        // Create playlist name
        const artistNames = Array.from(selectedArtists.values())
            .map(artist => artist.name);
        const playlistName = 'MergedMix: ' + 
            (artistNames.length > 3 
                ? artistNames.slice(0, 3).join(', ') + ' and more...'
                : artistNames.join(', '));

        console.log('Creating playlist:', playlistName);
        
        // Create playlist and add tracks
        const playlist = await createPlaylist(playlistName, trackUris);
        
        // Display the playlist widget
        displayPlaylistWidget(playlist.id);
        
        return playlist;
    } catch (error) {
        console.error('Error in createMergedPlaylist:', error);
        throw error;
    }
}

async function getTopTracks(artistId) {
    try {
        console.log('Fetching top tracks for artist:', artistId);
        const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
            headers: {
                'Authorization': `Bearer ${userAccessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch top tracks');
        }

        const data = await response.json();
        console.log('Got tracks for artist:', artistId, data.tracks.slice(0, 2));
        return data.tracks.slice(0, 2); // Get top 2 tracks
    } catch (error) {
        console.error('Error getting top tracks:', error);
        throw error;
    }
}

async function createPlaylist(name, trackUris) {
    try {
        // Create the playlist
        const createResponse = await fetch('https://api.spotify.com/v1/me/playlists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: 'Created with Spotify Artist Merger',
                public: true
            })
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            console.error('Playlist creation error:', errorData);
            throw new Error(`Failed to create playlist: ${errorData.error?.message || 'Unknown error'}`);
        }

        const playlist = await createResponse.json();

        // Add tracks to the playlist
        const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: trackUris
            })
        });

        if (!addTracksResponse.ok) {
            const errorData = await addTracksResponse.json();
            console.error('Add tracks error:', errorData);
            throw new Error(`Failed to add tracks: ${errorData.error?.message || 'Unknown error'}`);
        }

        return playlist;
    } catch (error) {
        console.error('Error in createPlaylist:', error);
        throw error;
    }
}

function displayPlaylistWidget(playlistId) {
    playlistWidget.innerHTML = `
        <iframe
            src="https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator"
            frameBorder="0"
            allowfullscreen=""
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy">
        </iframe>
    `;
    playlistWidget.classList.remove('hidden');
}

// Merge button click handler
mergeButton.addEventListener('click', async () => {
    if (!userAccessToken) {
        loginOverlay.classList.remove('hidden');
        return;
    }
    
    if (selectedArtists.size < 3) {
        return;
    }
    
    try {
        mergeStatus.textContent = 'Creating playlist...';
        await createMergedPlaylist();
        mergeStatus.textContent = 'Playlist created successfully!';
        setTimeout(() => {
            if (selectedArtists.size >= 3) {
                updateMergeButton();
            }
        }, 3000);
    } catch (error) {
        console.error('Error:', error);
        mergeStatus.textContent = 'Error creating playlist. Please try again.';
    }
});

// Close overlay when clicking outside the message box
loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) {
        loginOverlay.classList.add('hidden');
    }
});

// Handle the callback when the page loads
handleCallback();
updateAuthUI();
