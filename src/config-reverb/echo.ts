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
  if (typeof window.Echo === 'undefined' || window.Echo === null) {
    console.log("Inicializando Laravel Echo...");
    try {
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

      Pusher.logToConsole = true;
      console.log("Laravel Echo inicializado.");

      window.Echo.connector.pusher.connection.bind('state_change', (states: any) => {
          console.log("Pusher connection state change:", states.current, "from", states.previous);
          if (states.current === 'failed') {
              console.error("Pusher connection FAILED. Triggered by state_change. See stack trace below:");
              console.trace(); // Traza de pila si el estado cambia a 'failed'
          }
      });
      window.Echo.connector.pusher.connection.bind('error', (err: any) => {
          console.error("Pusher connection ERROR event. See stack trace below:", err);
          console.trace(); // Traza de pila si hay un evento de error
      });

    } catch (e: any) {
      console.error("FATAL ERROR during Echo/Pusher initialization:", e);
      console.trace(); // ¡Esto debería darnos la traza de pila si falla al crear la instancia!
      // Asegúrate de que Echo no quede como null o undefined si falla
      window.Echo = null; 
      return null; // Devuelve null si la inicialización falla por completo
    }

  } else {
    // Si Echo ya está inicializado, simplemente logueamos su estado actual.
    // No necesitamos actualizar el token aquí, ya que el token se pasa en cada llamada a createEcho
    // y la instancia se inicializa solo una vez.
    console.log("Laravel Echo ya inicializado. Estado actual:", window.Echo.connector.pusher.connection.state);
  }

  return window.Echo;
};