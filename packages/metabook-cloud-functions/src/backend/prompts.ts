import * as admin from "firebase-admin";
import { getIDForPrompt, Prompt, PromptID } from "metabook-core";
import { getDataRecordReference } from "metabook-firebase-support";
import { getDatabase } from "./firebase";

export async function getPrompts(
  promptIDs: PromptID[],
): Promise<(Prompt | null)[]> {
  const db = getDatabase();
  const snapshots = (await getDatabase().getAll(
    ...promptIDs.map((promptID) => getDataRecordReference(db, promptID)),
  )) as admin.firestore.DocumentSnapshot<Prompt>[];
  return snapshots.map((snapshot) => snapshot.data() ?? null);
}

export function storePrompts(prompts: Prompt[]): Promise<PromptID[]> {
  // TODO probably add something about provenance https://github.com/andymatuschak/metabook/issues/59
  // TODO something about user quotas, billing
  return Promise.all(
    prompts.map(async (promptData) => {
      const promptID = await getIDForPrompt(promptData);
      const dataRef = getDataRecordReference(getDatabase(), promptID);
      await dataRef
        .create(promptData)
        .then(() => {
          console.log("Recorded prompt spec", promptID, promptData);
        })
        .catch(() => {
          // It's OK if it already exists.
          return;
        });
      return promptID as PromptID;
    }),
  );
}