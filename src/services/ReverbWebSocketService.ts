// src/services/ReverbWebSocketService.ts

import axios from 'axios';

// --- Interfaces para tipar los datos ---

interface WebSocketServiceOptions {
  appKey: string;
  wsHost: string;
  wsPort: number;
  authEndpoint: string;
  token: string; // El token de autenticación del usuario
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
    // URL completa para la conexión WebSocket de Reverb
    // wsHost y wsPort ya deben incluir wss:// y el puerto
    this.wsUrl = `wss://${options.wsHost}:${options.wsPort}/app/${options.appKey}`;

    // Desactivar logs de Pusher.js si aún estuvieran en window
    // if (window.Pusher) {
    //   window.Pusher.logToConsole = false;
    // }
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
            resolve(this.globalSocketId); // Resolver la promesa con el socketId
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
  private dispatchToChannelListeners(message: any) {
    // Si el mensaje tiene un canal asociado, lo despachamos a los listeners de ese canal
    if (message.channel && this.channels.has(message.channel)) {
      const channelData = this.channels.get(message.channel)!;
      // Notificar listeners de eventos específicos (incluyendo "client-" whispers si vienen de otro cliente)
      channelData.listeners.get(message.event)?.forEach(cb => cb(message.data));

      // Manejar eventos internos de presencia
      if (message.event === 'pusher_internal:subscription_succeeded') {
       const data = JSON.parse(message.data); // message.data es "{}" en tus logs actuales
        if (data.presence) { // Esto será `undefined` si message.data es "{}"
          const members = new Map<string, any>();
          // Revisa esta parte: data.presence.data[userId].user_info
          // Debería ser `data.presence.data[userId]` si tu backend envía la información del miembro directamente ahí.
          // El formato correcto de `pusher_internal:subscription_succeeded` es `data: { presence: { ids: [], hash: {}, data: {} } }`
          // Donde `data` bajo `presence` contiene la información detallada de cada usuario por ID.
          for (const userId in data.presence.data) {
            const memberInfo = data.presence.data[userId].user_info; // <-- ¡CUIDADO AQUÍ!
            members.set(userId, memberInfo);
          }
          channelData.presenceMembers = members;
          // Disparar el evento 'here'
          channelData.listeners.get('here')?.forEach(cb => cb(Array.from(members.values())));
        }
        channelData.listeners.get('subscribed')?.forEach(cb => cb());

      } else if (message.event === 'pusher_internal:member_added') {
        const data = JSON.parse(message.data); // data es "{}" en tus logs actuales
        const newMember = data.user_info; // <-- ¡CUIDADO AQUÍ!
        if (channelData.presenceMembers) {
          channelData.presenceMembers.set(newMember.id.toString(), newMember);
        }
        channelData.listeners.get('joining')?.forEach(cb => cb(newMember));
      } else if (message.event === 'pusher_internal:member_removed') {
        const parsedMessageData = JSON.parse(message.data);
        const removedMemberId = parsedMessageData.user_id.toString(); 
        const removedMember = channelData.presenceMembers?.get(removedMemberId); 
        channelData.presenceMembers?.delete(removedMemberId);
        channelData.listeners.get('leaving')?.forEach(cb => cb(removedMember || { id: removedMemberId }));
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
        presenceMembers: new Map() // Inicializar para presencia por si acaso
      });
    }
    return this.channels.get(channelName)!;
  }

  // Método general para suscribirse a un canal (privado o de presencia)
  private async subscribeChannel(channelName: string, isPresence: boolean): Promise<EchoChannel> {
    const socketId = await this.connect(); // Asegurarse de que la conexión global esté establecida

    let authData: any = {};
    try {
      // Autenticación para canales privados y de presencia
      const authResponse = await axios.post(
        this.options.authEndpoint,
        { channel_name: channelName, socket_id: socketId },
        { headers: { Authorization: `Bearer ${this.options.token}` } }
      );
      authData = authResponse.data;
      console.log(`ReverbWebSocketService: Auth successful for channel "${channelName}"`);

    } catch (error: any) {
      console.error(`ReverbWebSocketService: Failed to authenticate for channel "${channelName}":`, error.response?.data || error.message);
      // Notificar a los listeners de error del canal si ya existen
      const existingChannel = this.channels.get(channelName);
      existingChannel?.listeners.get('error')?.forEach(cb => cb(error));
      throw error; // Propagar el error
    }

    const subscriptionPayload = {
      event: 'pusher:subscribe',
      data: {
        channel: channelName,
        auth: authData.auth // El campo 'auth' viene de la respuesta de Laravel
      }
    };

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
        // Si ya tenemos miembros, los pasamos inmediatamente
        if (channelSubscription.presenceMembers && channelSubscription.presenceMembers.size > 0) {
            callback(Array.from(channelSubscription.presenceMembers.values()));
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
      return this.subscribeChannel(`${channelName}`, true); // Pide "presence-video-room.10"
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

let reverbServiceInstance: ReverbWebSocketService | null = null;

export const createReverbWebSocketService = (token: string): ReverbWebSocketService => {
  if (!reverbServiceInstance) {
    const appKey = 'sfnheugrsf0hhvj0k6oo'; // Tu APP_KEY de Reverb
    const wsHost = 'english-meet.duckdns.org'; // Tu WSS_HOST
    const wsPort = 443; // Tu WSS_PORT (normalmente 443 para HTTPS)
    const authEndpoint = 'https://english-meet.duckdns.org/broadcasting/auth'; // Tu AUTH_ENDPOINT

    reverbServiceInstance = new ReverbWebSocketService({
      appKey,
      wsHost,
      wsPort,
      authEndpoint,
      token,
    });
  } else {
    // Si la instancia ya existe, asegúrate de actualizar el token si ha cambiado
    // Esto es importante si el token puede expirar y refrescarse.
    reverbServiceInstance.setToken(token); // Necesitas un método setToken
  }
  return reverbServiceInstance;
};

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