import React, { useState, useEffect } from 'react';
import api from '../../api';
import supabase from '../../supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Registrazione.css'; // Usa lo stesso CSS modificando i nomi delle classi


const Registrazione = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    // Stati per gestire i form data - AGGIORNATI con nuovi campi
    const [formData, setFormData] = useState({
        nome: '',
        cognome: '',
        email: '',
        password: '',
        confermaPassword: ''
    });


    // Stati per gestire gli errori di validazione - AGGIORNATI
    const [errors, setErrors] = useState({
        nome: '',
        cognome: '',
        email: '',
        password: '',
        confermaPassword: ''
    });


    // Stati per UI
    const [showPassword, setShowPassword] = useState(false);
    const [showConfermaPassword, setShowConfermaPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');


    // Stati per validazione real-time - AGGIORNATI
    const [touched, setTouched] = useState({
        nome: false,
        cognome: false,
        email: false,
        password: false,
        confermaPassword: false
    });


    // Funzione per validazione nome
    const validateNome = (nome) => {
        if (!nome.trim()) {
            return 'Nome è richiesto';
        }
        if (nome.trim().length < 2) {
            return 'Nome deve avere almeno 2 caratteri';
        }
        return '';
    };


    // Funzione per validazione cognome
    const validateCognome = (cognome) => {
        if (!cognome.trim()) {
            return 'Cognome è richiesto';
        }
        if (cognome.trim().length < 2) {
            return 'Cognome deve avere almeno 2 caratteri';
        }
        return '';
    };


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


    // Funzione per validazione password - PIÙ RIGOROSA per registrazione
    const validatePassword = (password) => {
        if (!password) {
            return 'Password è richiesta';
        }
        if (password.length < 8) {
            return 'La password deve avere almeno 8 caratteri';
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            return 'Password deve contenere maiuscola, minuscola e numero';
        }
        return '';
    };


    // Funzione per validazione conferma password
    const validateConfermaPassword = (password, confermaPassword) => {
        if (!confermaPassword) {
            return 'Conferma password è richiesta';
        }
        if (password !== confermaPassword) {
            return 'Le password non coincidono';
        }
        return '';
    };


    // Gestione cambio input con validazione real-time - AGGIORNATA
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
            if (name === 'nome') {
                error = validateNome(value);
            } else if (name === 'cognome') {
                error = validateCognome(value);
            } else if (name === 'email') {
                error = validateEmail(value);
            } else if (name === 'password') {
                error = validatePassword(value);
            } else if (name === 'confermaPassword') {
                error = validateConfermaPassword(formData.password, value);
            }


            setErrors(prev => ({
                ...prev,
                [name]: error
            }));
        }

        // Validazione speciale: se cambio password, rivalidare anche confermaPassword
        if (name === 'password' && touched.confermaPassword) {
            const confermaError = validateConfermaPassword(value, formData.confermaPassword);
            setErrors(prev => ({
                ...prev,
                confermaPassword: confermaError
            }));
        }
    };


    // Gestione blur per attivare validazione - AGGIORNATA
    const handleBlur = (e) => {
        const { name, value } = e.target;


        // Marca il campo come "toccato"
        setTouched(prev => ({
            ...prev,
            [name]: true
        }));


        // Valida il campo
        let error = '';
        if (name === 'nome') {
            error = validateNome(value);
        } else if (name === 'cognome') {
            error = validateCognome(value);
        } else if (name === 'email') {
            error = validateEmail(value);
        } else if (name === 'password') {
            error = validatePassword(value);
        } else if (name === 'confermaPassword') {
            error = validateConfermaPassword(formData.password, value);
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

    // Toggle visibilità conferma password
    const toggleConfermaPasswordVisibility = () => {
        setShowConfermaPassword(!showConfermaPassword);
    };


    // Gestione submit del form - AGGIORNATA per registrazione
    const handleRegistrazione = async (e) => {
        e.preventDefault();


        // Valida tutti i campi prima del submit
        const nomeError = validateNome(formData.nome);
        const cognomeError = validateCognome(formData.cognome);
        const emailError = validateEmail(formData.email);
        const passwordError = validatePassword(formData.password);
        const confermaPasswordError = validateConfermaPassword(formData.password, formData.confermaPassword);


        if (nomeError || cognomeError || emailError || passwordError || confermaPasswordError) {
            setErrors({
                nome: nomeError,
                cognome: cognomeError,
                email: emailError,
                password: passwordError,
                confermaPassword: confermaPasswordError
            });
            setTouched({
                nome: true,
                cognome: true,
                email: true,
                password: true,
                confermaPassword: true
            });
            return;
        }


        setIsLoading(true);
        setMessage('');

        try {
            // 1. Registrazione tramite Supabase / GoTrue
            const { data, error } = await supabase.auth.signUp({
                email: formData.email.trim(),
                password: formData.password,
                options: {
                    data: {
                        nome: formData.nome.trim(),
                        cognome: formData.cognome.trim(),
                    }
                }
            });

            if (error) {
                // Fallback trasparente su registrazione legacy se GoTrue ha restrizioni
                const response = await api.post('/api/auth/registrazione', {
                    nome: formData.nome.trim(),
                    cognome: formData.cognome.trim(),
                    email: formData.email.trim(),
                    password: formData.password
                });
                setMessage(response.data.message || 'Registrazione completata con successo!');
                localStorage.setItem('access_token', response.data.access_token);
                setTimeout(() => navigate('/dashboard'), 1500);
                return;
            }

            if (data?.session?.access_token) {
                // Utente auto-confermato: salva token e inizializza profilo/portafoglio nel backend
                localStorage.setItem('access_token', data.session.access_token);
                await api.get('/api/auth/me').catch(() => {});
                setMessage('Registrazione completata con successo!');
                setTimeout(() => navigate('/dashboard'), 1500);
            } else {
                setMessage('Registrazione effettuata! Controlla la tua email per confermare l\'account.');
            }

        } catch (error) {            
            if (error.response) {
                if (Array.isArray(error.response.data.detail)) {
                    const errorMessages = error.response.data.detail.map(err => err.msg).join(' - ');
                    setMessage(errorMessages);
                } else if (typeof error.response.data.detail === 'object' && error.response.data.detail !== null) {
                    setMessage(error.response.data.detail.msg || JSON.stringify(error.response.data.detail));
                } else {
                    setMessage(error.response.data.detail);
                }
            } else {
                setMessage(error.message || 'Errore durante la registrazione.');
            }
        } finally {
            setIsLoading(false);
        }
    };


    // Ripristina lo stato del pulsante se l'utente torna indietro dal browser
    useEffect(() => {
        const handlePageShow = () => {
            setIsLoading(false);
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => {
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, []);

    // Registrazione con Google OAuth
    const handleGoogleSignup = async () => {
        setIsLoading(true);
        setMessage('');
        try {
            // Rimuovi eventuali sessioni precedenti per evitare conflitti di account
            try {
                await supabase.auth.signOut();
            } catch {}
            localStorage.removeItem('access_token');

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                    queryParams: {
                        prompt: 'select_account',
                    }
                }
            });
            if (error) throw error;
        } catch (error) {
            setMessage(error.message || 'Errore durante la registrazione con Google');
            setIsLoading(false);
        }
    };

    // Verifica se il form è valido - AGGIORNATA
    const isFormValid = () => {
        return formData.nome && 
               formData.cognome &&
               formData.email && 
               formData.password && 
               formData.confermaPassword &&
               !errors.nome && 
               !errors.cognome &&
               !errors.email && 
               !errors.password &&
               !errors.confermaPassword;
    };


    return (
        <div className="registrazione-page"> {/* CAMBIATO da login-page */}
            <div className="registrazione-container"> {/* CAMBIATO da login-container */}
                <div className="registrazione-card"> {/* CAMBIATO da login-card */}
                    <div className="registrazione-header"> {/* CAMBIATO da login-header */}
                        <div className="registrazione-logo"> {/* CAMBIATO da login-logo */}
                            <div className="logo-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                            </div>
                            <h1>Albert</h1>
                        </div>
                        <p className="registrazione-subtitle">Crea il tuo account</p> {/* CAMBIATO testo */}
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleSignup}
                        className="google-btn"
                        disabled={isLoading}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        Registrati con Google
                    </button>

                    <div className="auth-divider">
                        <span>oppure con email</span>
                    </div>

                    <form onSubmit={handleRegistrazione} className="registrazione-form" noValidate> {/* CAMBIATI nomi */}

                        {/* CAMPO NOME - NUOVO */}
                        <div className="form-group">
                            <label htmlFor="nome" className="form-label">
                                Nome
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    id="nome"
                                    name="nome"
                                    className={`form-control \${errors.nome ? 'error' : ''} \${touched.nome && !errors.nome && formData.nome ? 'success' : ''}`}
                                    placeholder="Inserisci il tuo nome"
                                    value={formData.nome}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <div className="input-icon">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                </div>
                            </div>
                            {errors.nome && touched.nome && (
                                <div className="field-error">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    {errors.nome}
                                </div>
                            )}
                        </div>

                        {/* CAMPO COGNOME - NUOVO */}
                        <div className="form-group">
                            <label htmlFor="cognome" className="form-label">
                                Cognome
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    id="cognome"
                                    name="cognome"
                                    className={`form-control \${errors.cognome ? 'error' : ''} \${touched.cognome && !errors.cognome && formData.cognome ? 'success' : ''}`}
                                    placeholder="Inserisci il tuo cognome"
                                    value={formData.cognome}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <div className="input-icon">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                </div>
                            </div>
                            {errors.cognome && touched.cognome && (
                                <div className="field-error">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    {errors.cognome}
                                </div>
                            )}
                        </div>


                        {/* CAMPO EMAIL - STESSO DEL LOGIN */}
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                Email
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    className={`form-control \${errors.email ? 'error' : ''} \${touched.email && !errors.email && formData.email ? 'success' : ''}`}
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


                        {/* CAMPO PASSWORD - CON VALIDAZIONE PIÙ RIGOROSA */}
                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                Password
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    className={`form-control \${errors.password ? 'error' : ''} \${touched.password && !errors.password && formData.password ? 'success' : ''}`}
                                    placeholder="Crea una password sicura"
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

                        {/* CAMPO CONFERMA PASSWORD - NUOVO */}
                        <div className="form-group">
                            <label htmlFor="confermaPassword" className="form-label">
                                Conferma Password
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type={showConfermaPassword ? 'text' : 'password'}
                                    id="confermaPassword"
                                    name="confermaPassword"
                                    className={`form-control \${errors.confermaPassword ? 'error' : ''} \${touched.confermaPassword && !errors.confermaPassword && formData.confermaPassword ? 'success' : ''}`}
                                    placeholder="Ripeti la password"
                                    value={formData.confermaPassword}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={toggleConfermaPasswordVisibility}
                                    aria-label={showConfermaPassword ? 'Nascondi conferma password' : 'Mostra conferma password'}
                                >
                                    {showConfermaPassword ? (
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
                            {errors.confermaPassword && touched.confermaPassword && (
                                <div className="field-error">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    {errors.confermaPassword}
                                </div>
                            )}
                        </div>


                        {/* PULSANTE REGISTRAZIONE - AGGIORNATO */}
                        <button
                            type="submit"
                            className={`registrazione-button ${isLoading ? 'loading' : ''} ${!isFormValid() ? 'disabled' : ''}`} 
                            disabled={!isFormValid() || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <div className="spinner"></div>
                                    Registrazione in corso...
                                </>
                            ) : (
                                'Registrati'
                            )}
                        </button>


                        {message && (
                            <div className={`message \${message.includes('successo') || message.includes('completata') ? 'success' : 'error'}`}>
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    {message.includes('successo') || message.includes('completata') ? (
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    ) : (
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    )}
                                </svg>
                                {message}
                            </div>
                        )}
                    </form>


                    <div className="registrazione-footer"> {/* CAMBIATO nome classe */}
                        <p>
                            Hai già un account? 
                            <Link to="/login">Accedi</Link> {/* LINK AL LOGIN */}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Registrazione;