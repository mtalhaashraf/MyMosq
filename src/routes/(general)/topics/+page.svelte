<script>
  import { currentUser } from "$lib/store/currentUser.js";
  import { _ } from "svelte-i18n";
  import { goto } from "$app/navigation";
  import { v4 as uuidv4 } from "uuid";
  import firebase from "$lib/firebase.js";
  import { equals, hasPath } from "ramda";
  import { Button, Alert } from "sveltestrap";
  import Fa from "svelte-fa";
  import { faTrash } from "@fortawesome/free-solid-svg-icons";
  import { isMosqOrUnion } from "@utility/helpers.js";

  let message = null;
  let loading = false;
  let topics = [];

  function addTopic() {
    topics.push({
      org: {
        id: $currentUser.user.org.id,
        type: $currentUser.user.org.type,
      },
      mosqueId: $currentUser.user.org.id,
      name: "",
      id: uuidv4(),
      isNew: true,
    });

    topics = topics;
  }

  async function getCacheCollection(name) {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(name)
      .get()
      .then((e) => e.data())
      .then((docs) => {
        return Object.entries(docs).map(([k, v]) => ({ id: k, ...v }));
      });
  }

  async function deleteTopic(topicId) {
    if (topics.length <= 1) return;

    const topicToDelete = topics.find((topic) => topic.id === topicId);
    if (topicToDelete.isNew === true) {
      topics = topics.filter((topic) => topic.id !== topicId);
    } else {
      const confirmation = window.confirm($_("topicDeleteConfirmation"));
      if (!confirmation) return;

      firebase
        .firestore()
        .collection("posts")
        .where("org.id", "==", $currentUser.user.org.id)
        .where("topicId", "==", topicId)
        .get()
        .then((docs) => {
          if (docs.empty) {
            firebase
              .firestore()
              .collection("topics")
              .doc(topicId)
              .delete()
              .then(() => {
                topics = topics.filter((topic) => topic.id !== topicId);
              });
          } else {
            message = {
              variant: "danger",
              text: $_("topicDeleteError"),
            };
            setTimeout(() => {
              message = null;
            }, 5000);
          }
        });
    }
  }

  function handleInputBlur(e, topicId) {
    message = null;

    const { currentTarget } = e;
    let { textContent } = currentTarget;
    let name = e.currentTarget.getAttribute("data-name");
    const index = topics.findIndex((topic) => topic.id === topicId);
    const regex = /^[a-zA-Z0-9]*$/g;
    if (textContent === topics[index].name) return;

    if (regex.test(textContent) && textContent.length <= 15) {
      topics[index][name] = textContent;
      topics[index].changed = true;
      topics = topics;
    } else {
      e.currentTarget.textContent = topics[index].name;
      message = {
        variant: "danger",
        text: $_("topicNameError"),
      };
    }
  }

  async function handleSubmit(e) {
    console.log("submitting");
    loading = true;
    const topicsToChange = topics.filter((topic) => topic.changed === true && !topic.isNew);
    const newTopics = topics.filter((topic) => topic.isNew === true && topic.name !== "");

    Promise.all([
      ...topicsToChange.map((topic) => {
        const { changed, id, ...rest } = topic;
        return firebase
          .firestore()
          .collection("topics")
          .doc(id)
          .update(rest)
          .then(() => {
            message = {
              variant: "success",
              text: $_("saveSuccessMessage"),
            };
          });
      }),
      ...newTopics.map((topic) => {
        const { isNew, changed, id, ...rest } = topic;
        return firebase
          .firestore()
          .collection("topics")
          .add(rest)
          .then(() => {
            message = {
              variant: "success",
              text: $_("saveSuccessMessage"),
            };
            loading = false;
          });
      }),
    ]).finally(() => {
      loading = false;
    });

    setTimeout(() => {
      message = null;
    }, 5000);
  }

  function getCountryCacheCollection(collection, country) {
    return firebase
      .firestore()
      .collection("cache")
      .doc(collection)
      .collection(country)
      .doc(collection)
      .get()
      .then((e) => e.data())
      .then((docs) => {
        return Object.entries(docs).map(([k, v]) => ({ id: k, ...v }));
      });
  }

  $: if ($currentUser.user) getTopics();
  function getTopics() {
    if (!isMosqOrUnion($currentUser.user)) return;

    Promise.all([
      getCountryCacheCollection("topics", $currentUser.user.org.Country),
      // getCacheCollection("topics"),
      getCacheCollection("statsTopics"),
    ]).then(([_topics, statsTopics]) => {
      const filteredTopics = _topics.filter(
        (t) => hasPath(["org", "id"])(t) && equals(t.org.id, $currentUser.user.org.id)
      );
      const ids = filteredTopics.map((e) => e.id);
      const stats = statsTopics.filter((e) => ids.includes(e.id));

      topics = filteredTopics.map((e) => {
        const result = stats.find((x) => x.id === e.id);
        if (result) {
          return {
            ...e,
            subs: result.subs || 0,
            numPosts: result.numPosts || 0,
          };
        }
        return e;
      });
    });
  }

  $: if ($currentUser.user) checkPermissions();
  function checkPermissions() {
    if (hasPath(["org", "permissions", "publications"])($currentUser.user)) {
      if (!$currentUser.user.org.permissions.publications) {
        goto("/no-access");
      }
    }
  }

  $: console.log({ topics });
  const MAX_TOPICS_COUNT = 5;
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <h1>{$_("topics")}</h1>

    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      {#if topics.length < MAX_TOPICS_COUNT}
        <li class="custom-menu__item" style="display: flex; gap: 0.4rem;">
          <button class="btn btn-primary" on:click={addTopic}>
            {$_("addNew")}
          </button>
        </li>
      {/if}
    </div>
  </ul>
</div>

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th>{$_("name")}</th>
        <th style="width: 4rem;">{$_("actions")}</th>
      </tr>
    </thead>
    <tbody>
      {#each topics as topic}
        <tr
          class:should-delete={topic.shouldDelete}
          class:is-new={topic.isNew}
          class:changed={topic.changed}
        >
          <td
            type="text"
            data-name="name"
            value={topic.name}
            on:blur={(e) => handleInputBlur(e, topic.id)}
            contenteditable
            placeholder={$_("topicNamePlaceholder")}
          >
            {topic.name}
          </td>
          <td>
            <Button
              class="btn btn-icon btn-squared btn-primary"
              on:click={() => deleteTopic(topic.id)}
              disabled={topics.length <= 1}
            >
              <Fa icon={faTrash} color="white" />
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if message?.variant}
  <Alert color={message.variant}>{message.text}</Alert>
{/if}

{#if topics.filter((e) => e.changed || e.isNew).length}
  <Button on:click={handleSubmit} disabled={loading}>
    {#if loading}
      {$_("loading")}
    {:else}
      {$_("confirChanges")}
    {/if}
  </Button>
{/if}

<style lang="scss">
  .should-delete {
    color: "#9f3a38";
    background: "#fff6f6";
  }
  .is-new {
    background: "#fcfff5";
    color: "#2c662d";
  }
  .changed {
    background: "#fffaf3";
    color: "#573a08";
  }
</style>
