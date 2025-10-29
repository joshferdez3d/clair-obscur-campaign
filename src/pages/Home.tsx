import React from 'react';
import { Link } from 'react-router-dom';
import { User, Monitor, Settings, Map } from 'lucide-react';

export function Home() {
  const characters = [
    { id: 'maelle', name: 'Maelle', role: 'The Stance Fencer', color: 'clair-maelle' },
    { id: 'gustave', name: 'Gustave', role: 'The Engineer', color: 'clair-gustave' },
    { id: 'lune', name: 'Lune', role: 'The Elemental Scholar', color: 'clair-lune' },
    { id: 'sciel', name: 'Sciel', role: 'The Tarot Warrior', color: 'clair-sciel' },
    { id: 'verso', name: 'Verso', role: 'The Musical Guardian', color: 'clair-verso' } // ✅ ADDED
  ];

  const getCharacterGradient = (id: string) => {
    switch (id) {
      case 'maelle':
        return 'bg-gradient-to-br from-clair-royal-500 to-clair-royal-700 hover:from-clair-royal-400 hover:to-clair-royal-600';
      case 'gustave':
        return 'bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800';
      case 'lune':
        return 'bg-gradient-to-br from-clair-mystical-700 to-clair-mystical-900 hover:from-clair-mystical-600 hover:to-clair-mystical-800';
      case 'sciel':
        return 'bg-gradient-to-br from-green-700 to-green-900 hover:from-green-600 hover:to-green-800';
      case 'verso': // ✅ ADDED
        return 'bg-gradient-to-br from-purple-600 to-pink-800 hover:from-purple-500 hover:to-pink-700';
      default:
        return 'bg-clair-gradient';
    }
  };

  return (
    <div className="min-h-screen bg-clair-shadow-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <h1 className="font-display text-6xl font-bold text-clair-gold-400 mb-4">
            Clair Obscur
          </h1>
          <p className="font-display text-2xl text-clair-gold-300 mb-2">
            Expedition 33
          </p>
          <div className="w-32 h-1 bg-clair-gold-500 mx-auto mb-6"></div>
          <p className="font-serif text-lg text-clair-gold-200">
            Campaign Management System
          </p>
          <p className="font-sans text-base text-clair-gold-300 mt-2">
            Choose your expeditioner or access GM tools
          </p>
        </div>

        {/* Character Selection */}
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold text-clair-gold-300 text-center mb-6 flex items-center justify-center">
            <User className="w-8 h-8 mr-3" />
            The Expeditioners
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map(char => (
              <Link
                key={char.id}
                to={`/player/${char.id}`}
                className={`${getCharacterGradient(char.id)} rounded-lg p-6 transition-all border-2 border-transparent hover:border-clair-gold-500 shadow-lg hover:shadow-2xl`}
              >
                <h3 className="font-display text-2xl font-bold text-white mb-2">
                  {char.name}
                </h3>
                <p className="font-serif italic text-gray-200 mb-3">
                  {char.role}
                </p>
                <p className="font-sans text-sm text-gray-300">
                  Ready for battle
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* System Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Battle Map Display */}
          <Link
            to="/battle-map/test-session"
            className="bg-gradient-to-br from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 rounded-lg p-6 transition-all border-2 border-transparent hover:border-clair-gold-500 shadow-lg hover:shadow-2xl"
          >
            <div className="flex items-center mb-4">
              <Monitor className="w-8 h-8 text-white mr-3" />
              <h3 className="font-display text-2xl font-bold text-white">
                Battle Map Display
              </h3>
            </div>
            <p className="font-sans text-gray-200">
              Player-facing TV view
            </p>
          </Link>

          {/* GM Controls */}
          <Link
            to="/gm/test-session"
            className="bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 rounded-lg p-6 transition-all border-2 border-transparent hover:border-clair-gold-500 shadow-lg hover:shadow-2xl"
          >
            <div className="flex items-center mb-4">
              <Settings className="w-8 h-8 text-white mr-3" />
              <h3 className="font-display text-2xl font-bold text-white">
                GM Controls
              </h3>
            </div>
            <p className="font-sans text-gray-200">
              Manage session & enemies
            </p>
          </Link>
        </div>

        {/* How It Works */}
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-6 mb-8">
          <h3 className="font-display text-2xl font-bold text-clair-gold-300 mb-4 text-center">
            How the Expedition System Works
          </h3>
          <div className="space-y-4 text-clair-gold-200">
            <div className="flex items-start">
              <div className="bg-clair-mystical-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
                1
              </div>
              <p className="font-sans">Each expeditioner opens their character interface on their device</p>
            </div>
            
            <div className="flex items-start">
              <div className="bg-clair-mystical-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
                2
              </div>
              <p className="font-sans">Display the Battle Map on your TV or shared screen for all to see</p>
            </div>
            
            <div className="flex items-start">
              <div className="bg-clair-mystical-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
                3
              </div>
              <p className="font-sans">GM accesses controls to orchestrate encounters and manage the battlefield</p>
            </div>
            
            <div className="flex items-start">
              <div className="bg-clair-mystical-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
                4
              </div>
              <p className="font-sans">All actions synchronize in real-time across the expedition network!</p>
            </div>
          </div>
        </div>

        {/* Atmospheric Quote */}
        <div className="text-center bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-6 mb-8">
          <blockquote className="font-serif italic text-lg text-clair-gold-300 mb-2">
            "For 67 years, the Paintress has stolen our futures. Today, Expedition 33 changes that destiny."
          </blockquote>
          <cite className="font-sans text-sm text-clair-gold-400">— Gustave, Lead Engineer</cite>
        </div>

        {/* Footer */}
        <div className="text-center text-clair-gold-300">
          <p className="font-serif italic">Built for Session 0 • The expedition begins at dawn</p>
          <div className="mt-4 flex justify-center items-center space-x-2">
            <div className="w-2 h-2 bg-clair-gold-500 rounded-full"></div>
            <p className="font-sans text-sm">Belle Époque Dark Fantasy Campaign</p>
            <div className="w-2 h-2 bg-clair-gold-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}