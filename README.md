# Spotify Artist Merger

A web application that lets you create playlists by merging top tracks from your favorite artists.

## Features
- Search for artists on Spotify
- Select multiple artists (minimum 3)
- Create a playlist with top tracks from selected artists
- Tracks are automatically shuffled for variety
- Secure authentication with Spotify OAuth

## Development Setup

1. Make sure you have Node.js installed
2. Clone this repository:
   ```bash
   git clone https://github.com/ggrelet/spotify-artist-merger.git
   cd spotify-artist-merger
   ```
3. Start the development server:
   ```bash
   node server.js
   ```
4. Open http://localhost:8000 in your browser

## Production

The application is deployed on GitHub Pages and can be accessed at:
https://ggrelet.github.io/spotify-artist-merger/

## Spotify Configuration

If you want to run your own instance of this app:

1. Create a Spotify Application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add these Redirect URIs in your Spotify App settings:
   - http://localhost:8000/ (for development)
   - https://[your-username].github.io/spotify-artist-merger/ (for production)
3. Update the `clientId` in `config.js` with your Spotify App's client ID

## Technologies
- HTML, CSS, JavaScript
- Spotify Web API
- OAuth 2.0 PKCE Flow
