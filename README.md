# Simple Web Frame

A basic digital signage system designed for controlling and displaying web content across multiple screens on a local network. Perfect for artists wanting to showcase digital art on TVs, monitors, and other computers throughout a home or studio space.

## Overview

Simple Web Frame allows you to:

- Create and manage multiple display sessions from a central admin panel
- Control web content displayed on any connected screen
- Update content URLs remotely in real-time
- Maintain a basic auto-suggest history of previously displayed content

This system is designed for use within local networks and insecure contexts—it's perfect for home environments but not recommended for public-facing or production deployments without additional security measures.

## ⚠️ Security Note

This project is designed for use within trusted local networks. It lacks authentication, encryption, and other security measures needed for public deployment. Use at your own risk in public-facing environments.

## TODO

- [ ] Add persistence with a database
- [ ] Add authentication for admin panel
- [ ] Investigate electron or other client frames
- [ ] Add scheduling or interval-based content updates

## 🚀 Getting Started

### Prerequisites

- Node.js 
  - latest LTS version recommended
  - tested with v20.17.0
- npm or yarn

### Installation

1. Clone this repository
```sh
git clone https://github.com/chrsmlls333/simple-web-frame.git
cd simple-web-frame
```

2. Install dependencies
```sh
npm install
```

3. Start the development server
```sh
npm run dev
```

This will start a local server at `localhost:4321`

### Usage

1. **Admin Dashboard**: Navigate to `/admin` to access the control panel.
2. **Display Clients**: Open root page `/` in another tab or on any local device you want to use as a display.
3. **Remote Control**: Update the content shown on any display by changing the iframe URL in the admin panel.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run devhost`         | Starts local server accessible on local network  |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 🧪 Accessing from other devices

To access the server from other devices on your local network, use the `devhost` command:

```sh
npm run devhost
```

This will make the server available at your local IP address (e.g., `http://192.168.1.100:4321`).

## 📂 Project Structure

```text
/
├── public/
│   └── ~~favicon.svg~~
├── src/
│   ├── actions/
│   │   └── index.ts        # Server actions for session management
│   ├── components/
│   │   ├── admin/          # Admin UI components
│   │   └── session/        # Display session components
│   ├── layouts/
│   │   └── Layout.astro    # Base page layout
│   ├── lib/                # Shared utilities and stores
│   ├── pages/
│   │   ├── admin/          # Admin interface
│   │   └── index.astro     # Display client
│   └── styles/
└── package.json
```

## 🛠️ Built With

- [Astro](https://astro.build/) - Web framework
- [Nanostores](https://github.com/nanostores/nanostores) - State management
- [React](https://reactjs.org/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Motion](https://motion.dev/) - Animations
