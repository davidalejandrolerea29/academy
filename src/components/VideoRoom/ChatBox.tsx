// src/components/ChatBox/ChatBox.tsx
import React, { useEffect, useState, useRef } from 'react';

export interface Message {
  sender: string;
  text: string;
}

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (text: string) => Promise<void>;
  currentUserName: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, currentUserName }) => {
  const [chatInput, setChatInput] = useState('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(chatInput.trim());
      setChatInput('');
      setWarningMessage(null);
    } catch (error: any) {
      console.error('[ChatBox] Error sending message:', error);
      setWarningMessage(error.message || 'Error al enviar mensaje');
      setTimeout(() => setWarningMessage(null), 5000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Warning message */}
      {warningMessage && (
        <div className="bg-red-500 text-white p-3 text-sm border-b border-red-600">
          {warningMessage}
        </div>
      )}

      {/* Messages container with scroll */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {messages.map((msg, index) => {
          const isCurrentUser = msg.sender === currentUserName;
          return (
            <div
              key={index}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 ${isCurrentUser
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-white'
                  }`}
              >
                <div className="font-semibold text-sm mb-1 opacity-90">
                  {msg.sender}
                </div>
                <div className="text-white break-words">{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="p-4 bg-gray-900 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={isSending}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !chatInput.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatBox;