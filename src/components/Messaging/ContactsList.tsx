import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Asegúrate de que esté bien importado
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { Search, UserCircle } from 'lucide-react';

interface ContactsListProps {
  onSelectContact: (userId: string, userData: User) => void;
  selectedContactId: string | null;
}

const ContactsList: React.FC<ContactsListProps> = ({
  onSelectContact,
  selectedContactId,
}) => {
  const { currentUser } = useAuth();
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchContacts = async () => {
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .neq('id', currentUser.id);

      if (error) {
        console.error('Error fetching contacts:', error);
      } else {
        setContacts(data || []);
      }

      setLoading(false);
    };

    fetchContacts();
  }, [currentUser]);

  const filteredContacts = contacts.filter((contact) =>
    contact.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'teacher':
        return 'Profesor';
      case 'alumno':
        return 'Alumno';
      case 'admin':
        return 'Administrador';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar contactos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm ? 'No se encontraron contactos' : 'No hay contactos disponibles'}
          </div>
        ) : (
          <ul>
            {filteredContacts.map((contact) => (
              <li
                key={contact.id}
                onClick={() => onSelectContact(contact.id, contact)}
                className={`
                  p-4 border-b cursor-pointer transition-colors
                  hover:bg-gray-50
                  ${selectedContactId === contact.id ? 'bg-blue-50' : ''}
                `}
              >
                <div className="flex items-center">
                  {contact.photo_url ? (
                    <img
                      src={contact.photo_url}
                      alt={contact.display_name}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  ) : (
                    <UserCircle className="w-10 h-10 text-gray-400 mr-3" />
                  )}
                  <div>
                    <h3 className="font-medium text-gray-800">{contact.display_name}</h3>
                    <div className="flex space-x-2 text-sm text-gray-500">
                      <span>{getRoleLabel(contact.role)}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ContactsList;
