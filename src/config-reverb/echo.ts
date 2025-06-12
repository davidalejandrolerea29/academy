import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const isSecure = window.location.protocol === 'https:';

window.Pusher = Pusher;

const token = localStorage.getItem('token');
console.log('Token enviado en header:', token);

if (!token) {
  console.warn('⚠️ No se encontró token en localStorage.');
}

const echo = new Echo({ 
  broadcaster: 'reverb',
  key: 'sfnheugrsf0hhvj0k6oo',
  wsHost: 'english-meet.duckdns.org',
  wsPort: 6001, // <- el puerto que estás utilizando en el backend
  forceTLS: false, // <- false si NO estás bajo HTTPS
  encrypted: false, // <- false si NO estás bajo HTTPS
  disableStats: true,
  enabledTransports: ['ws'], // <- que use ws
  authEndpoint: 'https://english-meet.duckdns.org/broadcasting/auth',
  auth: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
});

// Exportamos para usar en otras partes de la aplicación
export default echo;

