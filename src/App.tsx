import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { Home } from './pages/Home';
import { PlayerView } from './pages/PlayerView';
import { GMView } from './pages/GMView';
import { BattleMapView } from './pages/BattleMapView';
import EnemyView from './pages/EnemyView'; // FIXED: Default import

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
            {/* Home page */}
            <Route path="/" element={<Home />} />
            
            {/* Player character sheets */}
            <Route path="/player/:characterId" element={<PlayerView />} />

            {/* Battle map display for TV */}
            <Route path="/battle-map/:sessionId" element={<BattleMapView />} />
            
            {/* GM controls */}
            <Route path="/gm/:sessionId" element={<GMView />} />

            {/* Enemy control page */}
            <Route path="/enemy/:sessionId" element={<EnemyView />} />

            {/* Redirect any other routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;