import React from 'react';
import Registrazione from './components/Registrazione';
import Login from './components/Login';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Test Frontend - Backend</h1>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <Registrazione />
          <Login />
        </div>
      </header>
    </div>
  );
}

export default App;