import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, X, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="text-emerald-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
    warning: <AlertTriangle className="text-amber-500" size={20} />
  };

  const bgColors = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`fixed bottom-6 right-6 z-[9999] max-w-md w-full p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-4 ${bgColors[type]}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[type]}
      </div>
      <div className="flex-grow">
        <p className="text-sm font-medium text-white leading-relaxed">
          {message}
        </p>
      </div>
      <button 
        onClick={onClose}
        className="flex-shrink-0 text-white/40 hover:text-white transition-colors"
      >
        <X size={18} />
      </button>
    </motion.div>
  );
};

export default Notification;
