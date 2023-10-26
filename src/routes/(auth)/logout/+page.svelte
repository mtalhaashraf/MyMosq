<script>
  import { auth } from "$lib/firebase.js";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  import { resetCurrentUser } from "@store/currentUser.js";

  onMount(() => {
    auth
      .signOut()
      .then(() => {
        console.log("logged out successfully");

        resetCurrentUser();
        goto("/login");
      })
      .catch(console.error);
  });
</script>

<svelte:head>
  <title>Logout</title>
</svelte:head>
