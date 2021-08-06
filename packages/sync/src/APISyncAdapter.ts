import OrbitAPIClient from "@withorbit/api-client";
import {
  AttachmentID,
  AttachmentMIMEType,
  Event,
  EventID,
} from "@withorbit/core2";
import { SyncAdapter } from "./syncAdapter";

export class APISyncAdapter implements SyncAdapter {
  id: string;
  private readonly _apiClient: OrbitAPIClient;

  constructor(apiClient: OrbitAPIClient, syncID: string) {
    this.id = syncID;
    this._apiClient = apiClient;
  }

  async listEvents(
    afterEventID: EventID | null,
    limit: number,
  ): Promise<Event[]> {
    const response = await this._apiClient.listEvents2({
      afterID: afterEventID ?? undefined,
      limit: limit,
    });
    return response.items;
  }

  async putEvents(events: Event[]): Promise<void> {
    await this._apiClient.putEvents2(events);
  }

  async putAttachment(
    contents: Uint8Array,
    id: AttachmentID,
    type: AttachmentMIMEType,
  ): Promise<void> {
    // TODO: Implement v2 API for storing an attachment
    await this._apiClient.storeAttachment({
      type: "image", // HACK
      // @ts-ignore TODO HACK: duck-casting core2 to core MIME types
      mimeType: type,
      contents,
    });
  }

  async getAttachmentContents(id: AttachmentID): Promise<Uint8Array> {
    const blobLike = await this._apiClient.getAttachment2(id);
    return new Uint8Array(await blobLike.arrayBuffer());
  }
}