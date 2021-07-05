import { Entity, Event, EventID, IDOfEntity } from "../../core2";
import { EntityType } from "../../core2/entities/entityBase";
import { DatabaseEntityQuery, DatabaseEventQuery } from "../../database";
import { DatabaseBackend, DatabaseBackendEntityRecord } from "../backend";
import { DexieDatabase } from "./dexie/dexie";
import { DexieEntityRow } from "./dexie/tables";

export class IDBDatabaseBackend implements DatabaseBackend {
  db: DexieDatabase;

  constructor(indexDB: IDBFactory = window.indexedDB) {
    this.db = new DexieDatabase("OrbitDatabase", indexDB);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async getEntities<E extends Entity, ID extends IDOfEntity<E>>(
    entityIDs: ID[],
  ): Promise<Map<ID, DatabaseBackendEntityRecord<E>>> {
    const values = await this.db.entities
      .where("id")
      .anyOf(entityIDs)
      .toArray();

    const output: Map<ID, DatabaseBackendEntityRecord<E>> = new Map();
    for (const value of values) {
      if (!value) continue;
      const entity: E = JSON.parse(value.data);
      output.set(value.id as ID, {
        lastEventID: value.lastEventID as EventID,
        entity,
      });
    }
    return output;
  }

  async getEvents<E extends Event, ID extends EventID>(
    eventIDs: EventID[],
  ): Promise<Map<ID, E>> {
    const values = await this.db.events.where("id").anyOf(eventIDs).toArray();

    const output: Map<ID, E> = new Map();
    for (const value of values) {
      if (!value) continue;
      const entity: E = JSON.parse(value.data);
      output.set(value.id as ID, entity);
    }
    return output;
  }

  async listEntities<E extends Entity>(
    query: DatabaseEntityQuery<E>,
  ): Promise<DatabaseBackendEntityRecord<E>[]> {
    if (query.entityType !== EntityType.Task) {
      // Haven't actually added this column to the DB; we can do that when it's needed.
      throw new Error(`Unsupported entity type in query: ${query.entityType}`);
    }

    const queriedEvents = await this.db.entities.toArray();
    return queriedEvents.map((event) => JSON.parse(event.data));
  }

  async listEvents(query: DatabaseEventQuery): Promise<Event[]> {
    const queriedEvents = await this.db.events.toArray();
    return queriedEvents.map((event) => JSON.parse(event.data));
  }

  async putEntities(
    entities: DatabaseBackendEntityRecord<Entity>[],
  ): Promise<void> {
    await this.db.transaction(
      "readwrite",
      this.db.entities,
      this.db.derived_taskComponents,
      async () => {
        const newEntities = entities.reduce((map, record) => {
          map[record.entity.id] = {
            id: record.entity.id,
            lastEventID: record.lastEventID,
            data: JSON.stringify(record.entity),
          };
          return map;
        }, {} as { [id: string]: DexieEntityRow });

        const existingKeyMapping = new Map<string, number>();
        await this.db.entities
          .where("id")
          .anyOf(Object.keys(newEntities))
          .eachKey((key, cursor) => {
            existingKeyMapping.set(key as string, cursor.primaryKey);
          });

        // TODO fix this logic. Right now with this logic, ALL the newEntities MUST
        // already exist or MUST NOT all exist.
        if (existingKeyMapping.size == 0) {
          await this.db.entities.bulkPut(Object.values(newEntities));
        } else {
          const primaryKeys = Object.keys(newEntities).map(
            (key) => existingKeyMapping.get(key)!,
          );
          await this.db.entities.bulkPut(
            Object.values(newEntities),
            primaryKeys,
          );
        }
      },
    );
  }

  async putEvents(events: Event[]): Promise<void> {
    this.db.transaction("rw", this.db.events, async () => {
      await this.db.events.bulkAdd(
        events.map((event) => ({
          entityID: event.entityID,
          id: event.id,
          data: JSON.stringify(event),
        })),
      );
    });
  }
}
