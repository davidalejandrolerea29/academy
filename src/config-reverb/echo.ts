// src/utils/createEcho.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Asegúrate de que Pusher esté disponible globalmente antes de que Echo lo use.
window.Pusher = Pusher;

// Declara una variable global para Echo (esto es solo para TypeScript)
declare global {
  interface Window {
    Echo: any;
    Pusher: any;
  }
}

export const createEcho = (token: string) => {
  // Limpia cualquier instancia de Echo existente para forzar una nueva conexión para la depuración
  if (window.Echo) {
      window.Echo.disconnect();
      window.Echo = null;
  }

  console.log("Intentando crear una nueva instancia de Echo...");
  console.log("Token recibido en createEcho:", token ? "Token provided" : "No token provided");

  // Crea la instancia de Echo
  const echoInstance = new Echo({
    broadcaster: 'reverb',
    key: 'sfnheugrsf0hhvj0k6oo', // CONFIRMA QUE ES EL MISMO APP_ID
    wsHost: 'english-meet.duckdns.org',
    wsPort: 443,
    forceTLS: true,
    enabledTransports: ['wss'], // Usar WebSockets Seguros
    authEndpoint: 'https://english-meet.duckdns.org/broadcasting/auth', // Endpoint de auth público y HTTPS
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  window.Echo = echoInstance; // Asigna la instancia a window.Echo

  // Configura logToConsole para Pusher después de crear la instancia
  Pusher.logToConsole = true; 

  console.log("Echo instance created. Initial state:", window.Echo.connector.pusher.connection.state);
  console.log("Echo options:", window.Echo.options);

  // Agrega listeners para depuración
  window.Echo.connector.pusher.connection.bind('state_change', (states: any) => {
      console.log("Pusher state change:", states.current, "from", states.previous);
  });
  window.Echo.connector.pusher.connection.bind('error', (err: any) => {
      console.error("Pusher connection error:", err);
  });

  return window.Echo; // Siempre devuelve la instancia global de Echo
};