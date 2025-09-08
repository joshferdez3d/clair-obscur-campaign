import React from 'react';
import { Link } from 'react-router-dom';
import { User, Monitor, Settings, Map } from 'lucide-react';

export function Home() {
  const characters = [
    { id: 'maelle', name: 'Maelle', role: 'The Stance Fencer', color: 'clair-maelle' },
    { id: 'gustave', name: 'Gustave', role: 'The Engineer', color: 'clair-gustave' },
    { id: 'lune', name: 'Lune', role: 'The Elemental Scholar', color: 'clair-lune' },
    { id: 'sciel', name: 'Sciel', role: 'The Tarot Warrior', color: 'clair-sciel' }
  ];

  const getCharacterGradient = (id: string) => {
    switch (id) {
      case 'maelle':
        return 'bg-gradient-to-br from-clair-royal-500 to-clair-royal-700 hover:from-clair-royal-400 hover:to-clair-royal-600'; // NEW: Royal blue
      case 'gustave':
        return 'bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800';
      case 'lune':
        return 'bg-gradient-to-br from-clair-mystical-700 to-clair-mystical-900 hover:from-clair-mystical-600 hover:to-clair-mystical-800'; // Unchanged - keeping purple
      case 'sciel':
        return 'bg-gradient-to-br from-green-700 to-green-900 hover:from-green-600 hover:to-green-800';
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
          <p className="font-serif text-xl text-clair-gold-200 italic">
            Campaign Management System
          </p>
          <p className="font-sans text-clair-gold-300 mt-2">
            Choose your expeditioner or access GM tools
          </p>
        </div>

        {/* Character Selection */}
        <div className="mb-12">
          <h2 className="font-display text-2xl font-bold text-clair-gold-400 mb-6 flex items-center justify-center">
            <User className="w-6 h-6 mr-2" />
            The Expeditioners
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map((character) => (
              <Link
                key={character.id}
                to={`/player/${character.id}`}
                className="block"
              >
                <div 
                  className={`p-6 rounded-lg shadow-shadow border border-clair-gold-600 hover:border-clair-gold-400 transition-all duration-200 hover:scale-105 text-white ${getCharacterGradient(character.id)}`}
                >
                  <h3 className="font-serif text-xl font-bold mb-2 text-clair-gold-50">{character.name}</h3>
                  <p className="font-serif italic text-clair-gold-200">{character.role}</p>
                  <div className="mt-3 font-sans text-sm text-clair-gold-300">
                    Ready for battle
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* GM & Display Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Link
            to="/battle-map/test-session" // TODO: replace 'test-session' with your real session id
            className="block bg-gradient-to-br from-indigo-700 to-indigo-900 hover:from-indigo-600 hover:to-indigo-800
                       border border-indigo-500 hover:border-indigo-400 p-6 rounded-lg shadow-shadow
                       hover:shadow-indigo-500/20 transition-all duration-200 hover:scale-105"
          >
            <div className="flex items-center text-white">
              <Monitor className="w-8 h-8 mr-4 text-indigo-200" />
              <div>
                <h3 className="font-display text-xl font-bold mb-1 text-indigo-100">Battle Map Display</h3>
                <p className="font-sans text-indigo-200">Player-facing TV view</p>
              </div>
            </div>
          </Link>
          <Link
            to="/gm/test-session"
            className="block bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 border border-red-500 hover:border-red-400 p-6 rounded-lg shadow-shadow hover:shadow-lg hover:shadow-red-500/20 transition-all duration-200 hover:scale-105"
          >
            <div className="flex items-center text-white">
              <Settings className="w-8 h-8 mr-4 text-red-200" />
              <div>
                <h3 className="font-display text-xl font-bold mb-1 text-red-100">GM Controls</h3>
                <p className="font-sans text-red-200">Manage session & enemies</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Start Guide */}
        <div className="bg-clair-shadow-600 border border-clair-gold-600 rounded-lg p-6 mb-8">
          <h2 className="font-display text-xl font-bold text-clair-gold-400 mb-4 flex items-center">
            <Map className="w-5 h-5 mr-2" />
            Expedition Briefing
          </h2>
          
          <div className="space-y-3 text-clair-gold-200">
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