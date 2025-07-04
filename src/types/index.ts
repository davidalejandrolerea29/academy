export type UserRole = 'Student' | 'Teacher' | 'Admin';

export interface Role {
  id: number;
  description: UserRole;
  created_at: string;
  updated_at: string;
}
export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role: Role; // Objeto de rol completo
  must_change_password: boolean;
  // Nuevos campos para asignaciones
  assigned_student_ids?: number[]; // IDs de alumnos asignados (si es profesor)
  assigned_students?: { id: number; name: string }[]; // Detalles de alumnos asignados
  assigned_teacher_ids?: number[]; // IDs de profesores asignados (si es alumno)
  assigned_teachers?: { id: number; name: string }[]; // Detalles de profesores asignados
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string; // Opcional para editar
  role_id: number;
  assigned_student_ids?: number[];
  assigned_teacher_ids?: number[]; // Nuevo para asignar profesores a alumnos
}

export interface Option { // Para select de asignaciones
  id: number;
  name: string;
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

export interface MessagePrivate {
  id: number;
  user_id: number;
  contact_id: number;
  content: string;
  read: boolean;
  created_at: string;
  attachment_url?: string;
  sender?: User; // <- relación cargada por Laravel
}




export interface RoomParticipant {
  userId: number;
  displayName: string;
  role: UserRole;
  joinTime: Date;
}