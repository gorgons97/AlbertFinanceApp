// INSTALLAZIONE: npm install react-router-dom

// App.js con React Router
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/auth/Login';
import Registrazione from './components/auth/Registrazione';
//import Dashboard from './components/Dashboard'; // Componente futuro
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Route per Login */}
          <Route path="/login" element={<Login />} />

          {/* Route per Registrazione */}
          <Route path="/register" element={<Registrazione />} />

          {/* Redirect automatico alla login se vai alla root */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Route 404 - pagina non trovata */}
          <Route path="*" element={<div>Pagina non trovata</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;