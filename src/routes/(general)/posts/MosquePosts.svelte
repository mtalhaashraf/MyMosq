<script>
  import firebase from "$lib/firebase.js";
  import { _, time as timeFormat, locale } from "svelte-i18n";
  import { currentUser } from "@store/currentUser.js";
  import { hasPath, equals, both, has } from "ramda";
  import { Button } from "sveltestrap";
  import Fa from "svelte-fa";
  import { faTrash } from "@fortawesome/free-solid-svg-icons";

  let posts = [];
  let topics = [];
  let scheduledPosts = [];
  let topic = "all";

  async function deletePost(postId) {
    const confirmation = window.confirm($_("postDeleteConfirmation"));
    if (!confirmation) return;

    await firebase.firestore().collection("posts").doc(postId).delete();

    const postToDelete = posts.find((post) => post.id === postId);
    posts = posts.filter((post) => post.id !== postId);

    if (!postToDelete.scheduled) return;

    await firebase
      .firestore()
      .collection("scheduledPosts")
      .where("postId", "==", postId)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          doc.ref.delete();
        });
      });
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

  async function getCountryCacheCollection(cache, country) {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(cache)
      .collection(country)
      .doc(cache)
      .get()
      .then((e) => e.data());
  }

  function pairTopic(topicId) {
    const res = topics.find((topic) => {
      return topic.id === topicId;
    });
    if (res) {
      return res.name;
    } else return "N/A";
  }

  function parseTimestamp(ts) {
    // return $_("postDate", { date: ts?.toDate() });
    // return (
    //   $dateFormat(ts?.toDate(), { format: "short" }) +
    //   " " +
    //   $_("postAt") +
    //   " " +
    //   $timeFormat(ts?.toDate(), { format: "short" })
    // );

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

  $: if ($currentUser.user) getData();

  async function getData() {
    console.log("fetching data");

    if (
      hasPath(["org", "permissions", "publications"])($currentUser.user) &&
      !$currentUser.user.org.permissions.publications
    ) {
      return;
    }

    const [_posts, statsPosts] = await Promise.all([
      firebase
        .firestore()
        .collection("posts")
        .get()
        .then((e) => e.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      getCacheCollection("statsPosts"),
    ]);

    const filteredPosts = _posts.filter(
      (t) => hasPath(["org", "id"])(t) && equals(t.org.id, $currentUser.user.org.id)
    );
    const postIds = filteredPosts.map((e) => e.id);
    const postStats = statsPosts.filter((e) => postIds.includes(e.id));

    const filteredStatsPosts = filteredPosts.map((e) => {
      const result = postStats.find((x) => x.id === e.id);
      if (result) {
        return {
          ...e,
          views: result.views || 0,
        };
      }
      return e;
    });

    const _scheduledPosts = [];
    const scheduledPostsToFetch = filteredPosts.filter((post) => post.scheduled);
    for (const post of scheduledPostsToFetch) {
      await firebase
        .firestore()
        .collection("scheduledPosts")
        .where("postId", "==", post.id)
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            _scheduledPosts.push({ id: doc.id, ...doc.data() });
          });
        });
    }
    scheduledPosts = _scheduledPosts;

    if (
      both(has("role"), has("topics"))($currentUser.user) &&
      equals("publisher", $currentUser.user.role)
    ) {
      posts = filteredStatsPosts.filter((e) => $currentUser.user.topics.includes(e.topicId));
    } else if (equals($currentUser.user.role, "admin")) {
      posts = filteredStatsPosts;
    }

    const [
      // topics,
      statsTopics,
      cacheTopics,
    ] = await Promise.all([
      // getCacheCollection("topics"),
      getCacheCollection("statsTopics"),
      getCountryCacheCollection("topics", $currentUser.user.org.Country),
    ]);
    const _topics = Object.entries(cacheTopics).map(([k, v]) => ({ id: k, ...v }));

    const filteredTopics = _topics.filter(
      (t) => hasPath(["org", "id"])(t) && equals(t.org.id, $currentUser.user.org.id)
    );
    const topicIds = filteredTopics.map((e) => e.id);
    const topicStats = statsTopics.filter((e) => topicIds.includes(e.id));

    const filteredStatsTopics = filteredTopics.map((e) => {
      const result = topicStats.find((x) => x.id === e.id);
      if (result) {
        return {
          ...e,
          subs: result.subs || 0,
          numPosts: result.numPosts || 0,
        };
      }
      return e;
    });

    if (
      both(has("role"), has("topics"))($currentUser.user) &&
      equals("publisher", $currentUser.user.role)
    ) {
      topics = filteredStatsTopics.filter((e) => $currentUser.user.topics.includes(e.id));
      posts = posts; // reload calculated value
    } else if (equals($currentUser.user.role, "admin")) {
      topics = filteredStatsTopics;
      posts = posts; // reload calculated value
    }
  }

  function handleTopicChange(e) {
    e.preventDefault();
    const { value } = e.target.dataset;
    topic = topics.find((t) => t.id === value) || "all";
  }

  function findScheduledPost(postId) {
    return scheduledPosts.find((e) => e.postId === postId);
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
