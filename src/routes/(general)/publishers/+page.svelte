<script>
  import { currentUser } from "$lib/store/currentUser.js";
  import { isMosq } from "@utility/helpers.js";
  import Fa from "svelte-fa";
  import { faRedo, faTrash } from "@fortawesome/free-solid-svg-icons";
  import firebase, { auth, functions } from "$lib/firebase.js";
  import { _ } from "svelte-i18n";
  import { onDestroy } from "svelte";
  import { Button } from "sveltestrap";

  let publishers = [];
  let topics = [];

  function deletePublisher(userId) {
    const confirmation = window.confirm($_("publisherDeleteConfirmation"));
    if (confirmation === true) {
      const deleteUser = functions.httpsCallable("deleteUser");
      publishers = publishers.filter((publisher) => publisher.id !== userId);
      deleteUser({ uid: userId });
    }
  }

  async function handleTopicChange(e, uid) {
    const { target } = e;
    const container = target.closest(".topics-container");
    const inputs = container.querySelectorAll("input");
    const arr = Array.from(inputs);
    const newTopics = arr
      .map((input) => {
        if (input.checked) return input.id;
        else return null;
      })
      .filter((val) => val);

    console.log({ arr, newTopics });

    await firebase.firestore().collection("users").doc(uid).update({ topics: newTopics });
    console.log("updated topics", newTopics);
  }

  async function handleCheckboxChange(e, uid) {
    const { target } = e;
    const { name, checked } = target;

    await firebase
      .firestore()
      .collection("users")
      .doc(uid)
      .update({ [name]: checked });
  }

  function handlePasswordReset(email) {
    auth.sendPasswordResetEmail(email);
  }

  let unsubscribes = [];
  function clearUnsubscribes() {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  }
  onDestroy(clearUnsubscribes);

  $: if ($currentUser.user) {
    clearUnsubscribes();
    getPublishers();
    getTopics();
  }

  function getPublishers() {
    if (!isMosq($currentUser.user)) return;

    console.log("getting publishers");

    const unsubscribe = firebase
      .firestore()
      .collection("users")
      .where("org.id", "==", $currentUser.user.org.id)
      .where("role", "==", "publisher")
      .onSnapshot((snapshot) => {
        const arr = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
          };
        });

        publishers = arr;
      });

    unsubscribes.push(unsubscribe);
  }

  function getTopics() {
    if (!isMosq($currentUser.user)) return;

    const unsubscribe = firebase
      .firestore()
      .collection("topics")
      .where("org.id", "==", $currentUser.user.org.id)
      .onSnapshot((snapshot) => {
        const arr = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
          };
        });

        topics = arr;
      });

    unsubscribes.push(unsubscribe);
  }

  $: console.log({ publishers, topics });
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal"
    style="display: flex; justify-content: space-between; padding: 1rem"
  >
    <h1>{$_("publishers")}</h1>

    <li class="custom-menu__item">
      <a href="/publishers/add">
        <button class="btn btn-primary">
          {$_("addNew")}
        </button>
      </a>
    </li>
  </ul>
</div>

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th>{$_("email")}</th>
        <th>{$_("topics")}</th>
        <th>{$_("prayerTimes")}</th>
        <th>{$_("notes")}</th>
        <th>{$_("actions")}</th>
      </tr>
    </thead>
    <tbody>
      {#each publishers as user}
        <tr class:should-delete={user.shouldDelete} class:is-new={user.isNew}>
          <td>{user.email || `${user.id} - undefined`}</td>
          <td class="topics-container">
            {#each topics as topic}
              <div style="display: flex; align-items: center;">
                <input
                  type="checkbox"
                  id={topic.id}
                  name={"topic-" + topic.id}
                  checked={!!user.topics.find((x) => x === topic.id)}
                  on:change={(e) => handleTopicChange(e, user.id)}
                />

                <label for={`${user.id}-${topic.id}`}>
                  &nbsp;
                  {topic.name}
                </label>
              </div>
            {/each}
          </td>
          <td>
            <input
              type="checkbox"
              checked={user.canEditPrayerTimes}
              on:change={(e) => handleCheckboxChange(e, user.id)}
              name="canEditPrayerTimes"
              style="transform: scale(1.5);"
            />
          </td>
          <td>
            <input
              type="checkbox"
              checked={user.canEditNotes}
              on:change={(e) => handleCheckboxChange(e, user.id)}
              name="canEditNotes"
              style="transform: scale(1.5);"
            />
          </td>
          <td style="white-space: nowrap;">
            <Button
              variant="primary"
              on:click={() => handlePasswordReset(user.email)}
              class="btn btn-icon btn-squared btn-primary"
              style="margin-bottom: 1rem;"
            >
              <Fa icon={faRedo} color="white" />
            </Button>
            <Button
              variant="primary"
              style={{ marginLeft: "0.5rem" }}
              on:click={() => deletePublisher(user.id)}
              class="btn btn-icon btn-squared btn-danger"
            >
              <Fa icon={faTrash} color="white" />
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .should-delete {
    background: #fff6f6;
    color: #9f3a38;
  }

  .is-new {
    background: #fcfff5;
    color: #2c662d;
  }
</style>
