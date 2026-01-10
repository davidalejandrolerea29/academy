import React, { useEffect } from 'react';
import { UserPlus, UserMinus } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'join' | 'leave';
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'join' ? 'bg-green-600' : 'bg-gray-600';
    const Icon = type === 'join' ? UserPlus : UserMinus;

    return (
        <div
            className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] animate-slide-down`}
            role="alert"
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{message}</span>
        </div>
    );
};

export default Toast;
