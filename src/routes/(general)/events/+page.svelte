<script>
  import { currentUser } from "@store/currentUser.js";
  import firebase from "$lib/firebase.js";
  import { _ } from "svelte-i18n";
  import EventRow from "./EventRow.svelte";

  let events = [];
  let eventCreateOrUpdateType = "none";

  function eventsDateSort(a, b) {
    return new Date(a.date.seconds * 1000) - new Date(b.date.seconds * 1000);
  }

  $: sortedEvents = [...events].sort(eventsDateSort);

  async function getEvents() {
    console.log("getting events");

    return await firebase
      .firestore()
      .collection("events")
      .where("org.id", "==", $currentUser.user?.org?.id)
      .get()
      .then((e) => {
        let data = [];
        if (e.docs.length) {
          data = e.docs[0].data().events;
        }
        events = data.sort(eventsDateSort);
      });
  }
  $: if ($currentUser.user) getEvents();

  function openEventCreateMenu() {
    eventCreateOrUpdateType = "create";
  }
  function closeEventCreateOrUpdateMenu() {
    eventCreateOrUpdateType = "none";
  }

  async function createEvents(pendingCreations) {
    if (!pendingCreations.length) return;

    const eventsToCreate = pendingCreations.map((event) => ({
      event: event.event || "",
      date: event.date,
    }));

    const hasEventsRecord = await firebase
      .firestore()
      .collection("events")
      .where("org.id", "==", $currentUser.user?.org.id)
      .get()
      .then((e) => e.docs.length);

    if (hasEventsRecord) {
      const eventDoc = await firebase
        .firestore()
        .collection("events")
        .where("org.id", "==", $currentUser.user?.org.id)
        .get()
        .then((e) => e.docs[0]);

      await firebase
        .firestore()
        .collection("events")
        .doc(eventDoc.id)
        .update(
          {
            events: [...eventDoc.data().events, ...eventsToCreate].sort(eventsDateSort),
          },
          { merge: true }
        );
    } else {
      await firebase
        .firestore()
        .collection("events")
        .doc()
        .set({
          events: eventsToCreate.sort(eventsDateSort),
          org: {
            id: $currentUser.user?.org.id,
            type: $currentUser.user?.org.type,
          },
        });
    }
  }

  async function updateEvents(pendingUpdates) {
    if (!Object.keys(pendingUpdates).length) return;

    const eventDoc = await firebase
      .firestore()
      .collection("events")
      .where("org.id", "==", $currentUser.user?.org.id)
      .get()
      .then((e) => e.docs[0]);

    await firebase
      .firestore()
      .collection("events")
      .doc(eventDoc.id)
      .update(
        {
          events: eventDoc
            .data()
            .events.sort(eventsDateSort)
            .map((event, index) => {
              if (pendingUpdates[index]) return pendingUpdates[index];
              else return event;
            })
            .sort(eventsDateSort),
        },
        { merge: true }
      );
  }

  async function deleteEvents(pendingDeletions) {
    if (!pendingDeletions.length) return;

    const eventDoc = await firebase
      .firestore()
      .collection("events")
      .where("org.id", "==", $currentUser.user?.org.id)
      .get()
      .then((e) => e.docs[0]);

    await firebase
      .firestore()
      .collection("events")
      .doc(eventDoc.id)
      .update(
        {
          events: eventDoc
            .data()
            .events.filter((_, i) => !pendingDeletions.includes(i))
            .sort(eventsDateSort),
        },
        { merge: true }
      );
  }
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal"
    style="display: flex; justify-content: space-between; padding: 1rem"
  >
    <h1>{$_("events")}</h1>

    {#if eventCreateOrUpdateType === "none"}
      <li class="custom-menu__item">
        <button class="btn btn-primary" on:click={openEventCreateMenu}>
          {$_("addNew")}
        </button>
      </li>
    {/if}
  </ul>
</div>

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr style="display: flex;">
        <th style="width: 20ch;">
          {$_("date")}
        </th>
        <th style="width: 100%;">
          {$_("event")}
        </th>
        <th>
          {$_("actions")}
        </th>
      </tr>
    </thead>

    <tbody>
      {#each sortedEvents as event, i}
        <EventRow
          {event}
          on:done={getEvents}
          originalIndex={i + 1}
          {updateEvents}
          {deleteEvents}
          {createEvents}
        />
      {/each}

      {#if eventCreateOrUpdateType === "create"}
        <EventRow
          inputType="create"
          on:done={getEvents}
          {updateEvents}
          {deleteEvents}
          {createEvents}
          {closeEventCreateOrUpdateMenu}
        />
      {/if}
    </tbody>
  </table>
</div>
