import React, { useState } from 'react';
import api from '../../api';
import { Link } from 'react-router-dom';
import './ForgotPassword.css';

const ForgotPassword = () => {
    const [formData, setFormData] = useState({ email: '', newPassword: '', confermaPassword: '' });
    const [errors, setErrors] = useState({ email: '', newPassword: '', confermaPassword: '' });
    const [touched, setTouched] = useState({ email: false, newPassword: false, confermaPassword: false });
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const validateEmail = (email) => {
        if (!email) return "Email e' richiesta";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Inserisci un indirizzo email valido';
        return '';
    };

    const validatePassword = (pw) => {
        if (!pw) return 'Password richiesta';
        if (pw.length < 8) return 'La password deve avere almeno 8 caratteri';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw)) return 'Password deve contenere maiuscola, minuscola e numero';
        return '';
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (touched[name]) {
            let err = '';
            if (name === 'email') err = validateEmail(value);
            else if (name === 'newPassword') err = validatePassword(value);
            else if (name === 'confermaPassword') err = value !== formData.newPassword ? 'Le password non coincidono' : '';
            setErrors(prev => ({ ...prev, [name]: err }));
        }
        if (name === 'newPassword' && touched.confermaPassword) {
            setErrors(prev => ({
                ...prev,
                confermaPassword: value !== formData.confermaPassword ? 'Le password non coincidono' : ''
            }));
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        let err = '';
        if (name === 'email') err = validateEmail(value);
        else if (name === 'newPassword') err = validatePassword(value);
        else if (name === 'confermaPassword') err = value !== formData.newPassword ? 'Le password non coincidono' : '';
        setErrors(prev => ({ ...prev, [name]: err }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const emailErr = validateEmail(formData.email);
        const pwErr = validatePassword(formData.newPassword);
        const confErr = formData.newPassword !== formData.confermaPassword ? 'Le password non coincidono' : '';

        if (emailErr || pwErr || confErr) {
            setErrors({ email: emailErr, newPassword: pwErr, confermaPassword: confErr });
            setTouched({ email: true, newPassword: true, confermaPassword: true });
            return;
        }

        setIsLoading(true);
        setMessage('');
        try {
            const res = await api.post('/api/auth/reset-password', {
                email: formData.email,
                new_password: formData.newPassword
            });
            setMessage(res.data.message);
            setSuccess(true);
        } catch (err) {
            setMessage(err.response?.data?.detail || 'Errore durante il reset della password');
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
                        <p className="forgot-subtitle">Recupera la tua password</p>
                        {!success && (
                            <p className="forgot-desc">
                                Inserisci la tua email e scegli una nuova password.
                            </p>
                        )}
                    </div>

                    {success ? (
                        <div className="forgot-success">
                            <div className="success-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                            </div>
                            <p>{message}</p>
                            <Link to="/login" className="forgot-back-link">Torna al login</Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="forgot-form" noValidate>
                            <div className="form-group">
                                <label htmlFor="email" className="form-label">Email</label>
                                <div className="input-wrapper">
                                    <input
                                        type="email" id="email" name="email"
                                        className={`form-control ${errors.email ? 'error' : ''} ${touched.email && !errors.email && formData.email ? 'success' : ''}`}
                                        placeholder="Inserisci la tua email"
                                        value={formData.email}
                                        onChange={handleChange} onBlur={handleBlur} required
                                    />
                                    <div className="input-icon">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                        </svg>
                                    </div>
                                </div>
                                {errors.email && touched.email && <div className="field-error">{errors.email}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="newPassword" className="form-label">Nuova Password</label>
                                <div className="input-wrapper">
                                    <input
                                        type="password" id="newPassword" name="newPassword"
                                        className={`form-control ${errors.newPassword ? 'error' : ''} ${touched.newPassword && !errors.newPassword && formData.newPassword ? 'success' : ''}`}
                                        placeholder="Scegli una nuova password"
                                        value={formData.newPassword}
                                        onChange={handleChange} onBlur={handleBlur} required
                                    />
                                </div>
                                {errors.newPassword && touched.newPassword && <div className="field-error">{errors.newPassword}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="confermaPassword" className="form-label">Conferma Password</label>
                                <div className="input-wrapper">
                                    <input
                                        type="password" id="confermaPassword" name="confermaPassword"
                                        className={`form-control ${errors.confermaPassword ? 'error' : ''} ${touched.confermaPassword && !errors.confermaPassword && formData.confermaPassword ? 'success' : ''}`}
                                        placeholder="Ripeti la nuova password"
                                        value={formData.confermaPassword}
                                        onChange={handleChange} onBlur={handleBlur} required
                                    />
                                </div>
                                {errors.confermaPassword && touched.confermaPassword && <div className="field-error">{errors.confermaPassword}</div>}
                            </div>

                            <button
                                type="submit"
                                className={`forgot-button ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? <><div className="spinner"></div>Aggiornamento...</> : 'Aggiorna Password'}
                            </button>

                            {message && !success && (
                                <div className="message error">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    {message}
                                </div>
                            )}
                        </form>
                    )}

                    <div className="forgot-footer">
                        <Link to="/login">Torna al login</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
