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
  role: Role;
  role_description: string,
 // photo_url?: string | null;
 // email_verified_at?: string | null;
  //created_at: string;
  //updated_at: string;
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
  userId: string;
  displayName: string;
  role: UserRole;
  joinTime: Date;
}