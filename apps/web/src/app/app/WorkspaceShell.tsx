"use client";
import { WorkspaceProvider } from '../WorkspaceProvider';
import { WorkspaceLayout } from '../../components/WorkspaceLayout';
export default function WorkspaceShell({ children }: { children: React.ReactNode }) { return <WorkspaceProvider><WorkspaceLayout>{children}</WorkspaceLayout></WorkspaceProvider>; }
