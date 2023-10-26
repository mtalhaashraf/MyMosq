<script>
  import { currentUser } from "$lib/store/currentUser.js";
  import { _, time as timeFormat, locale } from "svelte-i18n";
  import { goto } from "$app/navigation";
  import firebase from "$lib/firebase.js";
  import { hasPath, equals } from "ramda";
  import { onMount } from "svelte";
  import { Button } from "sveltestrap";
  import Fa from "svelte-fa/src/fa.svelte";
  import { faTrash } from "@fortawesome/free-solid-svg-icons";

  let posts = [];
  let topics = [];
  let topic = "all";
  let settings = {};

  function deletePost(postId) {
    const confirmation = window.confirm($_("postDeleteConfirmation"));
    if (confirmation === true) {
      firebase.firestore().collection("posts").doc(postId).delete();

      const postToDelete = posts.find((post) => post.id === postId);
      posts = posts.filter((post) => post.id !== postId);
    }
  }

  const getCacheCollection = async (name) => {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(name)
      .get()
      .then((e) => e.data())
      .then((docs) => {
        return Object.entries(docs).map(([k, v]) => ({ id: k, ...v }));
      });
  };

  const getCountryCacheCollection = async (cache, country) => {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(cache)
      .collection(country)
      .doc(cache)
      .get()
      .then((e) => e.data());
  };

  function pairTopic(topicId) {
    const res = topics.find((topic) => {
      return topic.id === topicId;
    });
    if (res) {
      return res.name;
    } else return "N/A";
  }

  function parseTimestamp(ts) {
    const date = ts?.toDate();
    // const date = new Date();

    return (
      `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}` +
      " " +
      $_("postAt") +
      " " +
      $timeFormat(ts?.toDate(), { format: "short" })
    );
  }

  onMount(getPosts);

  function getPosts() {
    Promise.all([
      firebase
        .firestore()
        .collection("posts")
        .get()
        .then((e) => e.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      getCacheCollection("statsPosts"),
    ]).then(([_posts, statsPosts]) => {
      const filteredPosts = _posts.filter(
        (t) => hasPath(["org", "id"])(t) && equals(t.org.id, $currentUser.user.org.id)
      );
      const ids = filteredPosts.map((e) => e.id);
      const stats = statsPosts.filter((e) => ids.includes(e.id));

      posts = filteredPosts.map((e) => {
        const result = stats.find((x) => x.id === e.id);
        if (result) {
          return {
            ...e,
            views: result.views || 0,
          };
        }
        return e;
      });
    });
  }

  onMount(getSettings);
  async function getSettings() {
    settings = await firebase
      .firestore()
      .collection("Settings")
      .doc("settings")
      .get()
      .then((doc) => doc.data());
  }

  $: if (Object.values(settings).length > 0) getTopics();

  function getTopics() {
    if (!settings) return () => null;

    const getAllCacheTopics = async () => {
      const topicsCountryCodes = settings.countries;

      const countryTopics = (
        await Promise.all(
          topicsCountryCodes.map((code) => getCountryCacheCollection("topics", code))
        )
      ).flat();
      const topics = [];
      countryTopics
        .filter((i) => i)
        .forEach((topic) => {
          Object.entries(topic).forEach(([id, data]) => {
            topics.push({ ...data, id });
          });
        });
      return topics;
      // return topics.sort((a, b) => a.id - b.id);
    };
    Promise.all([
      // getCacheCollection("topics"),
      getAllCacheTopics(),
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

  $: if (posts.length && $currentUser.user) filterVisiblePosts();

  function filterVisiblePosts() {
    if ($currentUser.user.role === "admin" && $currentUser.user.org.type === "union") {
    } else if ($currentUser.user.topics && $currentUser.user.topics.length > 0) {
      posts = posts.filter((e) => $currentUser.user.topics.includes(e.topicId));
    } else {
      posts = [];
    }
  }

  $: if (topics.length && $currentUser.user) filterVisibleTopics();

  function filterVisibleTopics() {
    if ($currentUser.user.role === "admin") {
    } else if ($currentUser.user.topics && $currentUser.user.topics.length > 0) {
      topics = topics.filter((e) => $currentUser.user.topics.includes(e.id));
    } else {
      topics = [];
    }
  }

  onMount(() => {
    if (hasPath(["org", "permissions", "publications"])($currentUser.user)) {
      if (!$currentUser.user.org.permissions.publications) {
        goto("/no-access");
      }
    }
  });

  function handleTopicChange(e) {
    e.preventDefault();
    const { value } = e.target.dataset;
    topic = topics.find((t) => t.id === value) || "all";
  }

  function findScheduledPost(postId) {
    return posts.find((e) => e.postId === postId);
  }

  $: filteredPosts = posts
    .sort((a, b) => {
      if (a.createdAt < b.createdAt) return 1;
      else return -1;
    })
    .filter((post) => {
      if (topic === "all") return true;

      if (post.topicId === topic.id) return true;
      else return false;
    });
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      <h5>{$_("posts")}</h5>

      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {topic.name || topic}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          <a class="dropdown-item" on:click={handleTopicChange} href="#" data-value={"all"}>
            {$_("all")}
          </a>
          {#each topics as topic}
            <a class="dropdown-item" on:click={handleTopicChange} href="#" data-value={topic.id}>
              {topic.name}
            </a>
          {/each}
        </div>
      </li>
    </div>

    <div class="custom-menu__item">
      <a href="/posts/add">
        <Button
          color="primary"
          class="btn-default btn-squared radius-xs fs-15 fw-400 text-capitalize"
        >
          {$_("addNew")}
        </Button>
      </a>
    </div>
  </ul>
</div>

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th style="width: 2rem">{$_("title")}</th>
        <th style="width: 2rem">{$_("topic")}</th>
        <th style="width: 2rem">{$_("views")}</th>
        <th style="width: 2rem">{$_("Date")}</th>
        <th style="width: 2rem">{$_("author")}</th>
        <th style="width: 2rem">{$_("actions")}</th>
      </tr>
    </thead>
    <tbody>
      {#each filteredPosts as post}
        <tr>
          <td>
            <a
              href="/posts/{post.id}"
              class={`
                ${post.draft && !post.scheduled ? "text-orange" : ""}
                ${post.scheduled ? "text-green" : ""}
              `}
            >
              {post.title}
            </a>

            {#if post.draft && !post.scheduled}
              <span style="color: #888">&nbsp;(draft)</span>
            {/if}

            {#if post.scheduled}
              <span style="color: #888">
                &nbsp;({$_("scheduled")})
              </span>
            {/if}
          </td>

          {#key topics}
            <td>
              {pairTopic(post.topicId)}
            </td>
          {/key}

          <td>
            {post.views || 0}
          </td>

          <td style="white-space: nowrap;">
            {#key $locale}
              {#if post.scheduled}
                {parseTimestamp(findScheduledPost(post.id)?.scheduledTime)}
              {:else}
                {parseTimestamp(post.createdAt)}
              {/if}
            {/key}
          </td>

          <td style="white-space: nowrap;">
            {post.authorEmail}
          </td>

          <td>
            <Button
              variant="primary"
              on:click={() => deletePost(post.id)}
              class="radius-xs fs-15 fw-400 text-capitalize btn-squared btn-icon"
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
  tr:nth-child(even),
  tr:nth-child(even) td {
    background-color: #f2f2f2;
  }

  .text-orange {
    color: orange !important;
  }

  .text-green {
    color: green !important;
  }
</style>
