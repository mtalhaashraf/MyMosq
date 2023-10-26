<script>
  import { _ } from "svelte-i18n";
  import { createEventDispatcher } from "svelte";
  import Fa from "svelte-fa";
  import {
    faPen,
    faTrash,
    faCheck,
    faExclamationCircle,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from "sveltestrap";

  const dispatch = createEventDispatcher();

  export let event;
  export let updateEvents;
  export let deleteEvents;
  export let createEvents;
  export let originalIndex;
  export let inputType = "none";
  export let closeEventCreateOrUpdateMenu = () => {};

  let inputMode = inputType;
  let eventData = {
    ...event,
    date: event?.date
      ? new Date(event?.date?.seconds * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  };
  let loading;

  async function handleEventUpdate() {
    loading = true;

    await updateEvents({
      [originalIndex - 1]: {
        event: eventData.event,
        date: new Date(eventData.date),
      },
    });

    inputMode = "none";
    loading = false;

    dispatch("done");
  }

  async function handleEventDelete() {
    loading = true;

    await deleteEvents([originalIndex]);

    inputMode = "none";
    loading = false;

    dispatch("done");
  }

  async function handleEventCreate() {
    loading = true;

    await createEvents([
      {
        event: eventData.event,
        date: new Date(eventData.date),
      },
    ]);

    inputMode = "none";
    closeEventCreateOrUpdateMenu();

    dispatch("done");
  }

  function closeDeleteModal() {
    inputMode = "none";
    closeEventCreateOrUpdateMenu();
  }

  function cancelUpdateOrCreate() {
    inputMode = "none";
    closeEventCreateOrUpdateMenu();
  }
</script>

<tr style="display: flex">
  {#if inputMode === "none" || inputMode === "delete"}
    <td style="width: 20ch;">{event?.date?.toDate().toDateString()}</td>

    <td style="width: 100%;">{event?.event}</td>
  {/if}

  {#if inputMode === "create" || inputMode === "update"}
    <td style={{ width: "20ch" }}>
      <input
        type="date"
        required
        bind:value={eventData.date}
        autoComplete="off"
        on:focus={(e) => e.target.removeAttribute("readonly")}
        readonly
        style="background-color: white; width: 100%; border: none; padding: 0.2rem;"
      />
    </td>

    <td style="width: 100%;">
      <input
        type="text"
        required
        placeholder={$_("event")}
        bind:value={eventData.event}
        autoComplete="off"
        on:focus={(e) => e.target.removeAttribute("readonly")}
        readonly
        style="background-color: white; width: 100%; border: none; padding: 0.2rem;"
      />
    </td>
  {/if}

  <td style="display: flex; gap: 1rem;">
    {#if inputMode === "none"}
      <Button class="btn btn-icon btn-squared btn-primary" on:click={() => (inputMode = "update")}>
        <Fa class="events-action-button" icon={faPen} color="white" />
      </Button>
      <Button class="btn btn-icon btn-squared btn-danger" on:click={() => (inputMode = "delete")}>
        <Fa class="events-action-button" icon={faTrash} color="white" />
      </Button>
    {/if}

    {#if inputMode === "update"}
      <Button
        disabled={loading}
        class="btn btn-icon btn-squared btn-success"
        on:click={handleEventUpdate}
      >
        <Fa class="events-action-button" icon={faCheck} color="white" />
      </Button>
      <Button
        disabled={loading}
        class="btn btn-icon btn-squared btn-warning"
        on:click={cancelUpdateOrCreate}
      >
        <Fa class="events-action-button" icon={faXmark} color="white" />
      </Button>
    {/if}

    {#if inputMode === "create"}
      <Button
        disabled={loading}
        class="btn btn-icon btn-squared btn-success"
        on:click={handleEventCreate}
      >
        <Fa class="events-action-button" icon={faCheck} color="white" />
      </Button>
      <Button
        disabled={loading}
        class="btn btn-icon btn-squared btn-warning"
        on:click={cancelUpdateOrCreate}
      >
        <Fa class="events-action-button" icon={faXmark} color="white" />
      </Button>
    {/if}
  </td>
</tr>

<Modal isOpen={inputMode === "delete"} toggle={closeDeleteModal}>
  <ModalHeader toggle={closeDeleteModal}>
    <h3>Delete Event</h3>
  </ModalHeader>
  <ModalBody>Are you sure you want to delete this event?</ModalBody>
  <ModalFooter>
    <Button disabled={loading} class="action-btn btn btn-dark" on:click={closeDeleteModal}>
      {$_("Close")}
    </Button>
    <Button disabled={loading} class="action-btn btn btn-primary" on:click={handleEventDelete}>
      {$_("Delete")}
    </Button>
  </ModalFooter>
</Modal>

<style>
  button {
    height: 2rem;
    width: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .action-btn {
    padding: 1rem 2rem;
  }

  tr:nth-child(even),
  tr:nth-child(even) td {
    background-color: #f2f2f2;
  }
</style>
