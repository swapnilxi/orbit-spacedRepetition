import { OrbitAPI } from "@withorbit/api";
import { Event } from "@withorbit/core";
import { sharedServerDatabase } from "../db";
import { authenticatedRequestHandler } from "./util/authenticateRequest";
import { CachePolicy, TypedRouteHandler } from "./util/typedRouter";
import { putAndLogEvents } from "./util/putAndLogEvents";

export const storeEvents: TypedRouteHandler<
  OrbitAPI.Spec,
  "/2/events",
  "PATCH"
> = authenticatedRequestHandler(async (request, userID) => {
  await putAndLogEvents(userID, request.body);
  return { status: 204 };
});

export const listEvents: TypedRouteHandler<OrbitAPI.Spec, "/2/events", "GET"> =
  authenticatedRequestHandler(async (request, userID) => {
    const db = sharedServerDatabase().getUserDatabase(userID);
    const { query } = request;

    // In order to inform the client whether there are more events available than the requested limit, we query the backend with a limit of one additional result. If that extra result is returned, we know there are more events.
    const queryLimit = query.limit !== undefined ? query.limit + 1 : undefined;

    const events = await db.listEvents({
      limit: queryLimit,
      afterID: query.afterID,
      predicate: query.entityID ? ["entityID", "=", query.entityID] : undefined,
    });

    let results: OrbitAPI.ResponseList2<Event>;
    if (query.limit === undefined) {
      results = {
        type: "list",
        hasMore: false,
        items: events,
      };
    } else {
      results = {
        type: "list",
        hasMore: events.length > query.limit,
        items: events.slice(0, query.limit),
      };
    }

    return { status: 200, json: results, cachePolicy: CachePolicy.NoStore };
  });
