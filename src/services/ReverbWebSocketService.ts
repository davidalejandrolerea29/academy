// src/services/ReverbWebSocketService.ts

import axios from 'axios';

// --- Interfaces para tipar los datos ---

interface WebSocketServiceOptions {
  appKey: string;
  wsHost: string;
  wsPort: number;
  wssPort: number;
  authEndpoint: string;
  token: string; // El token de autenticación del usuario
  forceTLS: boolean
}

// Representa un canal al que estamos suscritos
interface ChannelSubscription {
  ws: WebSocket; // La conexión WebSocket global
  socketId: string; // El socket_id asignado por Reverb
  listeners: Map<string, Set<Function>>; // Para almacenar múltiples callbacks por evento
  presenceMembers?: Map<string, any>; // Solo para canales de presencia (id -> info de miembro)
  // Puedes añadir más estado específico del canal si lo necesitas
}

// Replicar la interfaz de un "canal" de Echo para compatibilidad en tus componentes
export interface EchoChannel {
  listen: (eventName: string, callback: Function) => void;
  listenForWhisper: (eventName: string, callback: Function) => void; // Agregado para whispers
  whisper: (eventName: string, data: any) => void;
  leave: () => void;
  subscribed: (callback: Function) => void; // Callbacks para cuando se suscribe exitosamente
  error: (callback: Function) => void; // Callbacks para errores específicos del canal
  // Métodos para canales de presencia
  here: (callback: (members: any[]) => void) => void; // Lista inicial de miembros
  joining: (callback: (member: any) => void) => void; // Cuando un miembro se une
  leaving: (callback: (member: any) => void) => void; // Cuando un miembro se va
  // Propiedad para acceder a los miembros actuales del canal de presencia (solo lectura)
  members: Map<string, any>; // Devuelve un Map<string, any>
}


// --- Clase Principal del Servicio WebSocket ---

export class ReverbWebSocketService {
  private options: WebSocketServiceOptions;
  private wsUrl: string;
  private globalWs: WebSocket | null = null;
  private globalSocketId: string | null = null;
  // Mapa para gestionar múltiples instancias de canales (ej. 'private-chat.1-2', 'video-room.xyz')
  private channels: Map<string, ChannelSubscription> = new Map();
  private globalListeners: Map<string, Set<Function>> = new Map(); // Para eventos globales (ej. 'connected', 'disconnected')

  // Lógica de reconexión exponencial
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectInterval = 1000; // 1 segundo
  private connectionPromise: Promise<string> | null = null; // Para evitar múltiples intentos de conexión

constructor(options: WebSocketServiceOptions) {
    this.options = options;

    const protocol = (options.wsHost === '127.0.0.1' || options.wsHost === 'localhost') ? 'ws' : 'wss';
    // --- ASÍ ES COMO DEBE QUEDAR LA LÍNEA ---
    this.wsUrl = `${protocol}://${options.wsHost}:${options.wsPort}/app/${options.appKey}`;
    // ----------------------------------------

    console.log("ReverbWebSocketService: URL de conexión construida:", this.wsUrl);
  }

  // --- Métodos de Gestión de la Conexión Global ---

  public async connect(): Promise<string> {
    // Si ya hay una promesa de conexión en curso, la retornamos para evitar duplicados
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Si ya estamos conectados y tenemos un socketId, lo resolvemos inmediatamente
    if (this.globalWs && this.globalWs.readyState === WebSocket.OPEN && this.globalSocketId) {
      console.log("ReverbWebSocketService: Global WebSocket already connected. Socket ID:", this.globalSocketId);
      this.clearReconnectTimeout(); // Asegurarse de limpiar cualquier timeout pendiente
      this.reconnectAttempts = 0;
      return Promise.resolve(this.globalSocketId);
    }

    // Crear una nueva promesa de conexión
    this.connectionPromise = new Promise((resolve, reject) => {
      console.log("ReverbWebSocketService: Establishing new Global WebSocket connection to", this.wsUrl);
      try {
        const ws = new WebSocket(this.wsUrl);
        this.globalWs = ws;
        this.globalSocketId = null; // Reiniciar socketId al iniciar una nueva conexión

        ws.onopen = () => {
          console.log('ReverbWebSocketService: Global WebSocket opened!');
          this.reconnectAttempts = 0; // Resetear intentos al conectar exitosamente
          this.clearReconnectTimeout();
          this.emitGlobalEvent('connected'); // Emitir evento global de conexión
          // Reverb/Pusher espera un ping inicial para establecer el socket_id
          ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          // console.log('ReverbWebSocketService: Global WebSocket message:', message); // Para depuración

          if (message.event === 'pusher:connection_established') {
              const data = JSON.parse(message.data);
              this.globalSocketId = data.socket_id;
              console.log('ReverbWebSocketService: Global connection established, Socket ID:', this.globalSocketId);
              // ¡Aquí es donde la promesa `connect()` se resuelve!
              resolve(this.globalSocketId); // ESTO ES CLAVE
          } else if (message.event === 'pusher:pong') {
            // console.log('ReverbWebSocketService: Received global pong.');
          }

          // Despachar el mensaje a los listeners de canales específicos
          this.dispatchToChannelListeners(message);
        };

        ws.onclose = (event) => {
          console.warn('ReverbWebSocketService: Global WebSocket closed:', event.code, event.reason);
          this.globalSocketId = null;
          this.globalWs = null; // Limpiar la referencia para permitir nueva conexión
          this.connectionPromise = null; // Permitir un nuevo intento de conexión

          // Notificar a los listeners globales y de canales sobre la desconexión
          this.emitGlobalEvent('disconnected', event);
          this.channels.forEach(channel => {
            channel.listeners.get('disconnected')?.forEach(cb => cb());
          });

          this.attemptReconnect(); // Intentar reconectar
          reject(new Error(`WebSocket closed: ${event.code} - ${event.reason}`));
        };

        ws.onerror = (error) => {
          console.error('ReverbWebSocketService: Global WebSocket error:', error);
          this.globalSocketId = null;
          this.globalWs = null; // Limpiar la referencia
          this.connectionPromise = null; // Permitir un nuevo intento

          this.emitGlobalEvent('error', error); // Emitir evento global de error
          this.channels.forEach(channel => {
            channel.listeners.get('error')?.forEach(cb => cb(error));
          });

          this.attemptReconnect(); // Intentar reconectar también en caso de error
          reject(error);
        };

      } catch (e: any) {
        console.error('ReverbWebSocketService: Error creating global WebSocket:', e);
        this.connectionPromise = null; // Asegurarse de liberar la promesa en caso de error sincrónico
        reject(e);
      }
    });

    return this.connectionPromise;
  }

  // Lógica de reconexión exponencial
  private attemptReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("ReverbWebSocketService: Max reconnect attempts reached for global WebSocket. Not attempting further reconnects.");
      this.emitGlobalEvent('permanently_disconnected');
      return;
    }

    const delay = this.baseReconnectInterval * Math.pow(2, this.reconnectAttempts);
    console.log(`ReverbWebSocketService: Attempting reconnect in ${delay / 1000} seconds... (Attempt ${this.reconnectAttempts + 1})`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(e => console.error("ReverbWebSocketService: Reconnect failed during attempt:", e));
    }, delay);
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // --- Gestión de Listeners Globales ---
  private emitGlobalEvent(eventName: string, data?: any) {
    this.globalListeners.get(eventName)?.forEach(cb => cb(data));
  }

  public on(eventName: 'connected' | 'disconnected' | 'error' | 'permanently_disconnected', callback: Function) {
    if (!this.globalListeners.has(eventName)) {
      this.globalListeners.set(eventName, new Set());
    }
    this.globalListeners.get(eventName)?.add(callback);
  }

  public off(eventName: 'connected' | 'disconnected' | 'error' | 'permanently_disconnected', callback: Function) {
    this.globalListeners.get(eventName)?.delete(callback);
  }

  // --- Despacho de mensajes a canales ---
  // ReverbWebSocketService.ts (Solo la sección dispatchToChannelListeners)

// ...
// src/services/ReverbWebSocketService.ts (dentro de dispatchToChannelListeners)

// src/services/ReverbWebSocketService.ts (dentro de dispatchToChannelListeners)

private dispatchToChannelListeners(message: any) {
    if (message.channel && this.channels.has(message.channel)) {
        const channelData = this.channels.get(message.channel)!;

        // Notificar listeners de eventos específicos (primero los eventos directos del mensaje)
        channelData.listeners.get(message.event)?.forEach(cb => cb(message.data));

        // Manejar eventos internos de presencia
        if (message.event === 'pusher_internal:subscription_succeeded') {
            const data = JSON.parse(message.data);
            console.log('ReverbWebSocketService: pusher_internal:subscription_succeeded data:', data);

           if (data.presence && data.presence.data) {
                // Agrega este log para ver el contenido real
                console.log('ReverbWebSocketService: Contenido de data.presence.data:', data.presence.data);
                const members = new Map<string, any>();
                for (const userId in data.presence.data) {
                    const memberInfo = data.presence.data[userId];
                    members.set(String(memberInfo.id), memberInfo);
                }
                channelData.presenceMembers = members;
                console.log(`ReverbWebSocketService: Miembros de presencia populados: ${members.size} miembros. (Después de populación)`);
            } else {
                console.log('ReverbWebSocketService: pusher_internal:subscription_succeeded no contiene datos de presencia o está vacío.');
                channelData.presenceMembers = new Map();
            }

            // SEGUNDO: Disparar el evento 'subscribed' (confirmación de suscripción)
            channelData.listeners.get('subscribed')?.forEach(cb => cb());

            // TERCERO: Disparar el evento que informa al 'here' que los miembros están listos.
            // Esto se hace DESPUÉS de que channelData.presenceMembers ha sido definitivamente populado.
            channelData.listeners.get('subscribed_and_ready_for_here')?.forEach(cb => cb());


        } else if (message.event === 'pusher_internal:member_added') {
            const data = JSON.parse(message.data);
            console.log('ReverbWebSocketService: pusher_internal:member_added data:', data);

            const newMember = data.user_info;
            if (channelData.presenceMembers && newMember && newMember.id) {
                channelData.presenceMembers.set(String(newMember.id), newMember);
            }
            channelData.listeners.get('joining')?.forEach(cb => cb(newMember));

        } else if (message.event === 'pusher_internal:member_removed') {
            // ... (sin cambios) ...
        }
    }
}
  // --- Métodos para unirse a Canales (replicando Echo) ---

  // Método auxiliar para obtener o crear una estructura de canal
private getOrCreateChannelSubscription(channelName: string): ChannelSubscription {
    if (!this.channels.has(channelName)) {
      if (!this.globalWs || !this.globalSocketId) {
        throw new Error("Global WebSocket not connected. Cannot create channel subscription structure.");
      }
      this.channels.set(channelName, {
        ws: this.globalWs,
        socketId: this.globalSocketId,
        listeners: new Map(),
        presenceMembers: new Map() // <-- Asegúrate que esto siempre sea un Map
      });
    }
    return this.channels.get(channelName)!;
}

  // Método general para suscribirse a un canal (privado o de presencia)
  private async subscribeChannel(channelName: string, isPresence: boolean): Promise<EchoChannel> {
    const socketId = await this.connect();

    let authData: any = {};
    console.log(`ReverbWebSocketService: Realizando POST a ${this.options.authEndpoint} para canal ${channelName} con socketId ${socketId} y token ${this.options.token}`);
    try {
      // Autenticación para canales privados y de presencia
      const authResponse = await axios.post(
        this.options.authEndpoint,
        { channel_name: channelName, socket_id: socketId },
        { headers: { Authorization: `Bearer ${this.options.token}` } }
      );
      authData = authResponse.data;
      console.log(`ReverbWebSocketService: Auth successful for channel "${channelName}"`, authData); // Imprime la respuesta completa

    } catch (error: any) {
      console.error(`ReverbWebSocketService: FALLÓ la autenticación para canal "${channelName}":`, error.response?.data || error.message);
      // Notificar a los listeners de error del canal si ya existen
      const existingChannel = this.channels.get(channelName);
      existingChannel?.listeners.get('error')?.forEach(cb => cb(error));
      throw error; // Propagar el error
    }

    const subscriptionPayload: any = { // Aseguramos que sea 'any' para añadir propiedades dinámicamente
      event: 'pusher:subscribe',
      data: {
        channel: channelName,
        auth: authData.auth // El campo 'auth' viene de la respuesta de tu backend de Node.js
      }
    };
    if (isPresence && authData.channel_data) {
        // authData.channel_data ya es un string JSON de tu backend de Node.js
        subscriptionPayload.data.channel_data = authData.channel_data;
        console.log(`ReverbWebSocketService: Including channel_data for presence channel:`, authData.channel_data);
    }
    if (this.globalWs?.readyState === WebSocket.OPEN) {
      this.globalWs.send(JSON.stringify(subscriptionPayload));
      console.log(`ReverbWebSocketService: Sent subscription request for channel: "${channelName}"`);
    } else {
      console.error(`ReverbWebSocketService: Global WebSocket is not open to subscribe to "${channelName}".`);
      throw new Error("WebSocket not open for subscription.");
    }

    const channelSubscription = this.getOrCreateChannelSubscription(channelName);

    // Mock de objeto de canal Echo para usar en tus componentes
    const echoChannel: EchoChannel = {
      listen: (eventName: string, callback: Function) => {
        if (!channelSubscription.listeners.has(eventName)) {
          channelSubscription.listeners.set(eventName, new Set());
        }
        channelSubscription.listeners.get(eventName)?.add(callback);
      },
      listenForWhisper: (eventName: string, callback: Function) => {
        // Los whispers son eventos de cliente y vienen como 'client-eventName'
        // internamente, pero se escuchan como 'eventName'.
        // Aseguramos que el listener interno se registre para 'client-eventName'
        const fullEventName = `client-${eventName}`;
        if (!channelSubscription.listeners.has(fullEventName)) {
          channelSubscription.listeners.set(fullEventName, new Set());
        }
        channelSubscription.listeners.get(fullEventName)?.add((data: any) => callback(data));
      },
      whisper: (eventName: string, data: any) => {
        if (this.globalWs?.readyState === WebSocket.OPEN) {
          const whisperPayload = {
            event: `client-${eventName}`, // Eventos cliente tienen prefijo 'client-'
            channel: channelName,
            data: data
          };
          this.globalWs.send(JSON.stringify(whisperPayload));
        } else {
          console.warn(`ReverbWebSocketService: Cannot whisper, Global WebSocket is not open for channel "${channelName}".`);
        }
      },
      leave: () => {
        if (this.globalWs?.readyState === WebSocket.OPEN) {
          this.globalWs.send(JSON.stringify({
            event: 'pusher:unsubscribe',
            data: { channel: channelName }
          }));
          console.log(`ReverbWebSocketService: Sent unsubscribe request for channel: "${channelName}"`);
        }
        this.channels.delete(channelName); // Eliminar el canal del mapa
        console.log(`ReverbWebSocketService: Channel "${channelName}" left.`);
      },
      subscribed: (callback: Function) => {
        if (!channelSubscription.listeners.has('subscribed')) {
          channelSubscription.listeners.set('subscribed', new Set());
        }
        channelSubscription.listeners.get('subscribed')?.add(callback);
      },
      error: (callback: Function) => {
        if (!channelSubscription.listeners.has('error')) {
          channelSubscription.listeners.set('error', new Set());
        }
        channelSubscription.listeners.get('error')?.add(callback);
      },
      // Implementación para canales de presencia
      here: (callback: (members: any[]) => void) => {
        if (!isPresence) {
          console.warn(`ReverbWebSocketService: 'here' event is only available on presence channels. Channel: "${channelName}"`);
          return;
        }
        if (!channelSubscription.listeners.has('here')) {
          channelSubscription.listeners.set('here', new Set());
        }
        channelSubscription.listeners.get('here')?.add(callback);

        const fireHereIfReady = () => {
            // Revisa si ya hay miembros cuando este callback se dispara
            if (channelSubscription.presenceMembers && channelSubscription.presenceMembers.size > 0) {
                console.log(`ReverbWebSocketService: Disparando callback 'here' para canal "${channelName}" con ${channelSubscription.presenceMembers.size} miembros.`);
                callback(Array.from(channelSubscription.presenceMembers.values()));
            } else {
                 // Este log es el que estamos viendo. Es crucial que no lo veamos después de subscription_succeeded
                 console.log(`ReverbWebSocketService: 'here' callback registrado, pero miembros aún no disponibles para canal "${channelName}".`);
            }
        };

        // Registra el callback para cuando el canal esté suscrito y listo para el 'here'
        if (!channelSubscription.listeners.has('subscribed_and_ready_for_here')) {
            channelSubscription.listeners.set('subscribed_and_ready_for_here', new Set());
        }
        channelSubscription.listeners.get('subscribed_and_ready_for_here')?.add(fireHereIfReady);

        // Caso de borde: Si el listener `here` se añade *después* de que todo ya se disparó
        // (lo cual es menos común si sigues el patrón React useEffect),
        // intenta dispararlo de inmediato si ya estás suscrito y tienes miembros.
        // Pero el principal mecanismo es el `subscribed_and_ready_for_here`
        if (channelSubscription.listeners.get('subscribed')?.size > 0 && channelSubscription.presenceMembers?.size > 0) {
            fireHereIfReady();
        }
      },
      joining: (callback: (member: any) => void) => {
        if (!isPresence) {
          console.warn(`ReverbWebSocketService: 'joining' event is only available on presence channels. Channel: "${channelName}"`);
          return;
        }
        if (!channelSubscription.listeners.has('joining')) {
          channelSubscription.listeners.set('joining', new Set());
        }
        channelSubscription.listeners.get('joining')?.add(callback);
      },
      leaving: (callback: (member: any) => void) => {
        if (!isPresence) {
          console.warn(`ReverbWebSocketService: 'leaving' event is only available on presence channels. Channel: "${channelName}"`);
          return;
        }
        if (!channelSubscription.listeners.has('leaving')) {
          channelSubscription.listeners.set('leaving', new Set());
        }
        channelSubscription.listeners.get('leaving')?.add(callback);
      },
      get members() {
        if (!isPresence) {
            console.warn(`ReverbWebSocketService: 'members' property is only available on presence channels. Channel: "${channelName}"`);
            return new Map();
        }
        return channelSubscription.presenceMembers || new Map();
      }
    };

    return echoChannel;
  }

  // Métodos públicos para unirse a diferentes tipos de canales
  public join(channelName: string): Promise<EchoChannel> {
    // Los canales públicos en Reverb son simplemente canales privados sin autenticación Laravel (no necesitan 'private-')
    // Sin embargo, Echo los maneja de forma diferente. Para compatibilidad, vamos a considerarlos como privados aquí
    // ya que necesitan el 'socket_id' para unirse.
    // Si tu canal 'video-room.{roomId}' es verdaderamente público y no requiere auth,
    // puedes omitir el paso de 'authEndpoint' en 'subscribeChannel'.
    // Pero si Laravel Reverb requiere auth para CUALQUIER canal (como suele ser con Redis/Pusher),
    // entonces lo mantenemos como si fuera un canal "privado" en su suscripción lógica.
    return this.subscribeChannel(channelName, false);
  }

  public private(channelName: string): Promise<EchoChannel> {
    return this.subscribeChannel(`private-${channelName}`, false); // Prefijo 'private-'
  }

  public presence(channelName: string): Promise<EchoChannel> {
      return this.subscribeChannel(`presence-${channelName}`, true); // Pide "presence-video-room.10"
  }

  // Método para cerrar todas las conexiones y limpiar
  public disconnect() {
    console.log("ReverbWebSocketService: Disconnecting all channels and global WebSocket.");
    if (this.globalWs) {
      this.globalWs.close(1000, "Client initiated disconnect");
      this.globalWs = null;
      this.globalSocketId = null;
    }
    this.channels.clear();
    this.globalListeners.clear();
    this.clearReconnectTimeout();
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
  }
}

// --- Singleton para usar en toda la aplicación ---
// Esto asegura que solo haya una instancia del servicio WebSocket.
// ... (código anterior) ...

// Define la URL base de tu API desde las variables de entorno de Vite
// ReverbWebSocketService.ts

const API_URL = import.meta.env.VITE_API_URL; // Esto será 'https://english-meet.duckdns.org/api/v1' en prod, o 'http://localhost:8000/api/v1' en local

let reverbServiceInstance: ReverbWebSocketService | null = null;

export const createReverbWebSocketService = (token: string): ReverbWebSocketService => {
  if (!reverbServiceInstance) {
    const appKey = 'sfnheugrsf0hhvj0k6oo'; // Tu APP_KEY de Reverb

    const apiUrlParsed = new URL(API_URL);
    const apiHost = apiUrlParsed.hostname;

    let wsHost: string;
    let wsPort: number;
    let authEndpoint: string;
    let forceTLS: boolean;

    // Detectar si estamos en producción (basado en el dominio)
    if (apiHost === 'english-meet.duckdns.org') {
      wsHost = apiHost;
      wsPort = 443; // En producción, usamos el puerto HTTPS estándar
      authEndpoint = `https://${apiHost}/broadcasting/auth`; // Sin el puerto 3000, Apache lo redirige
      forceTLS = true; // Forzamos HTTPS
    } else {
      // Entorno local (desarrollo)
      wsHost = '127.0.0.1'; // O 'localhost' si tu Node.js escucha ahí
      wsPort = 3000; // Puerto interno del servidor Node.js
      authEndpoint = `${apiUrlParsed.protocol}//${apiHost}:${wsPort}/broadcasting/auth`; // O tu IP local
      forceTLS = false; // No forzar TLS en local
    }

    console.log("ReverbService: Usando wsHost:", wsHost);
    console.log("ReverbService: Usando wsPort:", wsPort);
    console.log("ReverbService: Usando authEndpoint:", authEndpoint);

    reverbServiceInstance = new ReverbWebSocketService({
      appKey,
      wsHost,
      wsPort,
      authEndpoint,
      token,
      forceTLS, // Pasa la configuración de fuerza TLS
      // Agrega wssPort si tu ReverbWebSocketService lo usa. Suele ser lo mismo que wsPort si forceTLS es true
      wssPort: wsPort,
      // encrypted: forceTLS, // Alias para forceTLS, si tu librería de Pusher lo usa
      // cluster: 'mt1' // Si es Reverb, NO necesitas cluster
    });
  } else {
    reverbServiceInstance.setToken(token);
  }
  return reverbServiceInstance;
};
// ... (resto del código) ...

// Extensión para la clase ReverbWebSocketService para actualizar el token
declare module './ReverbWebSocketService' {
  interface ReverbWebSocketService {
    setToken(token: string): void;
  }
}

ReverbWebSocketService.prototype.setToken = function(token: string) {
  if (this.options.token !== token) {
    console.log("ReverbWebSocketService: Updating token.");
    this.options.token = token;
    // No reconectamos automáticamente aquí, la próxima suscripción usará el nuevo token.
    // Si necesitas que los canales ya suscritos usen el nuevo token de inmediato,
    // tendrías que re-suscribirlos o considerar el ciclo de vida del token.
  }
};