// src/utils/createEcho.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

export const createEcho = (token: string) => {
  if (token) {
    Pusher.logToConsole = true;
  }

  console.log("EL TOKEN EN ECHO:", token)

  return new Echo({
    broadcaster: 'reverb',
    key: 'sfnheugrsf0hhvj0k6oo', // Asegúrate que este sea el mismo REVERB_APP_ID en tu .env
    wsHost: 'english-meet.duckdns.org', // El dominio público
    wsPort: 443, // El puerto HTTPS público de tu servidor
    forceTLS: true, // Forzar uso de TLS (HTTPS/WSS)
    enabledTransports: ['wss'], // Usar WebSockets Seguros

    // El endpoint de autenticación DEBE ser accesible públicamente vía HTTPS
    authEndpoint: 'https://english-meet.duckdns.org/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};