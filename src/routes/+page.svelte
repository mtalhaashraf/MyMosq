<script>
  import { onMount, afterUpdate } from "svelte";
  import { Spinner } from "sveltestrap";
  import { goto } from "$app/navigation";
  import { getItem } from "$lib/utility/localStorageController";
  import { inlineSvg } from "$lib/components/utilities/utilities";
  import { currentUser } from "@store/currentUser.js";

  import { auth } from "$lib/firebase.js";
  // let isAuthenticated = getItem("access_token");

  // onMount(() => {
  //   return auth.onAuthStateChanged((user) => {
  //     if (user) {
  //       console.log("logged in successfully");
  //     } else {
  //       console.log("logged out");
  //       goto("/login");
  //     }
  //   });
  // });

  // onMount(() => {
  //   if (isAuthenticated) {
  //     goto(`/home-one`);
  //   } else {
  //     goto(`/signin`);
  //   }
  // });
  afterUpdate(() => {
    // inlineSvg();
  });
</script>

<svelte:head>
  <title>Home</title>
</svelte:head>

<section>
  {#if !$currentUser}
    <div class="preloader-wrap">
      <Spinner color="primary" size="lg" type="grow" />
    </div>
  {:else}
    <h1>Welcome!</h1>
  {/if}
</section>

<style lang="scss">
  .preloader-wrap {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
