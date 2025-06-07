import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
const isSecure = window.location.protocol === 'https:';

window.Pusher = Pusher;

const rawToken = '​eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjgwMDAvYXBpL3YxL2F1dGgvbG9naW4iLCJpYXQiOjE3NDkwNjYwODgsImV4cCI6MTc0OTA2OTY4OCwibmJmIjoxNzQ5MDY2MDg4LCJqdGkiOiJzNlBPTVp5RWxOT2RNSldvIiwic3ViIjoiMSIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjcifQ.ZhDaS7u4FMlAnrjNQrsKMDMAsekAQoSHsekPqG7VPS0';

const token = rawToken.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
const echo = new Echo({
  broadcaster: 'reverb',
  key: 'sfnheugrsf0hhvj0k6oo',
  wsHost: window.location.hostname,
  wsPort: 8080,   // 443 para ws no seguro normalmente se usa 80 o 8080
  wssPort: 8080, 
  forceTLS: false,
  encrypted: false,
  disableStats: true,
  enabledTransports: ['ws', 'wss'],
  authEndpoint: 'http://127.0.0.1:8000/broadcasting/auth',
  auth: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
});

export default echo;
