const config = {
    clientId: '4881b7c5d0d04ef2b5d6d5f4b3e5b7d6',
    redirectUri: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000/'
        : 'https://ggrelet.github.io/spotify-artist-merger/',
};

export default config;
