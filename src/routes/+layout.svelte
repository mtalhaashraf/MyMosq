<script>
  import { onMount, afterUpdate, onDestroy } from "svelte";
  import LogoArea from "@components/header/LogoArea.svelte";
  import TopMenu from "@components/header/TopMenu.svelte";
  import NavSearch from "@components/header/NavSearch.svelte";
  import NavMessage from "@components/header/NavMessage.svelte";
  import NavNotification from "@components/header/NavNotification.svelte";
  import NavSettings from "@components/header/NavSettings.svelte";
  import NavFlags from "@components/header/NavFlags.svelte";
  import NavAuthor from "@components/header/NavAuthor.svelte";
  import Sidebar from "@components/sidebar/Sidebar.svelte";
  import Footer from "@components/footer/Footer.svelte";
  import { Spinner } from "sveltestrap";
  import { getItem } from "$lib/utility/localStorageController";
  import { inlineSvg } from "$lib/components/utilities/utilities";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  import firebase, { auth } from "$lib/firebase.js";
  import { currentUser, resetCurrentUser } from "@store/currentUser.js";
  import Fa from "svelte-fa/src/fa.svelte";
  import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
  import { addMessages, init, getLocaleFromNavigator, locale } from "svelte-i18n";
  import deLang from "@locales/de.json";
  import enLang from "@locales/en.json";
  import frLang from "@locales/fr.json";
  import { strToLocale } from "@utility/locale.js";
  import { redirectUserToAvailableRoute } from "@utility/helpers.js";
  import CurrentOrg from "./CurrentOrg.svelte";

  $: console.log("currentUser", $currentUser);

  let isAuthenticated = $currentUser.user;
  let currentPage = $page.url.pathname;

  onMount(() => {
    //Mobile Author Menu
    const mobileAuthorMenu = document.querySelector(".btn-author-action");
    mobileAuthorMenu.addEventListener("click", function () {
      if (window.innerWidth < 768) {
        document.querySelector(".mobile-author-actions").classList.toggle("show");
      }
    });
  });

  // afterUpdate(() => {
  //   // inlineSvg();
  // });

  /* Active Top Menu */
  function handleMenuType(e) {
    e.preventDefault();
    document.body.classList.add("top-menu");
    document.body.classList.remove("side-menu");
  }

  function handleMenuTypeSide(e) {
    e.preventDefault();
    document.body.classList.add("side-menu");
    document.body.classList.remove("top-menu");
  }

  async function getDetails(uid) {
    const doc = await firebase.firestore().collection("users").doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      return data;
    } else return {};
  }

  let unsubscribes = [];

  async function getSettings() {
    const settings = await firebase
      .firestore()
      .collection("Settings")
      .doc("settings")
      .get()
      .then((doc) => doc.data());

    $currentUser.settings = settings;
  }

  $: if ($currentUser.selectedCountry === "") {
    const localSelectedCountry = localStorage.getItem("localSelectedCountry");
    console.log("retrieved local selected country", localSelectedCountry);
    if (localSelectedCountry) {
      $currentUser.selectedCountry = localSelectedCountry;
    } else {
      $currentUser.selectedCountry = $currentUser.user?.org?.Country;

      if (!$currentUser.selectedCountry && $currentUser.user?.role === "superadmin") {
        $currentUser.selectedCountry = "all";
      }
    }
  }

  $: if ($currentUser.selectedCountry) syncLocalSelectedCountry();
  function syncLocalSelectedCountry() {
    console.log("updating local selected country", $currentUser.selectedCountry);
    localStorage.setItem("localSelectedCountry", $currentUser.selectedCountry);
  }

  onMount(() => {
    const cleanup = auth.onAuthStateChanged(async (user) => {
      console.log("auth state changed");

      if ($page.url.pathname === "/login" && !user) return;
      if ($page.url.pathname === "/logout") return;

      if (!user) {
        resetCurrentUser();
        goto("/login");
        return;
      }

      await getSettings();

      const details = await getDetails(user.uid);

      const { org } = details;

      if (!details.org && details.role !== "superadmin") {
        resetCurrentUser();
        $currentUser.hasNoOrg = true;

        return;
      }

      if (details.role === "superadmin") {
        $currentUser.user = {
          ...user,
          ...details,
        };
        $currentUser.hasNoOrg = false;

        return;
      }

      if (org.type === "union") {
        const unions = await firebase.firestore().collection("Unions").doc("unions").get();
        let union = Object.values(unions.data()).find((e) => e.id === org.id);

        if (!union) {
          resetCurrentUser();
          $currentUser.hasNoOrg = true;

          return;
        }

        $currentUser.user = {
          ...user,
          ...details,
          org: { ...org, ...union },
        };

        $currentUser.hasNoOrg = false;
      } else if (org.type === "mosque") {
        const mosque = await firebase
          .firestore()
          .collection("mosques")
          .doc(org.id)
          .get()
          .then((doc) => doc.data());

        if (!mosque) {
          resetCurrentUser();
          $currentUser.hasNoOrg = true;

          return;
        }

        $currentUser.user = {
          ...user,
          ...details,
          org: { ...org, ...mosque },
        };
        $currentUser.hasNoOrg = false;
      } else {
        resetCurrentUser();
        $currentUser.hasNoOrg = true;
      }

      if ($currentUser.user?.org) {
        console.log("settings org");
        const org = $currentUser.user.org;

        if (!org || !org.id || !org.type) return;

        if (org.type === "union") {
          const unsubscribe = firebase
            .firestore()
            .collection("Unions")
            .doc("unions")
            .onSnapshot((snapshot) => {
              const union = Object.values(snapshot.data()).find((e) => e.id === org.id);

              $currentUser.user = {
                ...$currentUser.user,
                org: {
                  ...$currentUser.user.org,
                  ...union,
                },
              };
              $currentUser.hasNoOrg = false;
            });

          unsubscribes.push(unsubscribe);
          // onDestroy(unsubscribe);
        } else {
          const unsubscribe = firebase
            .firestore()
            .collection("mosques")
            .doc(org.id)
            .onSnapshot((snapshot) => {
              const mosque = snapshot.data();

              $currentUser.user = {
                ...$currentUser.user,
                org: {
                  ...$currentUser.user.org,
                  ...mosque,
                },
              };
              $currentUser.hasNoOrg = false;
            });

          unsubscribes.push(unsubscribe);
          // onDestroy(unsubscribe);
        }
      }
    });

    return () => cleanup();
  });

  onDestroy(() => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    unsubscribes = [];
  });

  $: if ($page.url.pathname === "/" && $currentUser.user) {
    console.log("redirecting to appropriate route");
    redirectUserToAvailableRoute($currentUser.user, goto);
  }

  let langs, de, en, sq, bs, tr, fr, ar, it, lang, lsLang;
  let translationsLoaded = false;

  $: if (de) addMessages("de", de);
  $: if (en) addMessages("en", en);
  $: if (fr) addMessages("fr", fr);

  onMount(() => {
    de = deLang;
    localStorage.setItem("dictionary.de", JSON.stringify(de));

    en = enLang;
    localStorage.setItem("dictionary.en", JSON.stringify(en));

    fr = frLang;
    localStorage.setItem("dictionary.fr", JSON.stringify(fr));

    const deStr = localStorage.getItem("dictionary.de");
    if (deStr) de = JSON.parse(deStr);
    const enStr = localStorage.getItem("dictionary.en");
    if (enStr) en = JSON.parse(enStr);
    const frStr = localStorage.getItem("dictionary.fr");
    if (frStr) fr = JSON.parse(frStr);
  });

  onMount(() => {
    const localeFromNavigator = String(getLocaleFromNavigator());
    lsLang = localStorage.getItem("lang");
    if (lsLang) lang = lsLang;
    else lang = strToLocale(localeFromNavigator);

    locale.set(lang);
  });

  init({
    fallbackLocale: "en",
    initialLocale: lang,
  });
</script>

<svelte:head>
  <title>MyMosq</title>
</svelte:head>

<!-- <div class="mobile-search">
  <form action="/" class="search-form">
    <img class="svg" alt="" src="/img/svg/search.svg" />
    <input
      class="form-control me-sm-2 box-shadow-none"
      type="search"
      placeholder="Search..."
      aria-label="Search"
    />
  </form>
</div> -->
<div class="mobile-author-actions">
  <ul class="navbar-right__menu">
    <li class="nav-flag-select"><NavFlags /></li>
    {#if $currentUser.user}
      <li style="margin-right: 0.5rem">
        {$currentUser.user.email}
      </li>

      <li>
        <a data-sveltekit-reload href="/logout">
          <Fa icon={faRightFromBracket} />
        </a>
      </li>
    {/if}
  </ul>
</div>
<header class="header-top">
  <nav class="navbar navbar-light">
    <div class="navbar-left">
      <LogoArea />
      <!-- <TopMenu /> -->
    </div>

    <!-- <CurrentOrg /> -->

    <div class="navbar-right">
      <ul class="navbar-right__menu">
        <li class="nav-flag-select"><NavFlags /></li>
        {#if $currentUser.user}
          <li>
            {$currentUser.user.email}
          </li>

          <li>
            <a data-sveltekit-reload href="/logout">
              <Fa icon={faRightFromBracket} />
            </a>
          </li>
        {/if}
      </ul>

      <div class="navbar-right__mobileAction d-md-none">
        <!-- <a href={"#"} class="btn-search">
          <img class="svg" alt="" src={"/img/svg/search.svg"} />
          <img class="svg" alt="" src={"/img/svg/x.svg"} /></a
        > -->

        <a href={"#"} class="btn-author-action">
          <img class="svg" alt="" src={"/img/svg/more-vertical.svg"} /></a
        >
      </div>
    </div>
  </nav>
</header>

<main class="main-content">
  <Sidebar />
  <div class="contents expanded">
    <main>
      <slot />
    </main>
  </div>
  <!-- <Footer /> -->
</main>

<style lang="scss">
  :global {
    @import "../assets/sass/style.scss";
  }

  .preloader-wrap {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
