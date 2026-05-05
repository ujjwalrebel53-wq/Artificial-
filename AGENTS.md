# Rebel AI

## Cursor Cloud specific instructions

### Project overview

Rebel AI is a ChatGPT-like AI assistant with two clients:
- **Web app** (`index.html`, `main.js`, `style.css`) — a static single-page app; no build step or package manager
- **Android app** (`android-app/`) — Kotlin/Gradle project (requires Android SDK 34 + JDK 17 to build)
- **PHP backend** (`Copy of index.php`) — optional REST API with JSON-file storage; requires PHP CLI

### Running the web app

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/` in Chrome. The app works fully in localStorage mode without a backend.

If PHP CLI is available, use `php -S localhost:8000` instead for backend features (user management, analytics, admin).

### Key gotchas

- **No package manager or build step**: The web app is plain HTML/CSS/JS with CDN dependencies. There is no `package.json`, no `node_modules`, no bundler.
- **No lint/test commands**: The project has no automated test suite or linter configuration.
- **Auth bypass for testing**: The app requires email OTP verification. To bypass in dev, open the browser console and run:
  ```js
  UserSystem.register('TestUser', 'test@example.com', 'password123');
  Modal.close('authModal');
  openChatApp(UserSystem.getCurrent());
  ```
- **External API dependency**: Chat responses come from `https://api-rebix.vercel.app/api/gpt-5`. Internet access is required.
- **API keys in source**: ElevenLabs, EmailJS, and RapidAPI keys are hardcoded in `main.js` `CONFIG` object.
- **PHP backend issues in Cloud VM**: The `ucf` package dependency may be unavailable in the VM's apt repos, blocking PHP installation. Use Python HTTP server as fallback.
