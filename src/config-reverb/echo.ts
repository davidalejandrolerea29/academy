// src/utils/createEcho.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

export const createEcho = (token: string) => {
  console.log("se obtiene token y se crea echo", token)
  return new Echo({
    broadcaster: 'reverb',
    key: 'sfnheugrsf0hhvj0k6oo',
    wsHost: 'english-meet.duckdns.org',
    wsPort: 6001,
    forceTLS: true,
    encrypted: true,
    disableStats: true,
    enabledTransports: ['wss'],
    authEndpoint: 'https://english-meet.duckdns.org/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};
