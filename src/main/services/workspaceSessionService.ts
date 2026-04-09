import path from 'node:path';
import type { WorkspaceSession, WorkspaceUser } from '@shared/types';
import { WorkspaceRoleService } from '@main/services/workspaceRoleService';
import { nowIso } from '@main/utils/date';

const normalizeRootPath = (rootPath: string): string => path.resolve(rootPath);

export class WorkspaceSessionService {
  private readonly sessions = new Map<string, WorkspaceSession>();

  constructor(private readonly workspaceRoleService: WorkspaceRoleService) {}

  createSession(rootPath: string, user: WorkspaceUser): WorkspaceSession {
    return {
      user,
      permissions: this.workspaceRoleService.getPermissions(rootPath, user.role),
      signedInAt: nowIso()
    };
  }

  setSession(senderId: number, rootPath: string, user: WorkspaceUser): WorkspaceSession {
    const session = this.createSession(rootPath, user);
    this.sessions.set(this.getKey(senderId, rootPath), session);
    return session;
  }

  getSession(senderId: number, rootPath: string): WorkspaceSession | null {
    return this.sessions.get(this.getKey(senderId, rootPath)) ?? null;
  }

  clearSession(senderId: number, rootPath: string): void {
    this.sessions.delete(this.getKey(senderId, rootPath));
  }

  replaceSessionsForUser(rootPath: string, user: WorkspaceUser): void {
    const normalizedRootPath = normalizeRootPath(rootPath);
    for (const [key, session] of this.sessions.entries()) {
      if (key.endsWith(`:${normalizedRootPath}`) && session.user.id === user.id) {
        this.sessions.set(key, {
          ...session,
          user,
          permissions: this.workspaceRoleService.getPermissions(rootPath, user.role)
        });
      }
    }
  }

  clearSessionsForUser(rootPath: string, userId: number): void {
    const normalizedRootPath = normalizeRootPath(rootPath);
    for (const [key, session] of this.sessions.entries()) {
      if (key.endsWith(`:${normalizedRootPath}`) && session.user.id === userId) {
        this.sessions.delete(key);
      }
    }
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
