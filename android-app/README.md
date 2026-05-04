# Rebel AI — Android Application

A fully advanced Android application with ChatGPT-like features, voice assistant, and beautiful dark UI.

## Features

- **Chat with Rebel GPT** — Full ChatGPT-like experience with conversation history
- **Voice Assistant** — Speech recognition + ElevenLabs TTS + "Hey Rebel" wake word
- **Image Vision** — Upload images for AI analysis  
- **Markdown Rendering** — Rich text, code blocks with syntax highlighting
- **User Auth** — Register, Login, OTP verification via EmailJS
- **Offline History** — Chat history stored locally via Room database
- **Beautiful UI** — Dark glassmorphism design with purple/teal gradient theme

## Tech Stack

- **Language**: Kotlin
- **UI**: XML + Material Design 3
- **AI**: api-rebix.vercel.app (GPT-5)
- **TTS**: ElevenLabs API + Android TTS fallback
- **STT**: Android SpeechRecognizer
- **Database**: Room (SQLite)
- **Networking**: Retrofit + OkHttp
- **Image Loading**: Coil
- **Markdown**: Markwon

## Building the APK

### Prerequisites
- Android Studio Hedgehog (2023.1.1+)
- JDK 17
- Android SDK 34

### Steps

```bash
# Clone repo and navigate to android-app folder
cd android-app

# Build debug APK
./gradlew assembleDebug

# Build release APK  
./gradlew assembleRelease
```

### Release signing

Create `keystore.properties` in the android-app root:

```
storeFile=path/to/your.keystore
storePassword=yourStorePassword
keyAlias=yourKeyAlias
keyPassword=yourKeyPassword
```

Then update `app/build.gradle` signingConfigs section.

## Configuration

Edit `app/src/main/java/com/rebelai/app/data/network/NetworkModule.kt`:
- `BASE_URL` — AI API base URL

Edit `VoiceActivity.kt`:
- `elevenKeys` — Add your ElevenLabs API keys
- `elevenVoiceId` — Your preferred voice ID

## APK Size

Expected release APK size: **80-120 MB** (includes:)
- Kotlin runtime: ~10MB
- Compose libraries: ~15MB  
- Markwon + syntax highlight: ~5MB
- Lottie animations: ~2MB
- OkHttp + Retrofit: ~3MB
- Coil image loader: ~2MB
- Room database: ~2MB

## Credits

Created by **Rebel Bhaiya** (Ujjwal Tiwari)  
Security Expert · OSINT · AI Architect · Web Dev
