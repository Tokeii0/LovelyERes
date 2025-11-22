<div align="center">
  <img src="public/logo.png" alt="LovelyERes Logo" width="160" height="160">

  # LovelyERes
  
  **Linux Emergency Response Tool**
  
  A modern, high-performance SSH terminal and diagnostic toolkit designed for rapid server management and emergency response.

  [![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
  [![Vue](https://img.shields.io/badge/Vue.js-v3.5-4FC08D?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
  [![Rust](https://img.shields.io/badge/Rust-Backend-000000?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

  [Features](#-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Roadmap](#-roadmap)
</div>

---

## 📖 Introduction

**LovelyERes** (Lovely Emergency Response) is a specialized desktop application tailored for system administrators and DevOps engineers. Unlike standard SSH clients, LovelyERes is optimized for **emergency response scenarios**, providing a robust, secure, and interference-free environment to diagnose and fix Linux server issues.

Built on the **Tauri v2** framework, it offers a lightweight native footprint with the modern UI capabilities of **Vue 3**.

## ✨ Features

- **🔒 Secure SSH Terminal**: Native Rust-based SSH implementation (`ssh2`) combined with `xterm.js` for a high-fidelity terminal experience.
- **🛡️ Encrypted Storage**: Sensitive credentials and keys are encrypted locally using `AES-GCM`, ensuring your server access remains secure.
- **⚡ High Performance**: Backend logic written in pure Rust for minimal latency and optimal resource usage.
- **🖥️ Modern UI**: A clean, distraction-free interface built with Vue 3 and IconPark, designed for long sessions.
- **🔍 Detection Manager**: Integrated tools for rapid system diagnostics.
- **📂 Cross-Platform**: Seamless support for Windows, macOS, and Linux.

## 🛠 Tech Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| **Core** | [Tauri v2](https://tauri.app) | Framework for building tiny, fast binaries |
| **Frontend** | [Vue 3](https://vuejs.org) | Reactive UI framework |
| **Build Tool** | [Vite](https://vitejs.dev) | Next Generation Frontend Tooling |
| **Language** | [TypeScript](https://www.typescriptlang.org) | Type-safe JavaScript |
| **Backend** | [Rust](https://www.rust-lang.org) | Systems programming language for logic |
| **Terminal** | [xterm.js](https://xtermjs.org) | Full-featured terminal component |
| **Icons** | [IconPark](https://iconpark.bytedance.com) | Rich icon library |

## 📂 Project Structure

```bash
LovelyRes/
├── src/                  # Frontend Source (Vue 3)
│   ├── components/       # UI Components (SSHTerminal, etc.)
│   ├── config/           # App Configuration
│   ├── css/              # Global Styles & Themes
│   └── App.vue           # Main Entry Component
├── src-tauri/            # Backend Source (Rust)
│   ├── src/
│   │   ├── ssh/          # SSH Implementation
│   │   ├── crypto_keys.rs# Encryption Logic
│   │   └── detection_manager.rs
│   ├── capabilities/     # Tauri Permissions
│   └── tauri.conf.json   # Tauri Config
├── public/               # Static Assets (Logos, Icons)
└── doc/                  # Documentation
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Rust** (Latest Stable)
- **Visual Studio Code** (Recommended) with Rust Analyzer & Volar

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lovelyres.git
   cd lovelyres
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in Development Mode**
   This command starts the frontend dev server and the Tauri rust backend.
   ```bash
   npm run tauri dev
   ```

4. **Build for Production**
   ```bash
   npm run tauri build
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ by the LovelyRes Team</sub>
</div>
