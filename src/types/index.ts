export type UserRole = 'Student' | 'Teacher' | 'Admin';

export interface Role {
  id: number;
  description: UserRole;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role_id: number;
  role: Role; // Asegúrate de que esta propiedad exista y sea del tipo Role
  token?: string; // Hice token opcional ya que no siempre estará presente
  // Quité role_description ya que `user.role.description` ya lo provee
  // photo_url?: string | null;
  // email_verified_at?: string | null;
  // created_at?: string; // Opcional, ya que no siempre lo usarás directamente
  // updated_at?: string; // Opcional
}


export interface Room {
  id: number;
  name: string;
  description: string;
  teacher_id: number;
  start_time: Date;
  end_time: Date;
  is_active: boolean;
  participant_history:string;
  is_recording: boolean;
  participants: string[]; // User IDs of allowed participants
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface RoomParticipant {
  userId: number;
  displayName: string;
  role: UserRole;
  joinTime: Date;
}