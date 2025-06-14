// src/utils/createEcho.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Asegúrate de que Pusher esté disponible globalmente antes de que Echo lo use.
window.Pusher = Pusher;

// Declara una variable global para Echo si no lo has hecho ya
// Esto ayuda a TypeScript a saber que window.Echo existirá
declare global {
  interface Window {
    Echo: any; // Puedes ser más específico con el tipo si lo deseas
    Pusher: any;
  }
}

export const createEcho = (token: string) => {
  // Solo inicializa Echo una vez para evitar múltiples instancias
  if (typeof window.Echo === 'undefined' || window.Echo === null) { 
    // Crea la instancia de Echo
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

    // Configura logToConsole solo una vez después de crear la instancia
    if (token) {
      // Acceder a Pusher.logToConsole a través de la instancia de Echo es más seguro.
      // O puedes mantener window.Pusher.logToConsole = true; si window.Pusher es global
      window.Pusher.logToConsole = true; // Si window.Pusher ya está asignado
      // O Echo.connector.pusher.config.logToConsole = true; si quieres configurarlo en la instancia de Echo
    }

    console.log("Echo instance created. Current state:", window.Echo.connector.pusher.connection.state);
  } else {
    // Si Echo ya existe, quizás solo necesites actualizar el token para reautenticar
    // Esto es más avanzado y depende de cómo manejes la reautenticación en tu app.
    // Por ahora, solo loguea que ya existe.
    console.log("Echo instance already exists. Current state:", window.Echo.connector.pusher.connection.state);
  }

  console.log("EL TOKEN EN ECHO (pasado a createEcho):", token);

  return window.Echo; // Siempre devuelve la instancia global de Echo
};