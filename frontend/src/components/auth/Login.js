import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Login.css';

const Login = () => {
    // Stati per gestire i form data
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    // Stati per gestire gli errori di validazione
    const [errors, setErrors] = useState({
        email: '',
        password: ''
    });

    // Stati per UI
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // Stati per validazione real-time
    const [touched, setTouched] = useState({
        email: false,
        password: false
    });

    // Funzione per validazione email
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            return 'Email è richiesta';
        }
        if (!emailRegex.test(email)) {
            return 'Inserisci un indirizzo email valido';
        }
        return '';
    };

    // Funzione per validazione password
    const validatePassword = (password) => {
        if (!password) {
            return 'Password richiesta';
        }
        //if (password.length < 6) {
        //    return 'La password deve essere di almeno 6 caratteri';
        //}
        return '';
    };

    // Gestione cambio input con validazione real-time
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Aggiorna i dati del form
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Validazione real-time se il campo è stato "toccato"
        if (touched[name]) {
            let error = '';
            if (name === 'email') {
                error = validateEmail(value);
            } else if (name === 'password') {
                error = validatePassword(value);
            }

            setErrors(prev => ({
                ...prev,
                [name]: error
            }));
        }
    };

    // Gestione blur per attivare validazione
    const handleBlur = (e) => {
        const { name, value } = e.target;

        // Marca il campo come "toccato"
        setTouched(prev => ({
            ...prev,
            [name]: true
        }));

        // Valida il campo
        let error = '';
        if (name === 'email') {
            error = validateEmail(value);
        } else if (name === 'password') {
            error = validatePassword(value);
        }

        setErrors(prev => ({
            ...prev,
            [name]: error
        }));
    };

    // Toggle visibilità password
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // Gestione submit del form
    const handleLogin = async (e) => {
        e.preventDefault();

        // Valida tutti i campi prima del submit
        const emailError = validateEmail(formData.email);
        const passwordError = validatePassword(formData.password);

        if (emailError || passwordError) {
            setErrors({
                email: emailError,
                password: passwordError
            });
            setTouched({
                email: true,
                password: true
            });
            return;
        }

        setIsLoading(true);
        setMessage('');

        try {
            const response = await axios.post('http://localhost:8000/api/auth/login', null, {
                params: {
                    email: formData.email,
                    password: formData.password
                }
            });
            setMessage(response.data.message || 'Login effettuato con successo!');

            // Se remember me è attivo, salva in localStorage
            if (rememberMe) {
                localStorage.setItem('rememberEmail', formData.email);
            }

        } catch (error) {
            setMessage(error.response?.data?.detail || 'Errore durante il login');
        } finally {
            setIsLoading(false);
        }
    };

    // Carica email salvata al mount del componente
    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberEmail');
        if (savedEmail) {
            setFormData(prev => ({ ...prev, email: savedEmail }));
            setRememberMe(true);
        }
    }, []);

    // Verifica se il form è valido
    const isFormValid = () => {
        return formData.email && 
               formData.password && 
               !errors.email && 
               !errors.password;
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-logo">
                            <div className="logo-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                            </div>
                            <h1>Albert</h1>
                        </div>
                        <p className="login-subtitle">Accedi al tuo account</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form" noValidate>
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                Email
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    className={`form-control ${errors.email ? 'error' : ''} ${touched.email && !errors.email && formData.email ? 'success' : ''}`}
                                    placeholder="Inserisci la tua email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <div className="input-icon">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                    </svg>
                                </div>
                            </div>
                            {errors.email && touched.email && (
                                <div className="field-error">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    {errors.email}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                Password
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    className={`form-control ${errors.password ? 'error' : ''} ${touched.password && !errors.password && formData.password ? 'success' : ''}`}
                                    placeholder="Inserisci la password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={togglePasswordVisibility}
                                    aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && touched.password && (
                                <div className="field-error">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    {errors.password}
                                </div>
                            )}
                        </div>

                        <div className="form-options">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                                Ricordami
                            </label>
                            <a href="#forgot" className="forgot-password">
                                Password dimenticata?
                            </a>
                        </div>

                        <button
                            type="submit"
                            className={`login-button ${isLoading ? 'loading' : ''} ${!isFormValid() ? 'disabled' : ''}`}
                            disabled={!isFormValid() || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <div className="spinner"></div>
                                    Accesso in corso...
                                </>
                            ) : (
                                'Accedi'
                            )}
                        </button>

                        {message && (
                            <div className={`message ${message.includes('successo') ? 'success' : 'error'}`}>
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    {message.includes('successo') ? (
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    ) : (
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    )}
                                </svg>
                                {message}
                            </div>
                        )}
                    </form>

                    <div className="login-footer">
                        <p>Non hai un account? <a href="#register">Registrati</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;