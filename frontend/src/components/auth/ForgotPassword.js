import React, { useState, useEffect } from 'react';
import supabase from '../../supabase';
import { Link, useNavigate } from 'react-router-dom';
import './ForgotPassword.css';

const ForgotPassword = () => {
    const navigate = useNavigate();

    // Modalità: false = richiesta link email (Step 1), true = impostazione nuova password (Step 2)
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);

    // Form Step 1: Richiesta Link
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [emailTouched, setEmailTouched] = useState(false);

    // Form Step 2: Nuova Password
    const [newPassword, setNewPassword] = useState('');
    const [confermaPassword, setConfermaPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState({ newPassword: '', confermaPassword: '' });
    const [passwordTouched, setPasswordTouched] = useState({ newPassword: false, confermaPassword: false });
    const [showPassword, setShowPassword] = useState(false);

    // UI States
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSentSuccess, setEmailSentSuccess] = useState(false);
    const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

    // Rileva se l'utente arriva dal link di recupero inviato per email
    useEffect(() => {
        // Controllo se l'hash dell'URL contiene type=recovery
        const hash = window.location.hash;
        if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
            setIsRecoveryMode(true);
        }

        // Listener Supabase per l'evento di recupero password
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsRecoveryMode(true);
            }
        });

        return () => {
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const validateEmail = (val) => {
        if (!val) return 'Email richiesta';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Inserisci un indirizzo email valido';
        return '';
    };

    const validatePassword = (pw) => {
        if (!pw) return 'Password richiesta';
        if (pw.length < 8) return 'La password deve avere almeno 8 caratteri';
        return '';
    };

    // Step 1: Invia link di recupero via email
    const handleSendRecoveryEmail = async (e) => {
        e.preventDefault();
        const err = validateEmail(email);
        if (err) {
            setEmailError(err);
            setEmailTouched(true);
            return;
        }

        setIsLoading(true);
        setMessage('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/forgot`
            });

            if (error) throw error;

            setEmailSentSuccess(true);
            setMessage(`Abbiamo inviato un link sicuro all'indirizzo ${email}. Controlla la tua casella di posta per reimpostare la password.`);
        } catch (err) {
            setMessage(err.message || 'Impossibile inviare l\'email di recupero. Riprova più tardi.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Salva la nuova password dopo il click sul link
    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        const errPw = validatePassword(newPassword);
        const errConf = newPassword !== confermaPassword ? 'Le password non coincidono' : '';

        if (errPw || errConf) {
            setPasswordErrors({ newPassword: errPw, confermaPassword: errConf });
            setPasswordTouched({ newPassword: true, confermaPassword: true });
            return;
        }

        setIsLoading(true);
        setMessage('');

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setPasswordResetSuccess(true);
            setMessage('La tua password è stata aggiornata con successo!');
            setTimeout(() => {
                navigate('/login');
            }, 2500);
        } catch (err) {
            setMessage(err.message || 'Errore durante l\'aggiornamento della password. Il link potrebbe essere scaduto.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="forgot-page">
            <div className="forgot-container">
                <div className="forgot-card">
                    <div className="forgot-header">
                        <div className="forgot-logo">
                            <div className="logo-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                            </div>
                            <h1>Albert</h1>
                        </div>

                        <p className="forgot-subtitle">
                            {isRecoveryMode ? 'Imposta Nuova Password' : 'Password Dimenticata'}
                        </p>

                        {!emailSentSuccess && !passwordResetSuccess && (
                            <p className="forgot-desc">
                                {isRecoveryMode
                                    ? 'Inserisci e conferma la tua nuova password.'
                                    : 'Inserisci la tua email. Ti invieremo un link sicuro per reimpostarla.'}
                            </p>
                        )}
                    </div>

                    {/* STATO: Email inviata con successo */}
                    {emailSentSuccess ? (
                        <div className="forgot-success">
                            <div className="success-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                </svg>
                            </div>
                            <p>{message}</p>
                            <Link to="/login" className="forgot-back-link">Torna al Login</Link>
                        </div>
                    ) : passwordResetSuccess ? (
                        /* STATO: Password aggiornata con successo */
                        <div className="forgot-success">
                            <div className="success-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                            </div>
                            <p>{message}</p>
                            <Link to="/login" className="forgot-back-link">Vai al Login</Link>
                        </div>
                    ) : isRecoveryMode ? (
                        /* STEP 2: Form per inserire la nuova password */
                        <form onSubmit={handleUpdatePassword} className="forgot-form" noValidate>
                            <div className="form-group">
                                <label htmlFor="newPassword" className="form-label">Nuova Password</label>
                                <div className="input-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="newPassword"
                                        name="newPassword"
                                        className={`form-control ${passwordErrors.newPassword ? 'error' : ''}`}
                                        placeholder="Minimo 8 caratteri"
                                        value={newPassword}
                                        onChange={(e) => {
                                            setNewPassword(e.target.value);
                                            if (passwordTouched.newPassword) setPasswordErrors(prev => ({ ...prev, newPassword: validatePassword(e.target.value) }));
                                        }}
                                        onBlur={() => {
                                            setPasswordTouched(prev => ({ ...prev, newPassword: true }));
                                            setPasswordErrors(prev => ({ ...prev, newPassword: validatePassword(newPassword) }));
                                        }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                                    >
                                        {showPassword ? '👁️' : '🙈'}
                                    </button>
                                </div>
                                {passwordErrors.newPassword && passwordTouched.newPassword && (
                                    <div className="field-error">{passwordErrors.newPassword}</div>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="confermaPassword" className="form-label">Conferma Nuova Password</label>
                                <div className="input-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="confermaPassword"
                                        name="confermaPassword"
                                        className={`form-control ${passwordErrors.confermaPassword ? 'error' : ''}`}
                                        placeholder="Ripeti la nuova password"
                                        value={confermaPassword}
                                        onChange={(e) => {
                                            setConfermaPassword(e.target.value);
                                            if (passwordTouched.confermaPassword) setPasswordErrors(prev => ({ ...prev, confermaPassword: e.target.value !== newPassword ? 'Le password non coincidono' : '' }));
                                        }}
                                        onBlur={() => {
                                            setPasswordTouched(prev => ({ ...prev, confermaPassword: true }));
                                            setPasswordErrors(prev => ({ ...prev, confermaPassword: confermaPassword !== newPassword ? 'Le password non coincidono' : '' }));
                                        }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                                    >
                                        {showPassword ? '👁️' : '🙈'}
                                    </button>
                                </div>
                                {passwordErrors.confermaPassword && passwordTouched.confermaPassword && (
                                    <div className="field-error">{passwordErrors.confermaPassword}</div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className={`forgot-button ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? <><div className="spinner"></div>Salvataggio...</> : 'Salva Nuova Password'}
                            </button>

                            {message && (
                                <div className="message error">{message}</div>
                            )}
                        </form>
                    ) : (
                        /* STEP 1: Form per richiedere il link via email */
                        <form onSubmit={handleSendRecoveryEmail} className="forgot-form" noValidate>
                            <div className="form-group">
                                <label htmlFor="email" className="form-label">La tua Email</label>
                                <div className="input-wrapper">
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        className={`form-control ${emailError ? 'error' : ''}`}
                                        placeholder="Inserisci l'email del tuo account"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (emailTouched) setEmailError(validateEmail(e.target.value));
                                        }}
                                        onBlur={() => {
                                            setEmailTouched(true);
                                            setEmailError(validateEmail(email));
                                        }}
                                        required
                                    />
                                    <div className="input-icon">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                        </svg>
                                    </div>
                                </div>
                                {emailError && emailTouched && (
                                    <div className="field-error">{emailError}</div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className={`forgot-button ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? <><div className="spinner"></div>Invio in corso...</> : 'Invia Link di Recupero'}
                            </button>

                            {message && (
                                <div className="message error">{message}</div>
                            )}
                        </form>
                    )}

                    <div className="forgot-footer">
                        <Link to="/login">← Torna alla pagina di accesso</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
