<script>
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { _ } from "svelte-i18n";
  import { currentUser } from "$lib/store/currentUser.js";
  import firebase from "$lib/firebase.js";
  import { isMosq } from "@utility/helpers.js";
  import { equals, hasPath } from "ramda";

  let mosque = {};
  let topics = [];

  $: console.log({ mosque, topics });

  $: totalPosts = topics.reduce((acc, cur) => {
    return acc + (cur.numPosts || 0);
  }, 0);

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
    console.log("Fetching " + name + "...");
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

  let unsubscribes = [];
  function clearUnsubscribes() {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  }
  onDestroy(clearUnsubscribes);

  $: if ($currentUser.user) {
    getStatsMosques();
    getStatsTopics();
    checkPermissions();
  }

  function getStatsMosques() {
    if (!isMosq($currentUser.user)) return;

    const unsubscribe = firebase
      .firestore()
      .collection("statsMosques")
      .doc($currentUser.user.org.id)
      .onSnapshot((snapshot) => {
        const data = snapshot.data();
        mosque = data;
      });

    unsubscribes.push(unsubscribe);
  }

  function getStatsTopics() {
    if (!isMosq($currentUser.user)) return;
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
  <h5>{$_("mosqueSubscriptions")}</h5>
  <ul>
    <li>
      {$_("total")} <b>{mosque.subs || 0}</b>
    </li>
    <li>
      {$_("android")} <b>{mosque.subsAndroid || 0}</b>
    </li>
    <li>
      {$_("ios")} <b>{mosque.subsIos || 0}</b>
    </li>
  </ul>
</div>

<div class="stat-section">
  <h5>{$_("newsSubscriptions")}</h5>
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
