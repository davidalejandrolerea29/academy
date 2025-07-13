// src/services/ReverbWebSocketService.ts

import axios from 'axios';
import EventEmitter from 'events';
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
  lastProcessedMessageId?: number;
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
  onMissedMessages: (callback: (messages: any[]) => void) => void; // Para escuchar mensajes perdidos
  setLastProcessedMessageId: (messageId: number) => void; // Para que el componente actualice el ID

  // Propiedad para acceder a los miembros actuales del canal de presencia (solo lectura)
  members: Map<string, any>; // Devuelve un Map<string, any>
}


// --- Clase Principal del Servicio WebSocket ---

// --- Clase Principal del Servicio WebSocket ---

export class ReverbWebSocketService extends EventEmitter {
  private options: WebSocketServiceOptions;
  private wsUrl: string;
  private globalWs: WebSocket | null = null;
  private globalSocketId: string | null = null;
  private channels: Map<string, ChannelSubscription> = new Map();
  private globalListeners: Map<string, Set<Function>> = new Map();

  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectInterval = 1000;

  private connectionPromise: Promise<string> | null = null;
  private activeChannelNames: Map<string, { isPresence: boolean, lastProcessedMessageId?: number }> = new Map();

  private pingIntervalId: NodeJS.Timeout | null = null;
  private pongTimeoutId: NodeJS.Timeout | null = null;
  private pingIntervalTime = 25000;
  private pongTimeoutTime = 5000;

  private _isConnected: boolean = false;
  private _isConnecting: boolean = false;

  constructor(options: WebSocketServiceOptions) {
    super();
    this.options = options;
    const protocol = (options.wsHost === '127.0.0.1' || options.wsHost === 'localhost') ? 'ws' : 'wss';
    const port = options.forceTLS ? options.wssPort : options.wsPort;
    this.wsUrl = `${protocol}://${options.wsHost}:${port}/app/${options.appKey}`;

    console.log("ReverbWebSocketService: Instancia creada. URL de conexión:", this.wsUrl);
    this.setConnectionState(false, true); // Estado inicial
  }

  private setConnectionState(isConnected: boolean, isConnecting: boolean) {
    const wasConnected = this._isConnected; // Guarda el estado anterior
    const wasConnecting = this._isConnecting;

    if (this._isConnected !== isConnected) {
      this._isConnected = isConnected;
      console.log(`[ReverbWebSocketService Internal State] _isConnected: ${this._isConnected}`);
    }
    if (this._isConnecting !== isConnecting) {
      this._isConnecting = isConnecting;
      console.log(`[ReverbWebSocketService Internal State] _isConnecting: ${this._isConnecting}`);
    }

    // Emitir eventos basados en la transición de estado
    if (isConnected && !wasConnected) {
        this.emit('connected');
    } else if (!isConnected && wasConnected) {
        this.emit('disconnected');
    }
    // No necesitamos emitir 'connecting_changed' si 'connected'/'disconnected' son suficientes para el UI
  }

  public getIsConnected(): boolean {
    return this._isConnected;
  }

  public getIsConnecting(): boolean {
    return this._isConnecting;
  }

  public async connect(): Promise<string> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.globalWs && this.globalWs.readyState === WebSocket.OPEN && this.globalSocketId) {
      this.clearReconnectTimeout();
      this.reconnectAttempts = 0;
      this.startPingPong();
      this.setConnectionState(true, false);
      return Promise.resolve(this.globalSocketId);
    }

    this.setConnectionState(false, true); // Intentando conectar

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.wsUrl);
        this.globalWs = ws;
        this.globalSocketId = null;

        ws.onopen = () => {
          console.log('ReverbWebSocketService: Global WebSocket opened!');
          console.log(`ReverbWebSocketService: Estado de red en 'onopen': navigator.onLine = ${navigator.onLine}`); // <--- Añadido
          this.reconnectAttempts = 0;
          this.clearReconnectTimeout();
          this.setConnectionState(true, false);
          this.emit('connected');
          this.startPingPong();
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          if (message.event === 'pusher:connection_established') {
            const data = JSON.parse(message.data);
            this.globalSocketId = data.socket_id;
            console.log('ReverbWebSocketService: Global connection established, Socket ID:', this.globalSocketId);
            resolve(this.globalSocketId);

            this.activeChannelNames.forEach(async (channelInfo, channelName) => {
              try {
                console.log(`ReverbWebSocketService: Re-subscribing to channel: ${channelName}`);
                await this.subscribeChannel(channelName, channelInfo.isPresence);
              } catch (error) {
                console.error(`ReverbWebSocketService: Failed to re-subscribe to channel ${channelName}:`, error);
              }
            });
          } else if (message.event === 'pusher:pong') {
            this.clearPongTimeout();
          }

          this.dispatchToChannelListeners(message);
        };

        ws.onclose = (event) => {
    console.warn(`ReverbWebSocketService: onclose event - Global WebSocket closed! Code: ${event.code}, Reason: ${event.reason}`);
    console.log(`ReverbWebSocketService: Estado de red en 'onclose': navigator.onLine = ${navigator.onLine}`);

    this.stopPingPong();
    this.clearPongTimeout();

    this.globalSocketId = null;
    this.globalWs = null;
    this.connectionPromise = null;

    // Si el código NO es 1000 (cierre normal) O es nuestro código de PONG TIMEOUT (4000)
    if (event.code !== 1000 || event.code === 4000) { 
        console.log("ReverbWebSocketService: Cierre anormal o por PONG TIMEOUT detectado. Iniciando intento de reconexión.");
        this.setConnectionState(false, true); // Desconectado, intentando reconectar
        this.attemptReconnect();
    } else {
        console.log("ReverbWebSocketService: Cierre normal (código 1000). No se intenta reconectar automáticamente.");
        this.setConnectionState(false, false); // Desconectado, no reconectando (cierre normal)
    }
    this.emit('disconnected', event);
};

// Asegúrate de que el onerror también llame a attemptReconnect()
ws.onerror = (error) => {
    console.error('ReverbWebSocketService: Global WebSocket error:', error);
    console.log(`ReverbWebSocketService: Estado de red en 'onerror': navigator.onLine = ${navigator.onLine}`);
    this.stopPingPong();
    this.clearPongTimeout();

    this.globalSocketId = null;
    this.globalWs = null;
    this.connectionPromise = null;
    this.setConnectionState(false, false); // Error, está desconectado
    this.emit('error', error);
    this.attemptReconnect(); // <--- CRUCIAL: Asegúrate de que esto siempre esté aquí
};

      } catch (e: any) {
        console.error('ReverbWebSocketService: Error creating global WebSocket:', e);
        this.connectionPromise = null;
        this.setConnectionState(false, false);
        reject(e);
      }
    });

    return this.connectionPromise;
  }

private startPingPong() {
  this.stopPingPong();
  this.clearPongTimeout();
  console.log(`ReverbWebSocketService: Iniciando Ping-Pong. Ping cada ${this.pingIntervalTime / 1000}s, Pong timeout ${this.pongTimeoutTime / 1000}s.`);
  this.pingIntervalId = setInterval(() => {
    if (this.globalWs && this.globalWs.readyState === WebSocket.OPEN) {
      console.log('ReverbWebSocketService: Enviando ping...');
      this.globalWs.send(JSON.stringify({ event: 'pusher:ping', data: {} }));

      this.clearPongTimeout(); // Limpiar el timeout anterior antes de crear uno nuevo.
      this.pongTimeoutId = setTimeout(() => {
        console.warn('ReverbWebSocketService: ¡PONG TIMEOUT! Cerrando WebSocket debido a inactividad.');
        if (this.globalWs) {
          this.globalWs.close(4000, "Pong Timeout Detected"); // Usar un código personalizado para identificarlo
        }
        // Importante: No llamar attemptReconnect() aquí, deja que el onclose lo haga
        // para mantener la lógica de reconexión centralizada en onclose/onerror.
        // La clave es el código 4000 que lo marcará como NO-NORMAL.
      }, this.pongTimeoutTime);
    } else {
      console.warn('ReverbWebSocketService: Intentando enviar ping, pero WebSocket no está OPEN. Deteniendo ping-pong.');
      this.stopPingPong();
      this.clearPongTimeout();
    }
  }, this.pingIntervalTime);
}

  private stopPingPong() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private clearPongTimeout() {
    if (this.pongTimeoutId) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    if (this._isConnected) {
      console.log("ReverbWebSocketService: Ya conectado, cancelando intento de reconexión.");
      this.reconnectAttempts = 0;
      this.setConnectionState(true, false);
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("ReverbWebSocketService: Máximo de intentos de reconexión alcanzado. No se intentará más.");
      this.setConnectionState(false, false);
      this.emit('permanently_disconnected');
      return;
    }

    const delay = this.baseReconnectInterval * Math.pow(2, this.reconnectAttempts);
    console.log(`ReverbWebSocketService: Intentando reconectar en ${delay / 1000} segundos... (Intento ${this.reconnectAttempts + 1})`);
    this.setConnectionState(false, true);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(e => {
        console.error("ReverbWebSocketService: Error en intento de reconexión:", e);
        this.setConnectionState(false, false);
        this.attemptReconnect();
      });
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

        const parsedData = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;

        // --- MANEJO DE EVENTOS INTERNOS DE REVERB/PUSHER ---
        // Estos eventos tienen prioridad y son manejados por su nombre exacto.
       
        if (message.event === 'pusher_internal:subscription_succeeded') {
            // console.log(`ReverbWebSocketService: Recibido pusher_internal:subscription_succeeded para canal: ${message.channel}`);
            if (parsedData.presence && parsedData.presence.data) {
                const members = new Map<string, any>();
                for (const userId in parsedData.presence.data) {
                    const memberInfo = parsedData.presence.data[userId];
                    members.set(String(memberInfo.id), memberInfo);
                }
                channelData.presenceMembers = members;
            } else {
                channelData.presenceMembers = new Map();
            }
            channelData.listeners.get('subscribed')?.forEach(cb => cb());
            channelData.listeners.get('subscribed_and_ready_for_here')?.forEach(cb => cb());
            
            // Si el canal es de presencia, dispara el evento 'here' aquí, después de que los miembros se hayan establecido
            // Esto es crucial para que `here` reciba la lista inicial
            if (message.channel.startsWith('presence-') && channelData.listeners.has('here')) {
                 // console.log(`ReverbWebSocketService: Disparando 'here' para canal: ${message.channel}`);
                 channelData.listeners.get('here')?.forEach(cb => cb(Array.from(channelData.presenceMembers!.values())));
             }

        } else if (message.event === 'pusher_internal:member_added') {
            // console.log(`ReverbWebSocketService: Recibido pusher_internal:member_added para canal: ${message.channel}`);
            const newMember = parsedData.user_info;
            if (channelData.presenceMembers && newMember && newMember.id) {
                channelData.presenceMembers.set(String(newMember.id), newMember);
            }
            channelData.listeners.get('joining')?.forEach(cb => cb(newMember));

        } else if (message.event === 'pusher_internal:member_removed') {
            // console.log(`ReverbWebSocketService: Recibido pusher_internal:member_removed para canal: ${message.channel}`);
            const removedMember = parsedData.user_info;
            if (channelData.presenceMembers && removedMember && removedMember.id) {
                channelData.presenceMembers.delete(String(removedMember.id));
            }
            channelData.listeners.get('leaving')?.forEach(cb => cb(removedMember));

        } else if (message.event.startsWith('client-')) {
            // Estos son los whispers. Se registran con 'client-' prefix.
            // console.log(`ReverbWebSocketService: Recibido client-whisper para canal: ${message.channel}, evento: ${message.event}`);
            channelData.listeners.get(message.event)?.forEach(cb => cb(parsedData));

        } else {
            // --- MANEJO DE EVENTOS DE APLICACIÓN PERSONALIZADOS ---
            // Intenta buscar el listener con el nombre de evento EXACTO (sin punto).
            // Esto cubre casos como 'GroupMessageSent' o 'CallSignal' donde el frontend no usa '.'.
            let dispatched = false;
            if (channelData.listeners.has(message.event)) {
                // console.log(`ReverbWebSocketService: Disparando evento de APP (sin punto) para canal "${message.channel}", evento "${message.event}"`);
                channelData.listeners.get(message.event)?.forEach(cb => cb(parsedData));
                dispatched = true;
            }

            // Si no se despachó y el evento no empieza con punto, intenta con el punto.
            // Esto cubre casos como '.messagecreatedprivate' donde el frontend sí usa '.'.
            if (!dispatched && !message.event.startsWith('.')) {
                const eventWithDot = `.${message.event}`;
                if (channelData.listeners.has(eventWithDot)) {
                    // console.log(`ReverbWebSocketService: Disparando evento de APP (con punto) para canal "${message.channel}", evento "${eventWithDot}"`);
                    channelData.listeners.get(eventWithDot)?.forEach(cb => cb(parsedData));
                    dispatched = true;
                }
            }
            // Opcional: Log si un evento no se despachó para depuración
            // if (!dispatched) {
            //     console.warn(`ReverbWebSocketService: Evento no despachado para canal "${message.channel}", evento "${message.event}". No hay listener registrado para este formato.`);
            // }
        }
        if (message.event === 'messagecreatedprivate' && parsedData.message?.id) {
            // Actualiza el ID del último mensaje procesado
           if (channelData.lastProcessedMessageId === undefined || parsedData.message.id > channelData.lastProcessedMessageId) {
                channelData.lastProcessedMessageId = parsedData.message.id; // <-- Asignación directa
            }
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
    //console.log(`ReverbWebSocketService: Realizando POST a ${this.options.authEndpoint} para canal ${channelName} con socketId ${socketId} y token ${this.options.token}`);
    try {
      // Autenticación para canales privados y de presencia
      const authResponse = await axios.post(
        this.options.authEndpoint,
        { channel_name: channelName, socket_id: socketId },
        { headers: { Authorization: `Bearer ${this.options.token}` } }
      );
      authData = authResponse.data;
      //console.log(`ReverbWebSocketService: Auth successful for channel "${channelName}"`, authData); // Imprime la respuesta completa

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
        //console.log(`ReverbWebSocketService: Including channel_data for presence channel:`, authData.channel_data);
    }
    if (this.globalWs?.readyState === WebSocket.OPEN) {
      this.globalWs.send(JSON.stringify(subscriptionPayload));
      //console.log(`ReverbWebSocketService: Sent subscription request for channel: "${channelName}"`);
    } else {
      console.error(`ReverbWebSocketService: Global WebSocket is not open to subscribe to "${channelName}".`);
      throw new Error("WebSocket not open for subscription.");
    }

    const channelSubscription = this.getOrCreateChannelSubscription(channelName);
    if (channelSubscription.lastProcessedMessageId !== undefined && channelSubscription.lastProcessedMessageId !== null) {
        let contactIdForApi: string | null = null;

        if (this.currentUserId) {
            const parts = channelName.split('.');
            if (parts.length > 1) {
                const type = parts[0];
                const idsString = parts[1];

                if (type === 'private-room') {
                    const ids = idsString.split('-');
                    if (ids.length === 2) {
                        contactIdForApi = (ids[0] === String(this.currentUserId)) ? ids[1] : ids[0];
                    }
                } else if (type === 'private-user') {
                    contactIdForApi = idsString;
                }
            }
        }

        if (!contactIdForApi) {
            console.warn(`ReverbWebSocketService: Could not determine contact_id from channel name '${channelName}' for message recovery. Skipping missed messages.`);
        } else {
            try {
                const missedMessagesResponse = await axios.get(
                    `${this.options.apiUrl}/auth/privatechat/after/${channelSubscription.lastProcessedMessageId}?contact_id=${contactIdForApi}`,
                    { headers: { Authorization: `Bearer ${this.options.token}` } }
                );

                const missedMessages = missedMessagesResponse.data.messages;

                if (Array.isArray(missedMessages)) {
                    console.log(`ReverbWebSocketService: Retrieved ${missedMessages.length} missed messages for channel ${channelName}.`);

                    channelSubscription.listeners.get('missed_messages')?.forEach(cb => cb(missedMessages));

                    if (missedMessages.length > 0) {
                        const latestMissedId = Math.max(...missedMessages.map((m: any) => m.id));
                        // --- ¡ESTA ES LA LÍNEA MODIFICADA! ---
                        channelSubscription.lastProcessedMessageId = latestMissedId; // <-- Asigna directamente
                        // ------------------------------------
                        console.log(`ReverbWebSocketService: Updated lastProcessedMessageId for ${channelName} to ${latestMissedId}`);
                    }
                } else {
                    console.warn(`ReverbWebSocketService: API response for missed messages on channel ${channelName} did not contain a valid 'messages' array.`, missedMessagesResponse.data);
                }

            } catch (error: any) {
                console.error(`ReverbWebSocketService: Failed to retrieve missed messages for channel ${channelName}:`, error.response?.data || error.message);
            }
        }
    }
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
          //console.log(`ReverbWebSocketService: Sent unsubscribe request for channel: "${channelName}"`);
        }
        this.channels.delete(channelName); // Eliminar el canal del mapa
        //console.log(`ReverbWebSocketService: Channel "${channelName}" left.`);
      },
      subscribed: (callback: Function) => {
        if (!channelSubscription.listeners.has('subscribed')) {
          channelSubscription.listeners.set('subscribed', new Set());
        }
        channelSubscription.listeners.get('subscribed')?.add(callback);
      },
      onMissedMessages: (callback: (messages: any[]) => void) => {
          if (!channelSubscription.listeners.has('missed_messages')) {
              channelSubscription.listeners.set('missed_messages', new Set());
          }
          channelSubscription.listeners.get('missed_messages')?.add(callback);
      },

      // Método para actualizar el lastProcessedMessageId desde el componente de chat
     setLastProcessedMessageId: (messageId: number) => {
          channelSubscription.lastProcessedMessageId = messageId; // <-- Asigna directamente aquí también
          // También es buena idea actualizar el activeChannelNames map si lo estás usando como fuente de verdad
          const currentChannelInfo = this.activeChannelNames.get(channelName);
          if (currentChannelInfo) {
              this.activeChannelNames.set(channelName, {
                  ...currentChannelInfo,
                  lastProcessedMessageId: messageId
              });
          }
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
                //console.log(`ReverbWebSocketService: Disparando callback 'here' para canal "${channelName}" con ${channelSubscription.presenceMembers.size} miembros.`);
                callback(Array.from(channelSubscription.presenceMembers.values()));
            } else {
                 // Este log es el que estamos viendo. Es crucial que no lo veamos después de subscription_succeeded
                 //console.log(`ReverbWebSocketService: 'here' callback registrado, pero miembros aún no disponibles para canal "${channelName}".`);
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
  public async join(channelName: string): Promise<EchoChannel> {
      // Registrar que este canal está "activo"
      this.activeChannelNames.set(channelName, { isPresence: false });
      return await this.subscribeChannel(channelName, false);
  }
  // Añade un método que no añada prefijos
  public customChannel(channelName: string): Promise<EchoChannel> {
      return this.subscribeChannel(channelName, false); // No añade prefijo, ni es de presencia
  }
  public async private(channelName: string): Promise<EchoChannel> {
      this.activeChannelNames.set(channelName, { isPresence: false });
      return await this.subscribeChannel(channelName, false);
  }
  public async presence(channelName: string): Promise<EchoChannel> {
      const presenceChannelFullName = `presence-${channelName}`;
      this.activeChannelNames.set(presenceChannelFullName, { isPresence: true });
      return await this.subscribeChannel(presenceChannelFullName, true);
  }

  // Método para cerrar todas las conexiones y limpiar
    public disconnect() {
    console.log("ReverbWebSocketService: Desconexión solicitada por la aplicación.");
    this.clearReconnectTimeout();
    this.stopPingPong();
    this.clearPongTimeout();
    if (this.globalWs) {
      this.globalWs.close(1000, "App disconnected");
    }
    this.globalSocketId = null;
    this.globalWs = null;
    this.connectionPromise = null;
    this.setConnectionState(false, false);
    this.channels.clear();
    this.activeChannelNames.clear();
    this.emit('disconnected', new CloseEvent('close', { code: 1000, reason: "App disconnected" }));
  }

  // --- Nueva función para establecer el token y forzar reconexión si cambia ---
  public setToken(token: string): void {
    if (this.options.token !== token) {
      console.log("ReverbWebSocketService: Token de usuario ha cambiado. Forzando reconexión.");
      this.options.token = token;
      this.disconnect(); // Desconecta la instancia actual
      this.connect();    // Intenta reconectar con el nuevo token
    }
  }
}

// --- Singleton para usar en toda la aplicación ---
// Esto asegura que solo haya una instancia del servicio WebSocket.
// ... (código anterior) ...

// Define la URL base de tu API desde las variables de entorno de Vite
// ReverbWebSocketService.ts

const API_URL = import.meta.env.VITE_API_URL; // Esto será 'https://portalnewpath.com/api/v1' en prod, o 'http://localhost:8000/api/v1' en local

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
    if (apiHost === 'portalnewpath.com') {
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

    //console.log("ReverbService: Usando wsHost:", wsHost);
    //console.log("ReverbService: Usando wsPort:", wsPort);
    //console.log("ReverbService: Usando authEndpoint:", authEndpoint);

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
    //console.log("ReverbWebSocketService: Updating token.");
    this.options.token = token;
    // No reconectamos automáticamente aquí, la próxima suscripción usará el nuevo token.
    // Si necesitas que los canales ya suscritos usen el nuevo token de inmediato,
    // tendrías que re-suscribirlos o considerar el ciclo de vida del token.
  }
};