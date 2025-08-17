import React, { useState } from 'react';
import axios from 'axios';

const Registrazione = () => {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleRegistrazione = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/api/auth/registrazione', {
                nome,
                email,
                password
            });
            setMessage(response.data.message);
        } catch (error) {
            if (error.response) {
                // Se l'errore è un array (es. errori di validazione), uniscilo in una stringa.
                if (Array.isArray(error.response.data.detail)) {
                    const errorMessages = error.response.data.detail.map(err => err.msg).join(' - ');
                    setMessage(errorMessages);
                } else if (typeof error.response.data.detail === 'object' && error.response.data.detail !== null) {
                    // Oggetto singolo con chiave msg
                    setMessage(error.response.data.detail.msg || JSON.stringify(error.response.data.detail));
                } else {
                    // Se è una singola stringa o un oggetto, visualizzala.
                    setMessage(error.response.data.detail);
                }
            } else if (error.request) {
                setMessage('Errore di rete: Impossibile connettersi al server.');
            } else {
                setMessage('Si è verificato un errore inaspettato.');
            }
            console.error(error);
        }
    };

    return (
        <div>
            <h2>Registrazione</h2>
            <form onSubmit={handleRegistrazione}>
                <div>
                    <label>Nome:</label>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div>
                    <label>Email:</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Password:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit">Registrati</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default Registrazione;