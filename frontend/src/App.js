import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/auth/Login';
import Registrazione from './components/auth/Registrazione';
import ForgotPassword from './components/auth/ForgotPassword';
import Dashboard from './components/dashboard/Dashboard';
import './App.css';

function App() {
  const { t } = useTranslation();
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registrazione />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ForgotPassword />} />

          {/* Dashboard (autoprotetta via controllo token interno) */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Redirect root -> login (la dashboard richiede autenticazione) */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 404 */}
          <Route path="*" element={<div>{t('Pagina non trovata')}</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
