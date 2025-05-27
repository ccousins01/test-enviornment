# Bodybuilding & Nutrition Coach App

This simple Node server allows a coach to upload content and grant paid members access.

## Usage

1. Run `node server.js`.
2. Visit `http://localhost:3000` and login as `coach` or `client` using the password `password`.
3. Coach accounts can upload files which are served to members under `/content`.

Uploaded files are stored in the `uploads/` directory and user data is stored in `users.json`.
