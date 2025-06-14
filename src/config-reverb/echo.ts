// src/utils/createEcho.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

declare global {
  interface Window {
    Echo: any;
    Pusher: any;
  }
}

export const createEcho = (token: string) => {
  // Asegúrate de que Echo se inicialice solo una vez
  if (typeof window.Echo === 'undefined' || window.Echo === null) {
    console.log("Inicializando Laravel Echo...");
    window.Echo = new Echo({
      broadcaster: 'reverb',
      key: 'sfnheugrsf0hhvj0k6oo',
      wsHost: 'english-meet.duckdns.org',
      wsPort: 443,
      forceTLS: true,
      enabledTransports: ['wss'],
      authEndpoint: 'https://english-meet.duckdns.org/broadcasting/auth',
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    Pusher.logToConsole = true; // Mantén esto para ver los logs de Pusher
    console.log("Laravel Echo inicializado.");

    // Agrega un listener para depurar el estado de la conexión
    window.Echo.connector.pusher.connection.bind('state_change', (states: any) => {
        console.log("Pusher connection state change:", states.current, "from", states.previous);
        if (states.current === 'failed') {
            console.error("Pusher connection FAILED. See stack trace below:");
            console.trace(); // ¡Esto nos dará la traza de pila!
        }
    });
    window.Echo.connector.pusher.connection.bind('error', (err: any) => {
        console.error("Pusher connection ERROR:", err);
        console.trace(); // También traza de pila en caso de error
    });

  } else {
    // Si Echo ya está inicializado, simplemente asegúrate de que el token esté actualizado
    // Esto es importante si el token puede cambiar durante la sesión
    // window.Echo.options.auth.headers.Authorization = `Bearer ${token}`;
    console.log("Laravel Echo ya inicializado. Estado actual:", window.Echo.connector.pusher.connection.state);
  }

  return window.Echo;
};