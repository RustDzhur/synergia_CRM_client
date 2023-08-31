import React from 'react';
import toast from 'react-hot-toast';
import { MessageType } from '@/app/types/MessageType';

interface ToasterProps {
  type: MessageType; 
  message: string;
}

const ToasterNotifications: React.FC<ToasterProps> = ({ type, message }) => {
  switch (type) {
    case MessageType.Error:
      toast.error(message, {
        duration: 2000,
        position: 'top-center',
      });
      break;
    case MessageType.Success:
      toast.success(message, {
        duration: 2000,
        position: 'top-center',
      });
      break;
    default:
      break;
  }

  return null;
};

export default ToasterNotifications;
