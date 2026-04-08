import path from 'node:path';
import type { WorkspaceRole, WorkspacePermissions, WorkspaceSession, WorkspaceUser } from '@shared/types';
import { nowIso } from '@main/utils/date';

const normalizeRootPath = (rootPath: string): string => path.resolve(rootPath);

const buildPermissions = (role: WorkspaceRole): WorkspacePermissions => ({
  canReadWorkspace: true,
  canEditWorkspace: role === 'admin' || role === 'editor',
  canManageWorkspace: role === 'admin'
});

export class WorkspaceSessionService {
  private readonly sessions = new Map<string, WorkspaceSession>();

  createSession(user: WorkspaceUser): WorkspaceSession {
    return {
      user,
      permissions: buildPermissions(user.role),
      signedInAt: nowIso()
    };
  }

  setSession(senderId: number, rootPath: string, user: WorkspaceUser): WorkspaceSession {
    const session = this.createSession(user);
    this.sessions.set(this.getKey(senderId, rootPath), session);
    return session;
  }

  getSession(senderId: number, rootPath: string): WorkspaceSession | null {
    return this.sessions.get(this.getKey(senderId, rootPath)) ?? null;
  }

  clearSession(senderId: number, rootPath: string): void {
    this.sessions.delete(this.getKey(senderId, rootPath));
  }

  clearWorkspace(rootPath: string): void {
    const normalizedRootPath = normalizeRootPath(rootPath);
    for (const key of [...this.sessions.keys()]) {
      if (key.endsWith(`:${normalizedRootPath}`)) {
        this.sessions.delete(key);
      }
    }
  }

  clearSender(senderId: number): void {
    for (const key of [...this.sessions.keys()]) {
      if (key.startsWith(`${senderId}:`)) {
        this.sessions.delete(key);
      }
    }
  }

  clearAll(): void {
    this.sessions.clear();
  }

  private getKey(senderId: number, rootPath: string): string {
    return `${senderId}:${normalizeRootPath(rootPath)}`;
  }
}
