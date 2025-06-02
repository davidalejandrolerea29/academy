export type UserRole = 'alumno' | 'teacher' | 'admin';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  photo_url?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  teacher_id: string;
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
  userId: string;
  displayName: string;
  role: UserRole;
  joinTime: Date;
}