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
    key: 'sfnheugrsf0hhvj0k6oo',
    wsHost: 'english-meet.duckdns.org',
    wsPort: 6001,
    forceTLS: false,
    enabledTransports: ['ws'],
    authEndpoint: 'http://127.0.0.1:6001/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};
