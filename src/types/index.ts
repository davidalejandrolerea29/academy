export type UserRole = 'alumno' | 'teacher' | 'admin';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  photoURL?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  start_time: Date;
  end_time: Date;
  is_active: boolean;
  isRecording: boolean;
  participants: string[]; // User IDs of allowed participants
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
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