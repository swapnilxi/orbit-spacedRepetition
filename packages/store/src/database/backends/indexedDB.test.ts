import { IDBDatabaseBackend } from "./indexedDB";
import { TaskID } from "../../core2";
import { testTasks, createTestTask } from "../__tests__/testTasks";
// @ts-ignore Looks like there is no @types for this library
import FDBFactory from "fake-indexeddb/lib/FDBFactory";
import { EntityType } from "../../core2/entities/entityBase";

let backend: IDBDatabaseBackend;

beforeEach(() => {
  indexedDB = new FDBFactory();
  backend = new IDBDatabaseBackend(indexedDB);
});

test("round-trip entities", async () => {
  await backend.putEntities(testTasks);

  const result = await backend.getEntities(["a", "c", "z"] as TaskID[]);
  expect(result).toEqual(
    new Map([
      ["a", testTasks[0]],
      ["c", testTasks[2]],
    ]),
  );
});

describe("task components", () => {
  test("created on insert", async () => {
    await backend.putEntities(testTasks);

    const results = await fetchAllRowsForTable("derived_taskComponents");
    const filteredResults = results.filter(
      (component: { taskID: string }) => component.taskID == "a",
    );

    expect(filteredResults.length).toBe(2);
    expect(filteredResults[0]).toMatchInlineSnapshot(`
      Object {
        "componentID": "a",
        "dueTimestampMillis": 50,
        "taskID": "a",
      }
    `);
    expect(filteredResults[1]).toMatchInlineSnapshot(`
      Object {
        "componentID": "b",
        "dueTimestampMillis": 200,
        "taskID": "a",
      }
    `);
  });

  test("modified on update", async () => {
    await backend.putEntities(testTasks);

    const updatedA = createTestTask({
      id: "a",
      lastEventID: "y",
      dueTimestampMillis: 300,
    });

    delete updatedA.entity.componentStates["b"];

    await backend.modifyEntities([updatedA.entity.id], (existingRows) => {
      existingRows.set(updatedA.entity.id, {
        rowID: existingRows.get(updatedA.entity.id)!.rowID,
        id: updatedA.entity.id,
        lastEventID: updatedA.lastEventID,
        data: JSON.stringify(updatedA.entity),
      });
      return existingRows;
    });

    const results = await fetchAllRowsForTable("derived_taskComponents");
    const filteredResults = results.filter(
      (component: { taskID: string }) => component.taskID == "a",
    );

    expect(filteredResults.length).toBe(1);
    expect(filteredResults[0]).toMatchInlineSnapshot(`
      Object {
        "componentID": "a",
        "dueTimestampMillis": 300,
        "taskID": "a",
      }
    `);
  });
});

describe("querying entities", () => {
  beforeEach(() => backend.putEntities(testTasks));
  test("limit", async () => {
    const firstEntity = await backend.listEntities({
      entityType: EntityType.Task,
      limit: 1,
    });
    expect(firstEntity.length).toBe(1);
    expect(firstEntity[0].entity.id).toBe("a");
  });

  test("after", async () => {
    const entities = await backend.listEntities({
      entityType: EntityType.Task,
      afterID: "a" as TaskID,
    });
    expect(entities.length).toBe(2);
    expect(entities[0].entity.id).toBe("b");
    expect(entities[1].entity.id).toBe("c");
  });

  test("by due timestamp", async () => {
    const entities = await backend.listEntities({
      entityType: EntityType.Task,
      predicate: ["dueTimestampMillis", "<=", 100],
    });
    expect(entities.map((record) => record.entity.id)).toEqual(["a", "b"]);
  });

  test("by due timestamp and after ID", async () => {
    const entities = await backend.listEntities({
      entityType: EntityType.Task,
      afterID: "a" as TaskID,
      predicate: ["dueTimestampMillis", "<=", 100],
    });
    expect(entities.map((record) => record.entity.id)).toEqual(["b"]);
  });
});

async function createIndexedDBConnection(): Promise<IDBDatabase> {
  const DBOpenRequest = indexedDB.open("OrbitDatabase");
  return new Promise((resolve) => {
    DBOpenRequest.onsuccess = () => {
      resolve(DBOpenRequest.result);
    };
  });
}

async function fetchAllRowsForTable(table: string): Promise<any[]> {
  const db = await createIndexedDBConnection();
  const transaction = db.transaction(table, "readonly");
  const store = transaction.objectStore(table);
  const request = store.getAll();
  const result = await new Promise<any[]>((resolve) => {
    request.onsuccess = () => resolve(request.result);
  });
  return result;
}