import React, { useState } from 'react';
import Registrazione from './components/auth/Registrazione';
import Login from './components/auth/Login'; 
import './App.css';

function App() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="App">
      {showLogin ? (
        // Mostra solo il nuovo Login component con design moderno
        <Login />
      ) : (
        // Versione di test con entrambi i componenti affiancati
        <div className="test-container">
          <header className="App-header">
            <h1>Test Frontend - Backend</h1>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
              <div>
                <h2>Registrazione</h2>
                <Registrazione />
              </div>
              <div>
                <h2>Login Migliorato</h2>
                <Login />
              </div>
            </div>
          </header>
        </div>
      )}

      {/* Toggle per passare tra le modalità */}
      <button 
        onClick={() => setShowLogin(!showLogin)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '10px 20px',
          backgroundColor: '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        {showLogin ? 'Modalità Test' : 'Modalità Produzione'}
      </button>
    </div>
  );
}

export default App;