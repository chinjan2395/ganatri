import type { Socket } from 'socket.io-client';
import { UserManagementSection } from '../components/UserManagementSection';

interface UserManagementPageProps {
  socket: Socket | null;
}

export function UserManagementPage({ socket }: UserManagementPageProps) {
  return <UserManagementSection socket={socket} />;
}
