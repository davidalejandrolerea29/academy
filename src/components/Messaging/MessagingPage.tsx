import React, { useState } from 'react';
import ContactsList from './ContactsList';
import Chat from './Chat';
import { User } from '../../types';
import { MessageSquare } from 'lucide-react';

const MessagingPage: React.FC = () => {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactData, setSelectedContactData] = useState<User | null>(null);
  const [mobileView, setMobileView] = useState<'contacts' | 'chat'>(
    'contacts'
  );

const handleSelectContact = (userId: number, userData: User) => {
  setSelectedContactId(userId.toString());
  setSelectedContactData(userData);
  setMobileView('chat');
};


  const handleBackToContacts = () => {
    setMobileView('contacts');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white shadow p-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800 flex items-center">
          <MessageSquare className="w-6 h-6 mr-2 text-blue-500" />
          Mensajes
        </h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile navigation for contacts/chat toggle */}
        <div className="lg:hidden flex items-center justify-between p-2 bg-gray-100 border-b">
          <button
            onClick={() => setMobileView('contacts')}
            className={`px-3 py-1 rounded ${
              mobileView === 'contacts' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700'
            }`}
          >
            Contactos
          </button>
          <button
            onClick={() => setMobileView('chat')}
            disabled={!selectedContactId}
            className={`px-3 py-1 rounded ${
              mobileView === 'chat' && selectedContactId
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700'
            } ${!selectedContactId ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Chat
          </button>
        </div>

        {/* Contacts list - hidden on mobile when chat is active */}
        <div 
          className={`
            ${mobileView === 'contacts' ? 'block' : 'hidden'} 
            lg:block lg:w-1/3 border-r
          `}
        >
          <ContactsList 
            onSelectContact={handleSelectContact}
            selectedContactId={selectedContactId}
          />
        </div>

        {/* Chat area - hidden on mobile when contacts are active */}
        <div 
          className={`
            ${mobileView === 'chat' ? 'block' : 'hidden'} 
            lg:block lg:w-2/3
          `}
        >
          {selectedContactId && selectedContactData ? (
            <>
              {/* Mobile back button */}
              <div className="lg:hidden p-2 bg-gray-100 border-b">
                <button
                  onClick={handleBackToContacts}
                  className="text-blue-500"
                >
                  ← Volver a contactos
                </button>
              </div>
              <Chat
                recipientId={selectedContactId}
                recipientData={selectedContactData}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
              <p>Selecciona un contacto para comenzar a chatear</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;