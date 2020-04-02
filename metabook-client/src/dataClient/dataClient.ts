import base64 from "base64-js";
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/functions";

import {
  Attachment,
  AttachmentID,
  AttachmentURLReference,
  PromptSpec,
  PromptSpecID,
} from "metabook-core";
import { getDataCollectionReference, getDefaultFirebaseApp } from "../firebase";
import { MetabookUnsubscribe } from "../types/unsubscribe";

export interface MetabookDataClient {
  recordPromptSpecs(promptSpecs: PromptSpec[]): Promise<unknown>;
  recordAttachments(attachments: Attachment[]): Promise<unknown>;

  getPromptSpecs(
    requestedPromptSpecIDs: Set<PromptSpecID>,
    onUpdate: (
      snapshot: MetabookDataSnapshot<PromptSpecID, PromptSpec>,
    ) => void,
  ): { completion: Promise<unknown>; unsubscribe: MetabookUnsubscribe };

  getAttachments(
    requestedAttachmentIDs: Set<AttachmentID>,
    onUpdate: (
      snapshot: MetabookDataSnapshot<AttachmentID, AttachmentURLReference>,
    ) => void,
  ): { completion: Promise<unknown>; unsubscribe: MetabookUnsubscribe };
}

export type MetabookDataSnapshot<ID, Data> = Map<ID, Data | Error | null>; // null means the card data has not yet been fetched.

export function getAttachmentURLReferenceForAttachment(attachment: Attachment) {
  return {
    type: attachment.type,
    url: `data:${attachment.mimeType};base64,${base64.fromByteArray(
      Uint8Array.from(Buffer.from(attachment.contents)),
    )}`,
  };
}

export class MetabookFirebaseDataClient implements MetabookDataClient {
  private functions: firebase.functions.Functions;
  private database: firebase.firestore.Firestore;

  constructor(
    app: firebase.app.App = getDefaultFirebaseApp(),
    functionsInstance: firebase.functions.Functions = app.functions(),
  ) {
    this.database = app.firestore();
    this.functions = functionsInstance;
  }

  recordPromptSpecs(prompts: PromptSpec[]): Promise<unknown> {
    // TODO locally cache new prompts
    return this.functions.httpsCallable("recordPrompts")({ prompts });
  }

  recordAttachments(attachments: Attachment[]): Promise<unknown> {
    // TODO locally cache attachments
    return this.functions.httpsCallable("recordAttachments")({
      attachments,
    });
  }

  private getData<
    ID extends PromptSpecID | AttachmentID,
    Data extends PromptSpec | Attachment,
    MappedData = Data
  >(
    requestedIDs: Set<ID>,
    mapRetrievedType: (data: Data) => MappedData,
    onUpdate: (snapshot: MetabookDataSnapshot<ID, MappedData>) => void,
  ): { completion: Promise<unknown>; unsubscribe: MetabookUnsubscribe } {
    const dataRef = getDataCollectionReference(this.database);

    const dataSnapshot: MetabookDataSnapshot<ID, MappedData> = new Map(
      [...requestedIDs.values()].map((promptSpecID) => [promptSpecID, null]),
    );

    let isCancelled = false;

    function onFetch(promptSpecID: ID, result: Data | Error) {
      // TODO: Validate spec
      let mappedData: MappedData | Error;
      if (result instanceof Error) {
        mappedData = result;
      } else {
        mappedData = mapRetrievedType(result);
      }
      dataSnapshot.set(promptSpecID, mappedData);
      if (!isCancelled) {
        onUpdate(new Map(dataSnapshot));
      }
    }

    if (requestedIDs.size === 0) {
      onUpdate(new Map());
      return {
        completion: Promise.resolve(),
        unsubscribe: () => {
          return;
        },
      };
    } else {
      const fetchPromises = [...requestedIDs.values()].map(
        async (promptSpecID) => {
          try {
            const cachedData = await dataRef
              .doc(promptSpecID)
              .get({ source: "cache" });
            onFetch(promptSpecID, cachedData.data()! as Data);
          } catch (error) {
            // No cached data available.
            if (!isCancelled) {
              try {
                const cachedData = await dataRef.doc(promptSpecID).get();
                onFetch(promptSpecID, cachedData.data()! as Data);
              } catch (error) {
                onFetch(promptSpecID, error);
              }
            }
          }
        },
      );

      return {
        completion: Promise.all(fetchPromises),
        unsubscribe: () => {
          isCancelled = true;
        },
      };
    }
  }

  getPromptSpecs(
    requestedPromptSpecIDs: Set<PromptSpecID>,
    onUpdate: (
      snapshot: MetabookDataSnapshot<PromptSpecID, PromptSpec>,
    ) => void,
  ): { completion: Promise<unknown>; unsubscribe: MetabookUnsubscribe } {
    return this.getData(
      requestedPromptSpecIDs,
      (data: PromptSpec) => data,
      onUpdate,
    );
  }

  getAttachments(
    requestedAttachmentIDs: Set<AttachmentID>,
    onUpdate: (
      snapshot: MetabookDataSnapshot<AttachmentID, AttachmentURLReference>,
    ) => void,
  ): { completion: Promise<unknown>; unsubscribe: MetabookUnsubscribe } {
    // This is an awfully silly way to handle caching. We'll want to write the attachments out to disk in a temporary directory.
    return this.getData(
      requestedAttachmentIDs,
      (attachment: Attachment): AttachmentURLReference => {
        return getAttachmentURLReferenceForAttachment(attachment);
      },
      onUpdate,
    );
  }
}