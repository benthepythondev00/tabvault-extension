# TabVault - Tab Session Manager for Chrome

Never lose your tabs again. Save, restore, and organize browser sessions with automatic backups and full tab group support.

## Features

### Free Tier
- Save up to 5 sessions
- Full tab group support
- Search across sessions
- Export/Import data backup
- Light/Dark theme

### Pro Tier ($2.99/mo or $29 lifetime)
- Unlimited sessions
- Workspaces for organization
- Automatic cloud backup
- Session history with undo
- Priority support

## Why TabVault?

TabVault was built to solve the most frustrating problems with existing tab managers:

- **Never Lose Data**: Automatic backups before every restore or delete operation
- **Tab Groups First Class**: Full Chrome tab groups support - save and restore group colors, names, and collapsed state
- **Reliable Restore**: Sessions are verified and backed up before any modifications
- **Clear UI**: Simple, intuitive interface with instant value
- **Export Safeguard**: Easy JSON export of all your data

## Development

### Prerequisites
- Node.js 18+
- pnpm

### Setup
```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Run E2E tests (requires build first)
pnpm build && pnpm test:e2e
```

### Project Structure
```
tabvault-extension/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts      # Service worker
│   │   ├── extpay-content.ts  # Payment callback handler
│   │   └── popup/             # Main popup UI
│   ├── components/            # React components
│   ├── lib/                   # Storage, payment utilities
│   ├── types/                 # TypeScript definitions
│   └── test/                  # Test setup and mocks
├── e2e/                       # Playwright E2E tests
├── public/                    # Static assets (icons)
└── docs/                      # Privacy policy for GitHub Pages
```

### Tech Stack
- **WXT** - Chrome extension framework
- **React 19** - UI
- **Tailwind CSS v4** - Styling
- **TypeScript** - Type safety
- **ExtensionPay** - Payment processing
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Chrome Web Store

[Install TabVault](https://chrome.google.com/webstore/detail/tabvault)

## Privacy Policy

TabVault stores all data locally in your browser. We do not collect, transmit, or store any personal data on external servers.

See [Privacy Policy](./PRIVACY_POLICY.md) for details.

## License

MIT
