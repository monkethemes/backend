# monkethemes-backend

The backend system for Monkethemes, handling user authentication, theme sharing, and theme preview generation.

## Description

This is the backend for the Monkethemes project. It's built with Node.js and Express.js, and it interacts with a MongoDB database through the Mongoose ORM. It handles Discord OAuth2 login, processes MonkeyType theme links to generate previews, and manages theme sharing APIs.

## Features

- Discord OAuth2 Login
- Theme Link Processing
- Preview Generation
- Theme Sharing APIs

## Dependencies

- `@resvg/resvg-js` - To generate SVG previews.
- `axios` - For sending HTTP requests.
- `bad-words` - To filter out inappropriate content.
- `connect-mongo` - For MongoDB session storage.
- `cors` - To handle CORS.
- `dotenv` - To handle environment variables.
- `express` and `express-session` - For setting up the server and handling sessions.
- `meilisearch` - To handle search functionality.
- `moment` - For date and time formatting.
- `mongoose` - To interact with MongoDB.
- `node-cron` - To schedule tasks.
- `node-fetch` - For making HTTP calls.
- `passport` and `passport-discord` - For handling Discord OAuth2 authentication.
- `sharp` - For handling image processing.

## Contributing

All contributions are welcome. Feel free to submit a pull request or open an issue.
