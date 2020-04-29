import firebase from "firebase";
import admin from "firebase-admin";
import {
  ActionLog,
  ActionLogID,
  PromptState,
  PromptTaskID,
} from "metabook-core";
import {
  getLogCollectionReference,
  getReferenceForActionLogID,
} from "metabook-firebase-support";
import { getAdminApp } from "./adminApp";

function formatMillis(millis: number): string {
  let working = millis;
  if (millis < 1000) {
    return `${millis}ms`;
  }
  working /= 1000;
  if (working < 60) {
    return `${working}s`;
  }
  working /= 60;
  if (working < 60) {
    return `${working}m`;
  }
  working /= 60;
  if (working < 24) {
    return `${working}h`;
  }
  working /= 24;
  return `${working}d`;
}

(async () => {
  const promptStates = new Map<PromptTaskID, PromptState>();
  const logs: { [key: string]: ActionLog } = {};

  const adminApp = getAdminApp();
  const adminDB = adminApp.firestore();

  const app = firebase.initializeApp({
    apiKey: "AIzaSyAwlVFBlx4D3s3eSrwOvUyqOKr_DXFmj0c",
    authDomain: "metabook-system.firebaseapp.com",
    databaseURL: "https://metabook-system.firebaseio.com",
    projectId: "metabook-system",
    storageBucket: "metabook-system.appspot.com",
    messagingSenderId: "748053153064",
    appId: "1:748053153064:web:efc2dfbc9ac11d8512bc1d",
  });

  const ref = getReferenceForActionLogID(
    app.firestore(),
    "x5EWk2UT56URxbfrl7djoxwxiqH2",
    "zdj7WaVVJ8gaUcyQM4iZbwiYzLpC6jmzYAESK2RsqmdpMY8py" as ActionLogID,
  );
  const snapshot = await ref.get();
  console.log(snapshot.data());

  /*const startTime = Date.now();
  let ref = getLogCollectionReference(
    app.firestore(),
    "x5EWk2UT56URxbfrl7djoxwxiqH2",
  )
    .orderBy("serverTimestamp", "asc")
    .limit(50000);
  // let baseServerTimestamp: admin.firestore.Timestamp | null = null;
  let baseSnapshot: any = null;
  let total = 0;
  while (true) {
    if (baseSnapshot) {
      ref = ref.startAfter(baseSnapshot);
    }
    const snapshot = await ref.get();
    total += snapshot.size;
    // console.log(`Got ${snapshot.size} logs; ${total} total`);
    if (snapshot.size > 0) {
      baseSnapshot = snapshot.docs[snapshot.size - 1];
    } else {
      console.log("Done", total, (Date.now() - startTime) / 1000);
      break;
    }
  }*/

  /*
  const refs = (plan.prompts as Prompt[]).map((prompt) =>
    getReferenceForPromptID(adminDB, getIDForPrompt(prompt)),
  );
  console.log(`Requesting ${refs.length} prompts`, Date.now());
  const snapshots = await adminDB.getAll(...refs);
  console.log(`Got ${snapshots.length} snapshots`, Date.now());

  const taskIDsToInspect: Set<PromptTaskID> = new Set();
  for (const log of plan.logs) {
    const promptState = applyActionLogToPromptState({
      promptActionLog: getPromptActionLogFromActionLog(log),
      schedule: "default",
      basePromptState: promptStates.get(log.taskID) ?? null,
    }) as PromptState;
    logs[getIDForActionLog(log)] = log;
    promptStates.set(log.taskID, promptState);
  }

  const intervalCounts = new Map<number, number>();
  let printed = false;
  for (const [taskID, promptState] of promptStates.entries()) {
    if (promptState.dueTimestampMillis <= Date.now() + 1000 * 60 * 60 * 16) {
      intervalCounts.set(
        promptState.intervalMillis,
        (intervalCounts.get(promptState.intervalMillis) ?? 0) + 1,
      );
    }
    if (taskIDsToInspect.has(taskID) && !printed) {
      const queue = [];
      let head: ActionLog | null = logs[promptState.headActionLogIDs[0]];
      while (head) {
        queue.unshift(head);
        if (head.actionLogType === ingestActionLogType) {
          head = null;
        } else {
          head = logs[head.parentActionLogIDs[0]];
        }
      }

      let basePromptState: PromptState | null = null;
      console.log(promptState.provenance!);
      for (const q of queue) {
        const newPromptState = applyActionLogToPromptState({
          schedule: "default",
          basePromptState,
          promptActionLog: getPromptActionLogFromActionLog(q),
        }) as PromptState;
        if (basePromptState) {
          console.log(
            `Interval: ${formatMillis(
              q.timestampMillis - basePromptState.lastReviewTimestampMillis,
            )}. Scheduled interval: ${formatMillis(
              basePromptState.intervalMillis,
            )}`,
          );
        }
        console.log(q, newPromptState);
        basePromptState = newPromptState;
      }
      printed = true;
    }
  }

  // const csv: string[] = ["Old,New"];
  // for (const log of plan.logs) {
  //   const anyLog = log as any;
  //   if ("debug" in anyLog) {
  //     csv.push(`${anyLog.debug.originalInterval},${anyLog.debug.newInterval}`);
  //   }
  // }
  // await fs.promises.writeFile("comparison.csv", csv.join("\n"));

  let total = 0;
  for (const [interval, count] of [...intervalCounts.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    console.log(`${formatMillis(interval)}\t\t${count}`);
    total += count;
  }

  console.log("Total scheduled: ", total);*/
})();