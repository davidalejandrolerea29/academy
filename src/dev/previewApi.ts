import { previewUser } from '../config/devPreview';
import type { MessagePrivate, RoomStatusResponse, User } from '../types';

const previewOnlyMessage = 'Esta acción requiere iniciar sesión. Estás en la vista previa local.';
const now = Date.now();
const dateAt = (offset: number) => new Date(now + offset).toISOString();
const hour = 60 * 60 * 1000;

const teacher: User = {
    id: 9001,
    name: 'Laura Martínez',
    email: 'laura@example.invalid',
    role_id: 2,
    role: { id: 2, description: 'Teacher', created_at: dateAt(-24 * hour), updated_at: dateAt(-24 * hour) },
    role_description: 'Teacher',
    must_change_password: false,
    assigned_student_ids: [9002, 9003],
    assigned_students: [{ id: 9002, name: 'Sofía García' }, { id: 9003, name: 'Mateo López' }],
};

const students: User[] = [
    { id: 9002, name: 'Sofía García', email: 'sofia@example.invalid' },
    { id: 9003, name: 'Mateo López', email: 'mateo@example.invalid' },
].map(student => ({
    ...student,
    role_id: 3,
    role: { id: 3, description: 'Student', created_at: dateAt(-24 * hour), updated_at: dateAt(-24 * hour) },
    role_description: 'Student',
    must_change_password: false,
    assigned_teacher_ids: [teacher.id],
    assigned_teachers: [{ id: teacher.id, name: teacher.name }],
}));

const users: User[] = [previewUser, teacher, ...students];

const rooms = [
    {
        id: 9101,
        name: 'English Conversation Club',
        description: 'Practica conversación y gana confianza con situaciones de todos los días.',
        start_time: dateAt(-hour / 6),
        end_time: dateAt(hour),
        is_active: true,
    },
    {
        id: 9102,
        name: 'Grammar & Vocabulary · Nivel B1',
        description: 'Una clase para repasar vocabulario, resolver dudas y avanzar a tu ritmo.',
        start_time: dateAt(2 * hour),
        end_time: dateAt(3 * hour),
        is_active: true,
    },
].map(room => ({
    ...room,
    teacher_id: teacher.id,
    teacher: { id: teacher.id, name: teacher.name },
    participant_history: '',
    is_recording: false,
    participants: [previewUser, ...students].map((user, index) => ({
        id: room.id * 10 + index,
        room_id: room.id,
        user_id: user.id,
        user: { id: user.id, name: user.name },
    })),
    messages: [{
        id: room.id,
        content: '¡Bienvenidos! Los materiales de práctica están en la biblioteca.',
        timestamp: dateAt(-hour / 4),
        read: true,
        banned: false,
        room_participant_id: room.id * 10,
        sender_name: teacher.name,
    }],
}));

const libraryItems = [
    {
        id: 'preview-folder',
        parent_id: null,
        type: 'folder',
        title: 'Material de clases',
        description: 'Ejercicios y recursos para practicar.',
    },
    {
        id: 'preview-guide',
        parent_id: null,
        type: 'file',
        title: 'Guía de conversación.pdf',
        file_path: '',
        size: 245760,
        mime_type: 'application/pdf',
    },
    {
        id: 'preview-practice',
        parent_id: 'preview-folder',
        type: 'file',
        title: 'Vocabulary practice.pdf',
        file_path: '',
        size: 184320,
        mime_type: 'application/pdf',
    },
    {
        id: 'preview-link',
        parent_id: null,
        type: 'link',
        title: 'Recursos de práctica',
        external_url: 'https://example.invalid/english-practice',
    },
].map(item => ({ ...item, user_id: String(teacher.id), created_at: dateAt(-24 * hour), updated_at: dateAt(-hour) }));

const getMessages = (senderId: number, recipientId: number): MessagePrivate[] => [
    {
        id: 9201,
        user_id: recipientId,
        contact_id: senderId,
        content: '¡Hola! ¿Cómo vas con los ejercicios de esta semana?',
        read: true,
        created_at: dateAt(-hour / 3),
        status: 'read',
    },
    {
        id: 9202,
        user_id: senderId,
        contact_id: recipientId,
        content: '¡Muy bien! Ya tengo listo el material para nuestra próxima clase.',
        read: true,
        created_at: dateAt(-hour / 4),
        status: 'read',
    },
];

const getRoomStatuses = (): RoomStatusResponse => {
    const currentTime = Date.now();
    return {
        success: true,
        current_time: new Date(currentTime).toISOString(),
        rooms: rooms.map(room => {
            const start = new Date(room.start_time).getTime();
            const end = new Date(room.end_time).getTime();
            const status = currentTime >= end ? 'finished' : currentTime < start ? 'scheduled' : 'active';
            return {
                id: room.id,
                name: room.name,
                start_time: room.start_time,
                end_time: room.end_time,
                is_active: room.is_active,
                should_be_active: status === 'active',
                can_activate: status === 'active',
                time_until_start: Math.max(0, Math.floor((start - currentTime) / 1000)),
                time_until_end: Math.max(0, Math.floor((end - currentTime) / 1000)),
                status,
            };
        }),
    };
};

const waitForPreview = (signal?: AbortSignal | null): Promise<void> => new Promise((resolve, reject) => {
    const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };
    const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
    }, 250);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
});

export const previewFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const signal = init?.signal === undefined ? request?.signal : init.signal;
    await waitForPreview(signal);

    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const url = new URL(request?.url ?? String(input), 'http://preview.local');
    const authIndex = url.pathname.indexOf('/auth/');
    const path = authIndex >= 0 ? url.pathname.slice(authIndex) : url.pathname;
    let body: unknown = { message: previewOnlyMessage };
    let status = 403;

    // Every unmatched request stays local and is denied, including writes,
    // download URLs, uploads, streams, and authentication actions.
    if (method === 'GET' || method === 'HEAD') {
        switch (path) {
            case '/auth/rooms': body = rooms; break;
            case '/auth/rooms/status': body = getRoomStatuses(); break;
            case '/auth/library':
                body = { data: libraryItems.filter(item => item.parent_id === (url.searchParams.get('parent_id') || null)) };
                break;
            case '/auth/recordings': body = { recordings: [] }; break;
            case '/auth/users': body = users; break;
            case '/auth/admin/teachers': body = { teachers: [teacher] }; break;
            case '/auth/admin/students':
            case '/auth/admin/available-students-for-assignment':
                body = { students }; break;
            case '/auth/contacts': body = { contacts: [teacher, ...students].map(user => ({ user })) }; break;
            case '/auth/unread-counts': body = { unread_counts: {} }; break;
            case '/auth/admin/chat-history':
                body = { messages: getMessages(
                    Number(url.searchParams.get('user1_id') || teacher.id),
                    Number(url.searchParams.get('user2_id') || students[0].id),
                ) };
                break;
            case '/auth/privatechat':
                body = { messages: getMessages(
                    Number(url.searchParams.get('user_id') || previewUser.id),
                    Number(url.searchParams.get('contact_id') || teacher.id),
                ) };
                break;
            default:
                if (/^\/auth\/admin\/teachers\/\d+\/students$/.test(path)) {
                    body = { students: path === `/auth/admin/teachers/${teacher.id}/students` ? students : [] };
                }
        }
        if (typeof body === 'object' && body !== null && !('message' in body)) status = 200;
    }

    return new Response(method === 'HEAD' ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
};
