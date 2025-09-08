// README.md
# Clair Obscur: Expedition 33 Campaign Management System

A real-time web application for managing D&D 5e sessions based on the "Clair Obscur: Expedition 33" video game. Players use their phones for character sheets while a shared TV displays the battle map, all synchronized in real-time via Firebase.

## Features

### Character Management
- Real-time HP tracking with +/- buttons
- Maelle's unique stance system (Offensive/Defensive/Agile)
- Character-specific charge systems (Overload, Stains, Foretell)
- Ability buttons for quick combat actions
- Mobile-optimized interface

### Battle Map System
- Grid-based battle map display for TV
- Real-time token positioning
- Drag-and-drop token movement
- GM controls for enemies and session management
- Responsive scaling for different screen sizes

### Real-time Synchronization
- All changes sync instantly across devices
- Firebase Firestore for persistence
- Real-time listeners for live updates

## Quick Start

### 1. Installation
```bash
git clone [repository]
cd clair-obscur-campaign/client
npm install
```

### 2. Firebase Setup
1. Create a new Firebase project
2. Enable Firestore Database
3. Enable Authentication (Anonymous)
4. Copy your Firebase config
5. Create `.env` file based on `.env.example`

### 3. Development
```bash
npm start
```
Navigate to `http://localhost:3000`

### 4. Usage
1. Each player opens their character sheet: `/player/{characterId}`
2. Open battle map on TV: `/battle-map/test-session`  
3. GM uses controls: `/gm/test-session`

## Project Structure

```
src/
├── components/
│   ├── CharacterSheet/     # Character sheet components
│   ├── BattleMap/          # Battle map and token components  
│   └── shared/             # Shared UI components
├── hooks/                  # Custom React hooks
├── pages/                  # Main page components
├── services/               # Firebase and external services
├── types/                  # TypeScript type definitions
└── utils/                  # Helper functions and constants
```

## Characters

### Maelle - The Stance Fencer
- **Stats:** STR 12, DEX 16, CON 13, INT 10, WIS 11, CHA 14
- **Unique:** Combat stances (Offensive/Defensive/Agile)
- **Abilities:** Fencer's Slash, Flourish Chain, Dazzling Feint

### Gustave - The Engineer  
- **Stats:** STR 16, DEX 12, CON 15, INT 14, WIS 11, CHA 10
- **Unique:** Overload Charges, protective abilities
- **Abilities:** Sword Slash, Prosthetic Strike, Deploy Turret

### Lune - The Elemental Scholar
- **Stats:** STR 10, DEX 12, CON 13, INT 16, WIS 14, CHA 11  
- **Unique:** Elemental Stains system
- **Abilities:** Elemental Bolt, Elemental Strike, Twin Catalyst

### Sciel - The Tarot Warrior
- **Stats:** STR 13, DEX 14, CON 12, INT 11, WIS 15, CHA 16
- **Unique:** Foretell Stacks with tarot cards
- **Abilities:** Card Toss, Guiding Cards, Moonlit Ward

## Deployment

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel
```

### Firebase Hosting
```bash
npm run build
firebase deploy
```

## Development Timeline

- **Friday Evening (3 hours):** Character sheets
- **Saturday Morning (4 hours):** Battle map system  
- **Saturday Afternoon (4 hours):** Integration & real-time sync
- **Sunday Morning (1 hour):** Testing & deployment

## Contributing

This project is built for a specific D&D campaign but can be adapted for other systems. Key areas for expansion:

- Additional character mechanics
- More battle map features  
- Campaign management tools
- Audio/visual enhancements

## License

MIT License - Built for personal campaign use.