import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
const isSecure = window.location.protocol === 'https:';

window.Pusher = Pusher;

const token = localStorage.getItem('token');
console.log('Token enviado en header:', token);

if (!token) {
  console.warn('⚠️ No se encontró token en localStorage.');
}

// const token = rawToken.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
const echo = new Echo({
  broadcaster: 'reverb',
  key: 'sfnheugrsf0hhvj0k6oo',
  wsHost: 'chocolate-loris-764280.hostingersite.com', // 👈 clave
  wsPort: 8080,
  wssPort: 8080,
  forceTLS: true,      // 👈 activo si usas HTTPS
  encrypted: true,     // 👈 igual
  disableStats: true,
  enabledTransports: ['wss'], // no uses wss si no hay SSL
  authEndpoint: 'https://chocolate-loris-764280.hostingersite.com/broadcasting/auth',
  auth: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
});



export default echo;
