<script>
  import { _ } from "svelte-i18n";
  import { currentUser } from "$lib/store/currentUser.js";
  import { isUnionAdmin, isSuperAdmin } from "@utility/helpers.js";
  import { onMount } from "svelte";
  import firebase from "$lib/firebase.js";
  import { equals } from "ramda";
  import { Button } from "sveltestrap";
  import Fa from "svelte-fa";
  import { faClock, faPlus, faPen } from "@fortawesome/free-solid-svg-icons";

  let admins = [];
  let publishers = [];
  let topics = [];
  let mosques = [];
  let languages = {};
  let unions = {};

  $: console.log({ admins, publishers, topics, mosques, unions, languages });

  $: if ($currentUser.user?.org?.type === "unions") {
    $currentUser.selectedCountry = $currentUser.user.org.Country;
  }

  function handleCountryChange(e) {
    $currentUser.selectedCountry = e.target.dataset.value;
  }

  onMount(getLanguages);
  function getLanguages() {
    return firebase
      .database()
      .ref("languages")
      .on("value", function (snapshot) {
        if (snapshot) {
          languages = snapshot.val();
        }
      });
  }

  onMount(getUnions);
  function getUnions() {
    return firebase
      .firestore()
      .collection("Unions")
      .doc("unions")
      .onSnapshot((snapshot) => {
        unions = snapshot.data();
      });
  }

  $: if ($currentUser.user) getUsers();
  function getUsers() {
    getCacheCollection("users").then((cacheUsers) => {
      admins = cacheUsers.filter((e) => equals(e.role, "admin"));
      publishers = cacheUsers.filter((e) => equals(e.role, "publisher"));
    });
  }

  $: if ($currentUser.settings.countries) getTopics();
  function getTopics() {
    const getAllCacheTopics = async () => {
      let countryTopics = (
        await Promise.all(
          $currentUser.settings.countries.map((code) => getCountryCacheCollection("topics", code))
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

  $: if ($currentUser.settings.countries && $currentUser.selectedCountry) getMosques();
  function getMosques() {
    let mosquesFilter = () => true;

    if (isUnionAdmin($currentUser.user)) {
      mosquesFilter = (mosque) => mosque.membership?.includes($currentUser.user?.org?.id);
    }

    const getCountryCacheMosques = async (code) => {
      const result = await firebase
        .firestore()
        .collection("cache")
        .doc("mosques")
        .collection(code)
        .get()
        .then((snap) => snap.docs.map((doc) => doc.data()));

      const mosques = [];

      for (const shard of result) {
        Object.entries(shard).forEach(([id, mosque]) => {
          mosques.push({ ...mosque, id });
        });
      }

      mosques.sort((a, b) => a.id - b.id);

      return mosques;
    };

    const getAllCacheMosques = async () => {
      const mosques = (
        await Promise.all($currentUser.settings.countries.map(getCountryCacheMosques))
      ).flat();

      return mosques;
    };

    Promise.all([
      // getCacheCollection("mosques"),
      $currentUser.selectedCountry === "all"
        ? getAllCacheMosques()
        : getCountryCacheMosques($currentUser.selectedCountry),
      getCacheCollection("statsMosques"),
    ]).then(async ([_mosques, statsMosques]) => {
      const ids = _mosques.map((e) => e.id);
      const stats = statsMosques.filter((e) => ids.includes(e.id));

      // // NOTE: this is a temporary measure
      // const nonDuplicateMosques = mosques.filter(
      //   (mosque, index, self) => index === self.findIndex((t) => t.id === mosque.id)
      // );

      async function getModifiedMembershipsMosques(mosques, unions) {
        mosques = mosques.map((mosque) => {
          if (!mosque.membership?.length) return mosque;

          const memberships = [...mosque.membership];
          for (const unionId of memberships) {
            const membershipUnion = unions.find((u) => u.id === unionId);
            const parentUnionId = membershipUnion?.parentUnion;

            if (!parentUnionId) continue;

            if (!memberships.includes(parentUnionId)) memberships.push(parentUnionId);

            const parentUnion = unions.find((u) => u.id === parentUnionId);
            const grandparentUnionId = parentUnion?.parentUnion;

            if (!grandparentUnionId) continue;

            if (!memberships.includes(grandparentUnionId)) memberships.push(grandparentUnionId);

            const grandparentUnion = unions.find((u) => u.id === grandparentUnionId);
            const greatGrandparentUnionId = grandparentUnion?.parentUnion;

            if (!greatGrandparentUnionId) continue;

            if (!memberships.includes(greatGrandparentUnionId))
              memberships.push(greatGrandparentUnionId);
          }

          // if (mosque.membership.length !== memberships) {
          //   console.log("mosque changed", mosque.id, mosque.membership, memberships);
          // }

          mosque.membership = memberships;

          return mosque;
        });

        return mosques;
      }

      const modified = await getModifiedMembershipsMosques(_mosques, Object.values(unions));

      const withStats = modified.filter(mosquesFilter).map((e) => {
        const result = stats.find((x) => x.id === e.id);
        if (result && result.subs) {
          return {
            ...e,
            subs: result.subs,
          };
        }
        return {
          ...e,
          subs: 0,
        };
      });

      mosques = withStats;
    });
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

  function pairAdmins(mosqueId) {
    const arr = admins.filter((admin) => {
      return admin.mosqueId === mosqueId;
    });

    if (arr.length > 0) {
      return arr.map((admin) => admin.email || admin.id);
    } else return [];
  }

  function pairPublishers(mosqueId) {
    const arr = publishers.filter((publisher) => {
      return publisher.mosqueId === mosqueId;
    });
    if (arr.length > 0) {
      return arr.map((publisher) => publisher.email || publisher.id);
    } else return [];
  }

  async function createGeneralTopic(mosqueId) {
    const existingTopic = await firebase
      .firestore()
      .collection("topics")
      .where("org.id", "==", newMosqueKey)
      .get();

    if (existingTopic.docs.length <= 0) {
      await firebase
        .firestore()
        .collection("topics")
        .add({
          org: {
            id: mosqueId,
            type: "mosque",
          },
          name: "general",
        });
    }
  }

  function pairTopics(mosqueId) {
    const arr = topics.filter((topic) => {
      return topic.org && topic.org.id === mosqueId;
    });
    if (arr.length > 0) {
      return arr.map((topic) => topic.name || topic.id);
    } else return [];
  }

  function pairTopicSubs(mosqueId) {
    const arr = topics.filter((topic) => {
      return topic.org && topic.org.id === mosqueId;
    });
    if (arr.length > 0) {
      return arr.map((topic) => topic.subs || 0);
    } else return [];
  }

  function pairTopicPosts(mosqueId) {
    const arr = topics.filter((topic) => {
      return topic.org && topic.org.id === mosqueId;
    });
    if (arr.length > 0) {
      return arr.map((topic) => topic.numPosts || 0);
    } else return [];
  }

  function handleCheckboxChange(e, mosqueId) {
    const { target } = e;
    const { checked, name } = target;
    firebase
      .firestore()
      .collection("mosques")
      .doc(mosqueId)
      .update({ [name]: checked });
  }

  function handleExport(e) {
    const header = [
      [
        "MosqueID",
        "Name",
        "OffiziellerName",
        "Ort",
        "Kanton",
        "Strasse",
        "Plz",
        "Facebook",
        "Instagram",
        "YouTube",
        "LanguagesNames",
        "Languages",
        "MembershipNames",
        "Membership",
        "Country",
        "coords",
        "locationBy",
        "Topics",
        "Topic Subscriptions",
        "Posts in Topics",
        "Mosque Subscriptions",
        "permissions.adminPanel",
        "permissions.activeOrg",
        "permissions.publications",
        "Admins",
        "Publishers",
      ],
    ];

    const res = mosques
      .filter((mosque) => {
        if ($currentUser.selectedCountry === "all") return true;

        return mosque.Country === $currentUser.selectedCountry;
      })
      .reduce((acc, x) => {
        const {
          MosqueID,
          Name,
          OffiziellerName,
          Ort,
          Kanton,
          Strasse,
          Plz,
          Facebook,
          Instagram,
          YouTube,
          Languages,
          membership,
          Country,
          coords,
          locationBy,
          subs,
          permissions,
        } = x;
        let langs = [],
          langIds = [],
          membs = [],
          membIds = [];
        if (Array.isArray(Languages)) {
          langs = Languages.map((y) => {
            return languages[y].LanguageName;
          });
          langIds = Languages.map((y) => languages[y].LanguageID);
        }
        if (Array.isArray(membership)) {
          membs = membership
            .map((y) => {
              if (unions[y]) return unions[y].Shortname;
              return null;
            })
            .filter((x) => x);
          membIds = membership
            .map((y) => {
              if (unions[y]) return unions[y].id;
              return null;
            })
            .filter((x) => x);
        }

        const latitude = coords ? coords.lat : "";
        const longitude = coords ? coords.lng : "";
        const coordsString = latitude + ", " + longitude;

        const topicNames = topics
          .filter((topic) => topic.org && topic.org.id === MosqueID)
          .map((topic) => topic.name || topic.id)
          .join(", ");
        const topicSubscriptions = topics
          .filter((topic) => topic.org && topic.org.id === MosqueID)
          .map((topic) => topic.subs || 0)
          .join(", ");
        const postsInTopic = topics
          .filter((topic) => topic.org && topic.org.id === MosqueID)
          .map((topic) => topic.numPosts || 0)
          .join(", ");

        function pairAdmins(mosqueId) {
          const arr = admins.filter((admin) => {
            return admin.mosqueId === mosqueId;
          });
          if (arr.length > 0) {
            return arr
              .filter(Boolean)
              .map((admin) => admin.email)
              .join(", ");
          } else return "";
        }

        function pairPublishers(mosqueId) {
          const arr = publishers.filter((publisher) => {
            return publisher.mosqueId === mosqueId;
          });
          if (arr.length > 0) {
            return arr
              .filter(Boolean)
              .map((publisher) => publisher.email)
              .join(", ");
          } else return "";
        }

        const mosqueAdmins = pairAdmins(x.MosqueID);
        const mosquePublishers = pairPublishers(x.MosqueID);

        acc.push([
          MosqueID,
          Name,
          OffiziellerName,
          Ort,
          Kanton,
          Strasse,
          Plz,
          Facebook,
          Instagram,
          YouTube,
          langs.join(", "),
          langIds.join(", "),
          membs.join(", "),
          membIds.join(", "),
          Country,
          coordsString,
          locationBy,
          topicNames,
          topicSubscriptions,
          postsInTopic,
          subs || 0,
          permissions?.adminPanel,
          permissions?.activeOrg,
          permissions?.publications,
          mosqueAdmins,
          mosquePublishers,
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
    link.setAttribute("href", encodedUri);

    let filteredCountryTag =
      $currentUser.selectedCountry !== "all" ? "_" + $currentUser.selectedCountry : "";

    if (isSuperAdmin($currentUser.user)) {
      link.setAttribute("download", `mymosq_mosques_${str}${filteredCountryTag}.csv`);
    } else if (isUnionAdmin($currentUser.user)) {
      link.setAttribute("download", `mymosq_mosques_${$currentUser.user.org.Shortname}_${str}.csv`);
    }

    document.body.appendChild(link); // Required for FF

    link.click(); // This will download the data file named "my_data.csv"
  }

  $: filteredMosques = mosques.filter((mosque) => {
    if (!$currentUser.selectedCountry) return false;

    if ($currentUser.selectedCountry === "all") return true;
    return mosque.Country === $currentUser.selectedCountry;
  });
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <h1>Mosques</h1>

    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      {#if !isUnionAdmin($currentUser.user)}
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
      {/if}

      <li class="custom-menu__item" style="display: flex; gap: 0.4rem;">
        <button class="btn btn-primary" on:click={handleExport}>
          {$_("export")}
        </button>

        {#if isSuperAdmin($currentUser.user)}
          <a href="/mosques/add">
            <button class="btn btn-primary">
              {$_("addNew")}
            </button>
          </a>
        {/if}
      </li>
    </div>
  </ul>
</div>

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th style="max-width: 200px">{$_("mosque")}</th>

        {#if !isUnionAdmin($currentUser.user)}
          <th>{$_("admins")}</th>
          <th>{$_("publishers")}</th>
        {/if}

        <th>
          <div class="flex-col-center">
            {$_("topics")}
          </div>
        </th>
        <th class:tb-rl={!isUnionAdmin($currentUser.user)}>
          <span class:vertical-text={!isUnionAdmin($currentUser.user)}>
            {$_("topicSubscriptions")}
          </span>
        </th>

        {#if !isUnionAdmin($currentUser.user)}
          <th class="tb-rl">
            <span class="vertical-text">
              {$_("postsInTopic")}
            </span>
          </th>
        {/if}

        <th class="tb-rl">
          <span class="vertical-text">
            {$_("mosqueSubscriptions")}
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

        {#if !isUnionAdmin($currentUser.user)}
          <th class="tb-rl">
            <span class="vertical-text">
              {$_("editTimes")}
            </span>
          </th>
        {/if}

        <th class="tb-rl">
          <span class="vertical-text">
            {$_("editMosque")}
          </span>
        </th>
      </tr>
    </thead>
    <tbody>
      {#key (admins, publishers, mosques, unions, topics)}
        {#each filteredMosques as mosque (mosque.id)}
          {@const pairedTopics = pairTopics(mosque.id) || []}
          {@const pairedAdmins = pairAdmins(mosque.id) || []}
          {@const pairedPublishers = pairPublishers(mosque.id) || []}

          <tr>
            <td style="max-width: 200px"
              >{`${mosque.id} - ${mosque.Ort} ${mosque.Kanton} - ${mosque.Name}`}</td
            >
            {#if !isUnionAdmin($currentUser.user)}
              <td>
                <div class="flex-col">
                  {#if !pairedAdmins.length}
                    -
                  {:else}
                    {#each pairedAdmins as admin}
                      <span>{admin}</span>
                    {/each}
                  {/if}
                </div>
              </td>
              <td>
                <div class="flex-col">
                  {#if !pairedPublishers.length}
                    -
                  {:else}
                    {#each pairedPublishers as publisher}
                      <span>{publisher}</span>
                    {/each}
                  {/if}
                </div>
              </td>
            {/if}
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
                    on:click={() => createGeneralTopic(mosque.id)}
                  >
                    <Fa icon={faPlus} color="white" />
                  </Button>
                </div>
              {/if}
            </td>
            <td>
              {#each pairTopicSubs(mosque.id) as sub}
                <div class="flex-col-center">
                  <span>{sub}</span>
                </div>
              {/each}
            </td>
            {#if !isUnionAdmin($currentUser.user)}
              <td>
                {#each pairTopicPosts(mosque.id) as post}
                  <div class="flex-col-center">
                    <span>{post}</span>
                  </div>
                {/each}
              </td>
            {/if}
            <td>{mosque.subs || 0}</td>

            <td>
              <div class="flex-col-center">
                <input
                  disabled={isUnionAdmin($currentUser.user)}
                  type="checkbox"
                  name="permissions.activeOrg"
                  checked={mosque.permissions.activeOrg}
                  on:change={(e) => handleCheckboxChange(e, mosque.id)}
                />
              </div>
            </td>
            <td>
              <div class="flex-col-center">
                <input
                  disabled={isUnionAdmin($currentUser.user)}
                  type="checkbox"
                  name="permissions.adminPanel"
                  checked={mosque.permissions.adminPanel}
                  on:change={(e) => handleCheckboxChange(e, mosque.id)}
                />
              </div>
            </td>
            <td>
              <div class="flex-col-center">
                <input
                  disabled={isUnionAdmin($currentUser.user)}
                  type="checkbox"
                  name="permissions.publications"
                  checked={mosque.permissions.publications}
                  on:change={(e) => handleCheckboxChange(e, mosque.id)}
                />
              </div>
            </td>
            {#if isSuperAdmin($currentUser.user)}
              <td>
                <a href={`/times/${mosque.id}`}>
                  <Button variant="primary" class="btn btn-icon btn-squared">
                    <Fa icon={faClock} color="white" />
                  </Button>
                </a>
              </td>
            {/if}
            <td>
              <a href={`/mosques/${mosque.id}`}>
                <Button variant="primary" class="btn btn-icon btn-squared">
                  <Fa icon={faPen} color="white" />
                </Button>
              </a>
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
