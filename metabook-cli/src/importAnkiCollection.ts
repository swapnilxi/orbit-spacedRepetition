import { Command, flags } from "@oclif/command";
import firebase from "firebase";
import "firebase/firestore";
import admin from "firebase-admin";
import fs from "fs";
import {
  MetabookFirebaseDataClient,
  MetabookFirebaseUserClient,
} from "metabook-client";
import { getIDForActionLog } from "metabook-core";
import {
  ActionLogDocument,
  batchWriteEntries,
  getLogCollectionReference,
  getReferenceForActionLogID,
  getTaskStateCacheReferenceForTaskID,
  PromptStateCache,
} from "metabook-firebase-support";
import path from "path";
import {
  createImportPlan,
  readAnkiCollectionPackage,
} from "../../metabook-anki";
import { getAdminApp } from "./adminApp";

class ImportAnkiCollection extends Command {
  static flags = {
    help: flags.help(),
    userID: flags.string({
      required: true,
    }),
    skipUpload: flags.boolean(),
  };

  static args = [{ name: "ankiCollectionPath", required: true }];

  async run() {
    const { flags, args } = this.parse(ImportAnkiCollection);

    const plan = await readAnkiCollectionPackage(
      args.ankiCollectionPath,
      createImportPlan,
    );

    console.log(`${plan.prompts.length} prompts imported`);
    console.log(`${plan.logs.length} logs imported`);
    console.log(`${plan.attachments.length} attachments imported`);
    console.log(`${plan.issues.length} issues found`);

    if (flags.skipUpload) {
      await fs.promises.writeFile(
        path.resolve(__dirname, "importPlan.json"),
        JSON.stringify(plan),
        {
          encoding: "utf8",
        },
      );
    } else {
      console.log("\nUploading to server...");

      const app = firebase.initializeApp({
        apiKey: "AIzaSyAwlVFBlx4D3s3eSrwOvUyqOKr_DXFmj0c",
        authDomain: "metabook-system.firebaseapp.com",
        databaseURL: "https://metabook-system.firebaseio.com",
        projectId: "metabook-system",
        storageBucket: "metabook-system.appspot.com",
        messagingSenderId: "748053153064",
        appId: "1:748053153064:web:efc2dfbc9ac11d8512bc1d",
      });
      const dataClient = new MetabookFirebaseDataClient(app, app.functions());

      await dataClient.recordAttachments(plan.attachments);
      console.log("Recorded attachments.");

      await dataClient.recordPrompts(plan.prompts);
      console.log("Recorded prompts.");

      getLogCollectionReference(app.firestore(), flags.userID);
      await batchWriteEntries(
        plan.logs.map((log) => [
          getReferenceForActionLogID(
            app.firestore(),
            flags.userID,
            getIDForActionLog(log),
          ),
          {
            ...log,
            suppressTaskStateCacheUpdate: true,
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp() as firebase.firestore.Timestamp,
          } as ActionLogDocument<firebase.firestore.Timestamp>,
        ]),
        app.firestore(),
        (ms, ns) => new firebase.firestore.Timestamp(ms, ns),
      );
      console.log("Recorded logs.");

      const adminApp = getAdminApp();
      const adminDB = adminApp.firestore();
      await batchWriteEntries(
        plan.promptStateCaches.map(({ taskID, promptState }) => [
          getTaskStateCacheReferenceForTaskID(adminDB, flags.userID, taskID),
          {
            taskID,
            ...promptState,
          } as PromptStateCache,
        ]),
        adminDB,
        (ms, ns) => new admin.firestore.Timestamp(ms, ns),
      );

      await firebase.firestore().terminate();
      console.log("Done.");
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
(ImportAnkiCollection.run() as Promise<unknown>).catch(
  require("@oclif/errors/handle"),
);