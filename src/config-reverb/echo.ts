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
  wsPort: 443, // porque ya lo estás proxyando por Apache
  forceTLS: true,
  encrypted: true,
  disableStats: true,
  enabledTransports: ['wss'],
  authEndpoint: 'https://english-meet.duckdns.org/broadcasting/auth',
  auth: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
});


// Exportamos para usar en otras partes de la aplicación
export default echo;

