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
  token: string;
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
  id: number;
  content: string;
  timestamp: string;
  sender_id: number;
  receiver_id: number;
  read: boolean;
  room_participant: {
    user: {
      id: number;
      name: string;
    };
  };
}



export interface RoomParticipant {
  userId: number;
  displayName: string;
  role: UserRole;
  joinTime: Date;
}