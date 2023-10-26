<script>
  import { currentUser } from "$lib/store/currentUser.js";
  import { goto } from "$app/navigation";
  import firebase from "$lib/firebase.js";
  import { _ } from "svelte-i18n";
  import { equals, hasPath } from "ramda";

  let topics = [];
  let posts = [];
  let subscriptions = 0;

  $: totalPosts = topics.reduce((acc, cur) => {
    return acc + (cur.numPosts || 0);
  }, 0);

  function pairTopicSubs(unionId) {
    const unionTopic = topics.find((e) => e.org && e.org.id === unionId);
    if (unionTopic && unionTopic.subs) {
      subscriptions = unionTopic.subs;
    }
  }

  function pairTopicPosts(unionId) {
    const unionTopic = topics.find((e) => e.org && e.org.id === unionId);
    let numPosts = 0;
    if (unionTopic && unionTopic.numPosts) {
      numPosts = unionTopic.numPosts;
    }

    posts = numPosts;
  }

  const getNestedCacheCollection = async (collectionName, countryName) => {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(collectionName)
      .collection(countryName)
      .doc(collectionName)
      .get()
      .then((e) => e.data())
      .then((docs) => {
        if (!docs) return [];

        return Object.entries(docs).map(([k, v]) => ({ id: k, ...v }));
      });
  };

  const getCacheCollection = async (name) => {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(name)
      .get()
      .then((e) => e.data())
      .then((docs) => {
        if (!docs) return [];

        return Object.entries(docs).map(([k, v]) => ({ id: k, ...v }));
      });
  };

  $: if ($currentUser.user?.org) getTopics();
  function getTopics() {
    Promise.all([
      getNestedCacheCollection("topics", $currentUser.user.org.Country),
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

  $: if ($currentUser.user.org.id && topics.length) {
    pairTopicPosts($currentUser.user.org.id);
    pairTopicSubs($currentUser.user.org.id);
  }

  $: if ($currentUser.user) checkPermissions();
  function checkPermissions() {
    if (hasPath(["org", "permissions", "publications"])($currentUser.user)) {
      if (!$currentUser.user.org.permissions.publications) {
        goto("/no-access");
      }
    }
  }
</script>

<h1>{$_("statistics")}</h1>

<div class="stat-section">
  <h5>{$_("unionSubscriptions")}</h5>
  <ul>
    {#each topics as topic}
      <li style="text-transform: capitalize">
        {topic.name} <b>{topic.subs || 0}</b>
      </li>
    {/each}
  </ul>
</div>

<div class="stat-section">
  <h5>{$_("posts")}</h5>
  <ul>
    <li>
      {$_("total")} <b>{totalPosts}</b>
    </li>
    {#each topics as topic}
      <li style="text-transform: capitalize">
        {topic.name} <b>{topic.numPosts || 0}</b>
      </li>
    {/each}
  </ul>
</div>

<style>
  .stat-section {
    margin: 1rem;
  }

  ul {
    list-style: circle;
    padding-left: 2rem;
  }
</style>
