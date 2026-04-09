import { AsyncLocalStorage } from 'node:async_hooks';

export class ActorContextService {
  private readonly storage = new AsyncLocalStorage<number | null>();

  runWithActor<T>(actorUserId: number | null, callback: () => T): T {
    return this.storage.run(actorUserId, callback);
  }

  getActorUserId(): number | null {
    return this.storage.getStore() ?? null;
  }
}
