const config = {
    // Replace this with your actual Spotify client ID from your Developer Dashboard
    clientId: '5e0f1ff23de74077a960655124f89fa1',
    redirectUri: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000/'
        : 'https://ggrelet.github.io/spotify-artist-merger/',
};

export default config;
