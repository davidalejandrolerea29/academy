import React, { useEffect } from 'react';
import { UserPlus, UserMinus, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'join' | 'leave' | 'success' | 'error' | 'info';
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const getStyles = () => {
        switch (type) {
            case 'join':
                return { bgColor: 'bg-green-600', Icon: UserPlus };
            case 'leave':
                return { bgColor: 'bg-gray-600', Icon: UserMinus };
            case 'success':
                return { bgColor: 'bg-green-600', Icon: CheckCircle };
            case 'error':
                return { bgColor: 'bg-red-600', Icon: AlertCircle };
            case 'info':
                return { bgColor: 'bg-blue-600', Icon: Info };
            default:
                return { bgColor: 'bg-gray-600', Icon: Info };
        }
    };

    const { bgColor, Icon } = getStyles();

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
