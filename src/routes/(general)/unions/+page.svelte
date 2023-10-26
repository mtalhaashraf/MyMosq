<script>
  import { equals, hasPath } from "ramda";
  import { currentUser } from "$lib/store/currentUser.js";
  import { _ } from "svelte-i18n";
  import { isSuperAdmin } from "@utility/helpers.js";
  import firebase from "$lib/firebase.js";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Fa from "svelte-fa";
  import { faPlus } from "@fortawesome/free-solid-svg-icons";
  import { Button } from "sveltestrap";

  let admins = [];
  let topics = [];
  let unions = [];

  function handleCountryChange(e) {
    $currentUser.selectedCountry = e.target.dataset.value;
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

  function pairAdmins(unionId) {
    const arr = admins.filter((admin) => {
      return admin.org.id === unionId;
    });
    if (arr.length > 0) {
      return arr.map((admin) => admin.email || admin.org.id);
    } else return null;
  }

  function pairTopicSubs(unionId) {
    const arr = topics.filter((e) => e.org && e.org.id === unionId);
    if (arr.length > 0) {
      return arr.map((topic) => topic.subs | 0);
    } else return null;
  }

  function pairTopicPosts(unionId) {
    const arr = topics.filter((e) => e.org && e.org.id === unionId);
    if (arr.length > 0) {
      return arr.map((topic) => topic.numPosts || 0);
    } else return null;
  }

  async function handleUnionPostsEnabled(e, unionId) {
    const { target } = e;
    const { checked, name } = target;

    console.log("updating permission", name, checked, unionId);

    await firebase
      .firestore()
      .collection("Unions")
      .doc("unions")
      .update({
        [`${unionId}.${name}`]: checked,
      });
  }

  function createGeneralTopic(unionId) {
    firebase
      .firestore()
      .collection("topics")
      .add({
        org: {
          id: unionId,
          type: "union",
        },
        name: "general",
      });
  }

  function pairTopics(unionId) {
    const arr = topics.filter((topic) => topic.org && topic.org.id === unionId);
    if (arr.length > 0) {
      return arr.map((topic) => topic.name || topic.id);
    } else return [];
  }
  //   return (
  //     <Button variant="primary" onClick={() => createGeneralTopic(unionId)}>
  //       <FontAwesomeIcon icon={faPlus} color="white" />
  //     </Button>
  //   );

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

  $: if ($currentUser.user && $currentUser.settings.countries) getTopics();

  async function getTopics() {
    console.log("getting topics");

    const getAllCacheTopics = async () => {
      const topicsCountryCodes = $currentUser.settings.countries;

      let countryTopics = (
        await Promise.all(
          topicsCountryCodes.map((code) => getCountryCacheCollection("topics", code))
        )
      ).flat();

      // NOTE: this is a temporary measure to filter out undefined topics
      countryTopics = countryTopics.filter((topic) => topic);

      const topics = [];
      countryTopics.forEach((topic) => {
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
      const ids = _topics.map((e) => e.id);
      const stats = statsTopics.filter((e) => ids.includes(e.id));

      topics = _topics.map((e) => {
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

  $: if ($currentUser.user) getAdmins();

  function getAdmins() {
    getCacheCollection("users")
      .then((docs) =>
        docs.filter((e) => hasPath(["org", "type"])(e) && equals(e.org.type, "union"))
      )
      .then((docs) => docs.map(({ id, ...rest }) => ({ userId: id, ...rest })))
      .then((cacheUsers) => {
        admins = cacheUsers;
      });
  }

  onMount(getUnions);
  function getUnions() {
    Promise.all([
      firebase
        .firestore()
        .collection("Unions")
        .doc("unions")
        .get()
        .then((e) => e.data())
        .then((docs) => Object.entries(docs).map(([k, v]) => ({ id: k, ...v }))),
      getCacheCollection("statsUnions"),
    ]).then(([_unions, statsUnions]) => {
      const ids = _unions.map((e) => e.id);
      const stats = statsUnions.filter((e) => ids.includes(e.id));
      unions = _unions.map((e) => {
        const result = stats.find((x) => x.id === e.id);
        if (result) {
          return {
            ...e,
            subs: result.numPosts || 0,
          };
        }
        return e;
      });
    });
  }

  $: if ($currentUser.user) checkAuthorization();
  function checkAuthorization() {
    if (hasPath(["org", "permissions", "publications"])($currentUser.user)) {
      if (!$currentUser.user.org.permissions?.publications) {
        goto("/no-access");
      }
    }
  }

  function handleExport(e) {
    const header = [
      [
        "UnionID",
        "Fullname",
        "Shortname",
        "Category",
        "Ort",
        "Plz",
        "Strasse",
        "Country",
        "Website",
        "parentUnion",
        "Topics",
        "Topic Subscriptions",
        "Posts in Topics",
        "permissions.adminPanel",
        "permissions.activeOrg",
        "permissions.publications",
      ],
    ];
    const res = unions
      .filter((union) => {
        if ($currentUser.selectedCountry === "all") return true;

        return union.Country === $currentUser.selectedCountry;
      })
      .reduce((acc, x) => {
        const {
          Category,
          Country,
          Fullname,
          Ort,
          Plz,
          Shortname,
          Strasse,
          Website,
          id,
          parentUnion,
          permissions,
        } = x;

        const topicNames = topics
          .filter((topic) => topic.org && topic.org.id === id)
          .map((topic) => topic.name || topic.id)
          .join(", ");
        const topicSubscriptions = topics
          .filter((topic) => topic.org && topic.org.id === id)
          .map((topic) => topic.subs || 0)
          .join(", ");
        const postsInTopic = topics
          .filter((topic) => topic.org && topic.org.id === id)
          .map((topic) => topic.numPosts || 0)
          .join(", ");

        acc.push([
          id,
          Fullname,
          Shortname,
          Category,
          Ort,
          Plz,
          Strasse,
          Country,
          Website,
          parentUnion,
          topicNames,
          topicSubscriptions,
          postsInTopic,
          permissions?.adminPanel,
          permissions?.activeOrg,
          permissions?.publications,
        ]);
        return acc;
      }, []);
    let rows = [...header, ...res];
    var universalBOM = "\uFEFF";
    let csvContent =
      "data:text/csv;charset=utf-8," + universalBOM + rows.map((e) => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    const now = new Date();
    const str = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;

    let filteredCountryTag =
      $currentUser.selectedCountry !== "all" ? "_" + $currentUser.selectedCountry : "";

    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mymosq_unions_${str}${filteredCountryTag}.csv`);
    document.body.appendChild(link); // Required for FF

    link.click(); // This will download the data file named "my_data.csv"
  }

  $: console.log({ admins, unions, topics });

  function isGreater(x, y) {
    return x.toLowerCase() > y.toLowerCase() ? 1 : -1;
  }

  $: filteredUnions = unions
    .filter((union) => {
      if (!$currentUser.selectedCountry) return false;

      if ($currentUser.selectedCountry === "all") return true;
      return union.Country === $currentUser.selectedCountry;
    })
    .sort((x, y) => {
      if (!x.Country || !y.Country) return true;
      if (x.Country[0] === y.Country[0]) {
        return isGreater(x.Shortname, y.Shortname);
      } else {
        return isGreater(x.Country, y.Country);
      }
    });
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <h1>{$_("unions")}</h1>

    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {$_($currentUser.selectedCountry)}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          <a
            class="dropdown-item"
            on:click|preventDefault={handleCountryChange}
            href="#"
            data-value={"all"}
          >
            {"all"}
          </a>
          {#each $currentUser.settings?.countries || [] as country}
            <a
              class="dropdown-item"
              on:click|preventDefault={handleCountryChange}
              href="#"
              data-value={country}
            >
              {$_(country)}
            </a>
          {/each}
        </div>
      </li>

      <li class="custom-menu__item" style="display: flex; gap: 0.4rem;">
        <button class="btn btn-primary" on:click={handleExport}>
          {$_("export")}
        </button>
      </li>
    </div>
  </ul>
</div>

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th style="max-width: 200px">{$_("union")}</th>
        <th>{$_("admins")}</th>
        <th>{$_("topics")}</th>
        <th class="tb-rl">
          <span class="vertical-text">
            {$_("topicSubscriptions")}
          </span>
        </th>
        <th class="tb-rl">
          <span class="vertical-text">
            {$_("postsInTopic")}
          </span>
        </th>
        <th class="tb-rl">
          <span class="vertical-text">
            {$_("activeOrg")}
          </span>
        </th>
        <th class="tb-rl">
          <span class="vertical-text">
            {$_("adminPanel")}
          </span>
        </th>
        <th class="tb-rl">
          <span class="vertical-text">
            {$_("publications")}
          </span>
        </th>
      </tr>
    </thead>
    <tbody>
      {#key (admins, unions, topics)}
        {#each filteredUnions as { id, Country, Shortname, Fullname, permissions }}
          {@const pairedAdmins = pairAdmins(id)}
          {@const pairedTopics = pairTopics(id)}
          {@const pairedTopicSubs = pairTopicSubs(id)}
          {@const pairedTopicPosts = pairTopicPosts(id)}

          <tr>
            <td>{`${Country} - ${Shortname} - ${Fullname}`}</td>
            <td>
              {#if pairedAdmins}
                {#each pairedAdmins as admin}
                  <div class="flex-col-center">
                    <span>{admin}</span>
                  </div>
                {/each}
              {:else}
                -
              {/if}
            </td>
            <td>
              {#if pairedTopics.length}
                {#each pairedTopics as topic}
                  <div class="flex-col-center">
                    <span>{topic}</span>
                  </div>
                {/each}
              {:else}
                <div style="display: flex; justify-content: center;">
                  <Button
                    variant="primary"
                    class="btn btn-icon"
                    on:click={() => createGeneralTopic(id)}
                  >
                    <Fa icon={faPlus} color="white" />
                  </Button>
                </div>
              {/if}
            </td>
            <td>
              {#if pairedTopicSubs}
                {#each pairedTopicSubs as subs}
                  <div class="flex-col-center">
                    <span>{subs}</span>
                  </div>
                {/each}
              {:else}
                -
              {/if}
            </td>
            <td>
              {#if pairedTopicPosts}
                {#each pairedTopicPosts as post}
                  <div class="flex-col-center">
                    <span>{post}</span>
                  </div>
                {/each}
              {:else}
                -
              {/if}
            </td>
            <td>
              <div class="flex-col-center">
                <input
                  type="checkbox"
                  name="permissions.activeOrg"
                  checked={permissions?.activeOrg || false}
                  on:change={(e) => handleUnionPostsEnabled(e, id)}
                />
              </div>
            </td>
            <td>
              <div class="flex-col-center">
                <input
                  type="checkbox"
                  name="permissions.adminPanel"
                  checked={permissions?.adminPanel || false}
                  on:change={(e) => handleUnionPostsEnabled(e, id)}
                />
              </div>
            </td>
            <td>
              <div class="flex-col-center">
                <input
                  type="checkbox"
                  name="permissions.publications"
                  checked={permissions?.publications || false}
                  on:change={(e) => handleUnionPostsEnabled(e, id)}
                />
              </div>
            </td>
          </tr>
        {/each}
      {/key}
    </tbody>
  </table>
</div>

<style>
  .tb-rl {
    writing-mode: tb-rl;
  }

  .vertical-text {
    display: block;
    transform: rotate(180deg);
    /* width: 0.4rem; */
  }

  .flex-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .flex-col-center {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  tr:nth-child(even),
  tr:nth-child(even) td {
    background-color: #f2f2f2;
  }

  input[type="checkbox"] {
    transform: scale(1.5);
  }
</style>
